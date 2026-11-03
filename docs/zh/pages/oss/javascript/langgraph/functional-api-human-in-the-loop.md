<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Add human-in-the-loop with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-human-in-the-loop -->

# 使用功能 API 添加人机交互

暂停功能 API 工作流程以进行批准和审查带有中断的工具调用。

使用 [⟦T3⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 暂停功能 API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint)，并使用 [⟦T4⟧](/oss/javascript/langgraph/interrupts#resuming-interrupts) 恢复。

有关概念，请参阅[Functional API overview](/oss/javascript/langgraph/functional-api)。有关中断有效负载和恢复形状，请参阅[Interrupts](/oss/javascript/langgraph/interrupts)。持久性需要[checkpointer](/oss/javascript/langgraph/persistence)和`thread_id`。

## 暂停以获取反馈

创建三个[tasks](/oss/javascript/langgraph/functional-api#task)：

1. 追加`"bar"`。
2. 暂停以等待人工输入。恢复时，附加该输入。
3. 追加`"qux"`。

将它们组合在入口点中。 `step_1` 完成后，`interrupt` 在`human_feedback` 内运行。这些结果将被保留，因此恢复后`step_1`不会再次运行。

使用 `thread_id` 识别运行。驱动流直到暂停，打印中断有效负载，然后恢复。

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

`Command` `resume` 值是`human_feedback` 期望的数据。恢复后，运行继续通过`step_3`并返回`foo bar baz qux`。

## 查看工具调用

要在执行前检查工具调用，请从助手中调用 `interrupt`。执行将暂停，直到您使用 `Command` 恢复。

给定一个工具调用，选择以下之一：

* 接受工具调用
* 修改工具调用并继续
* 生成自定义工具消息（例如，指示模型重新格式化其工具调用）

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
```将助手连接到入口点。接受或修改的呼叫通过`call_tool`运行。反馈变成[⟦T21⟧](https://reference.langchain.com/javascript/langchain-core/messages/ToolMessage)并跳过执行。先前的任务结果，这里是第一个模型调用，在中断后留在线程上。

下面的`call_model`和`call_tool`是替身。将它们替换为您的模型和工具。有关更多信息，请参阅[Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory)。

入口点使用`getPreviousState`从检查点恢复先前的消息。

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

## 另请参阅

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Interrupts](/oss/javascript/langgraph/interrupts)
* [Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory)
* [Stream with the Functional API](/oss/javascript/langgraph/functional-api-streaming)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-human-in-the-loop.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。