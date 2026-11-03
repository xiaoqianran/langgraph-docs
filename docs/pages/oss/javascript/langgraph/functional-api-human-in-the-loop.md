<!-- langgraph-docs: Add human-in-the-loop with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-human-in-the-loop -->

# Add human-in-the-loop with the Functional API

Pause Functional API workflows for approval and review tool calls with interrupts.

Pause a Functional API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) with [`interrupt`](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) and resume with [`Command`](/oss/javascript/langgraph/interrupts#resuming-interrupts).

For concepts, see the [Functional API overview](/oss/javascript/langgraph/functional-api). For interrupt payloads and resume shapes, see [Interrupts](/oss/javascript/langgraph/interrupts). Persistence requires a [checkpointer](/oss/javascript/langgraph/persistence) and a `thread_id`.

## Pause for feedback

Create three [tasks](/oss/javascript/langgraph/functional-api#task):

1. Append `"bar"`.
2. Pause for human input. When resuming, append that input.
3. Append `"qux"`.

Compose them in an entrypoint. `interrupt` runs inside `human_feedback` after `step_1` has finished. Those results are persisted, so `step_1` does not run again after resume.

Identify the run with `thread_id`. Drive the stream until it pauses, print the interrupt payload, then resume.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  Command,
  MemorySaver,
  entrypoint,
  interrupt,
  task,
} from "@langchain/langgraph";

const step1 = task("step1", async (inputQuery: string) => {
  // Append bar
  return `${inputQuery} bar`;
});

const humanFeedback = task("humanFeedback", async (inputQuery: string) => {
  // Append user input
  const feedback = interrupt(`Please provide feedback: ${inputQuery}`);
  return `${inputQuery} ${feedback}`;
});

const step3 = task("step3", async (inputQuery: string) => {
  // Append qux
  return `${inputQuery} qux`;
});

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputQuery: string) => {
    const result1 = await step1(inputQuery);
    const result2 = await humanFeedback(result1);
    const result3 = await step3(result2);
    return result3;
  }
);

const config = { configurable: { thread_id: "1" } };

const stream = await workflow.streamEvents("foo", {
  ...config,
  version: "v3",
});
for await (const chunk of stream.values) {
  console.log(chunk);
}
// -> { __interrupt__: [{ value: 'Please provide feedback: foo bar', ... }] }

const resumed = await workflow.streamEvents(new Command({ resume: "baz" }), {
  ...config,
  version: "v3",
});
let last: unknown;
for await (const chunk of resumed.values) {
  console.log(chunk);
  last = chunk;
}
// -> 'foo bar baz qux'
```

The `Command` `resume` value is the data `human_feedback` expects. After resume, the run continues through `step_3` and returns `foo bar baz qux`.

## Review tool calls

To review tool calls before execution, call `interrupt` from a helper. Execution pauses until you resume with `Command`.

Given a tool call, choose one of:

* Accept the tool call
* Revise the tool call and continue
* Generate a custom tool message (for example, instruct the model to re-format its tool call)

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ToolMessage } from "@langchain/core/messages";
import { ToolCall } from "@langchain/core/messages/tool";
import { interrupt } from "@langchain/langgraph";

type ToolCallReview =
  | { action: "continue"; data?: undefined }
  | { action: "update"; data: ToolCall["args"] }
  | { action: "feedback"; data: string };

function reviewToolCall(toolCall: ToolCall): ToolCall | ToolMessage {
  // Review a tool call, returning a validated version
  const humanReview = interrupt({
    question: "Is this correct?",
    tool_call: toolCall,
  }) as ToolCallReview;

  if (humanReview.action === "continue") {
    return toolCall;
  }
  if (humanReview.action === "update") {
    return { ...toolCall, args: humanReview.data };
  }
  if (humanReview.action === "feedback") {
    return new ToolMessage({
      content: humanReview.data,
      name: toolCall.name,
      tool_call_id: toolCall.id,
    });
  }

  throw new Error("Unknown review action");
}
```

Wire the helper into an entrypoint. Accepted or revised calls run through `call_tool`. Feedback becomes a [`ToolMessage`](https://reference.langchain.com/javascript/langchain-core/messages/ToolMessage) and skips execution. Prior task results, here the first model call, stay on the thread after the interrupt.

`call_model` and `call_tool` below are stand-ins. Replace them with your model and tools. For more, see [Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory).

The entrypoint restores prior messages from the checkpointer with `getPreviousState`.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
} from "@langchain/core/messages";
import {
  Command,
  MemorySaver,
  addMessages,
  entrypoint,
  getPreviousState,
  task,
} from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const callModel = task("callModel", async (messages: BaseMessage[]) => {
  const last = messages[messages.length - 1];
  if (last instanceof ToolMessage) {
    return new AIMessage({ content: "Search complete." });
  }
  return new AIMessage({
    content: "",
    tool_calls: [
      {
        name: "search",
        args: { query: "weather" },
        id: "call_1",
        type: "tool_call",
      },
    ],
  });
});

const callTool = task("callTool", async (toolCall: ToolCall) => {
  return new ToolMessage({
    content: `result for ${JSON.stringify(toolCall.args)}`,
    name: toolCall.name,
    tool_call_id: toolCall.id,
  });
});

const agent = entrypoint(
  { checkpointer, name: "agent" },
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    if (previous !== undefined) {
      messages = addMessages(previous, messages);
    }

    let modelResponse = await callModel(messages);
    while (true) {
      if (!modelResponse.tool_calls?.length) {
        break;
      }

      // Review tool calls
      const toolResults: ToolMessage[] = [];
      const toolCalls: ToolCall[] = [];
      const updatedToolCalls = [...modelResponse.tool_calls];

      for (let i = 0; i < modelResponse.tool_calls.length; i++) {
        const review = reviewToolCall(modelResponse.tool_calls[i]);
        if (review instanceof ToolMessage) {
          toolResults.push(review);
        } else {
          // is a validated tool call
          toolCalls.push(review);
          updatedToolCalls[i] = review;
        }
      }

      const toolCallsChanged = updatedToolCalls.some(
        (call, i) => call !== modelResponse.tool_calls?.[i]
      );
      if (toolCallsChanged) {
        modelResponse = new AIMessage({
          content: modelResponse.content,
          tool_calls: updatedToolCalls,
        });
      }

      // Execute remaining tool calls
      const remainingToolResults = await Promise.all(
        toolCalls.map((toolCall) => callTool(toolCall))
      );

      // Append to message list
      messages = addMessages(messages, [
        modelResponse,
        ...toolResults,
        ...remainingToolResults,
      ]);

      // Call model again
      modelResponse = await callModel(messages);
    }

    // Generate final response
    messages = addMessages(messages, modelResponse);
    return entrypoint.final({ value: modelResponse, save: messages });
  }
);

const config = { configurable: { thread_id: "2" } };

const stream = await agent.streamEvents(
  [new HumanMessage("What's the weather?")],
  { ...config, version: "v3" }
);
for await (const chunk of stream.values) {
  console.log(chunk);
}

const result = await agent.invoke(
  new Command({ resume: { action: "continue" } }),
  config
);
console.log(result);
```

## See also

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Interrupts](/oss/javascript/langgraph/interrupts)
* [Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory)
* [Stream with the Functional API](/oss/javascript/langgraph/functional-api-streaming)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-human-in-the-loop.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).