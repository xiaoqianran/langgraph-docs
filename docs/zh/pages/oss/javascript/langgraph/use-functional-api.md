<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use the functional API | https://docs.langchain.com/oss/javascript/langgraph/use-functional-api -->

# 使用函数式API

[**Functional API**](/oss/javascript/langgraph/functional-api) 允许您将 LangGraph 的关键功能（[persistence](/oss/javascript/langgraph/persistence)、[memory](/oss/javascript/langgraph/add-memory)、[human-in-the-loop](/oss/javascript/langgraph/interrupts) 和 [streaming](/oss/javascript/langgraph/streaming)）添加到您的应用程序中，只需对现有代码进行最少的更改。

<Tip>
  有关函数式 API 的概念信息，请参阅[Functional API](/oss/javascript/langgraph/functional-api)。
</Tip>

## 创建一个简单的工作流程

定义 `entrypoint` 时，输入仅限于函数的第一个参数。要传递多个输入，您可以使用字典。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const checkpointer = new MemorySaver();

const myWorkflow = entrypoint(
  { checkpointer, name: "myWorkflow" },
  async (inputs: { value: number; anotherValue: number }) => {
    const value = inputs.value;
    const anotherValue = inputs.anotherValue;
    // ...
  }
);

await myWorkflow.invoke({ value: 1, anotherValue: 2 });
```

<Accordion title="Extended example: simple workflow">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { v7 as uuid7 } from "uuid";
  import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

  // Task that checks if a number is even
  const isEven = task("isEven", async (number: number) => {
    return number % 2 === 0;
  });

  // Task that formats a message
  const formatMessage = task("formatMessage", async (isEven: boolean) => {
    return isEven ? "The number is even." : "The number is odd.";
  });

  // Create a checkpointer for persistence
  const checkpointer = new MemorySaver();

  const workflow = entrypoint(
    { checkpointer, name: "workflow" },
    async (inputs: { number: number }) => {
      // Simple workflow to classify a number
      const even = await isEven(inputs.number);
      return await formatMessage(even);
    }
  );

  // Run the workflow with a unique thread ID
  const config = { configurable: { thread_id: uuid7() } };
  const result = await workflow.invoke({ number: 7 }, config);
  console.log(result);
  ```
</Accordion>

<Accordion title="Extended example: Compose an essay with an LLM">
  此示例演示如何使用 `@task` 和 `@entrypoint` 装饰器
  从句法上来说。鉴于提供了检查点，工作流程结果将
  被持久化在检查点中。

  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { v7 as uuid7 } from "uuid";
  import { ChatOpenAI } from "@langchain/openai";
  import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

  const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });

  // Task: generate essay using an LLM
  const composeEssay = task("composeEssay", async (topic: string) => {
    // Generate an essay about the given topic
    const response = await model.invoke([
      { role: "system", content: "You are a helpful assistant that writes essays." },
      { role: "user", content: `Write an essay about ${topic}.` }
    ]);
    return response.content as string;
  });

  // Create a checkpointer for persistence
  const checkpointer = new MemorySaver();

  const workflow = entrypoint(
    { checkpointer, name: "workflow" },
    async (topic: string) => {
      // Simple workflow that generates an essay with an LLM
      return await composeEssay(topic);
    }
  );

  // Execute the workflow
  const config = { configurable: { thread_id: uuid7() } };
  const result = await workflow.invoke("the history of flight", config);
  console.log(result);
  ```
</Accordion>

## 并行执行

任务可以通过并发调用并等待结果来并行执行。这对于提高 IO 绑定任务的性能很有用（例如，调用 LLM 的 API）。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const addOne = task("addOne", async (number: number) => {
  return number + 1;
});

const graph = entrypoint(
  { checkpointer, name: "graph" },
  async (numbers: number[]) => {
    return await Promise.all(numbers.map(addOne));
  }
);
```

<Accordion title="Extended example: parallel LLM calls">
  此示例演示如何使用 `@task` 并行运行多个 LLM 调用。每次调用都会生成关于不同主题的段落，并将结果合并到单个文本输出中。

  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { v7 as uuid7 } from "uuid";
  import { ChatOpenAI } from "@langchain/openai";
  import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

  // Initialize the LLM model
  const model = new ChatOpenAI({ model: "gpt-3.5-turbo" });

  // Task that generates a paragraph about a given topic
  const generateParagraph = task("generateParagraph", async (topic: string) => {
    const response = await model.invoke([
      { role: "system", content: "You are a helpful assistant that writes educational paragraphs." },
      { role: "user", content: `Write a paragraph about ${topic}.` }
    ]);
    return response.content as string;
  });

  // Create a checkpointer for persistence
  const checkpointer = new MemorySaver();

  const workflow = entrypoint(
    { checkpointer, name: "workflow" },
    async (topics: string[]) => {
      // Generates multiple paragraphs in parallel and combines them
      const paragraphs = await Promise.all(topics.map(generateParagraph));
      return paragraphs.join("\n\n");
    }
  );

  // Run the workflow
  const config = { configurable: { thread_id: uuid7() } };
  const result = await workflow.invoke(["quantum computing", "climate change", "history of aviation"], config);
  console.log(result);
  ```此示例使用 LangGraph 的并发模型来缩短执行时间，特别是当任务涉及 I/O（如 LLM 完成）时。
</Accordion>

## 调用图表

**函数式 API** 和 [**Graph API**](/oss/javascript/langgraph/graph-api) 可以在同一应用程序中一起使用，因为它们共享相同的底层运行时。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint } from "@langchain/langgraph";
import { StateGraph } from "@langchain/langgraph";

const builder = new StateGraph(/* ... */);
// ...
const someGraph = builder.compile();

const someWorkflow = entrypoint(
  { name: "someWorkflow" },
  async (someInput: Record<string, any>) => {
    // Call a graph defined using the graph API
    const result1 = await someGraph.invoke(/* ... */);
    // Call another graph defined using the graph API
    const result2 = await anotherGraph.invoke(/* ... */);
    return {
      result1,
      result2,
    };
  }
);
```

<Accordion title="Extended example: calling a simple graph from the functional API">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { v7 as uuid7 } from "uuid";
  import { entrypoint, MemorySaver, StateGraph, StateSchema } from "@langchain/langgraph";
  import * as z from "zod";

  // Define the shared state type
  const State = new StateSchema({
    foo: z.number(),
  });

  // Build the graph using the Graph API
  const builder = new StateGraph(State)
    .addNode("double", (state) => {
      return { foo: state.foo * 2 };
    })
    .addEdge("__start__", "double");
  const graph = builder.compile();

  // Define the functional API workflow
  const checkpointer = new MemorySaver();

  const workflow = entrypoint(
    { checkpointer, name: "workflow" },
    async (x: number) => {
      const result = await graph.invoke({ foo: x });
      return { bar: result.foo };
    }
  );

  // Execute the workflow
  const config = { configurable: { thread_id: uuid7() } };
  console.log(await workflow.invoke(5, config)); // Output: { bar: 10 }
  ```
</Accordion>

## 调用其他入口点

您可以从**入口点**或**任务**中调用其他**入口点**。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Will automatically use the checkpointer from the parent entrypoint
const someOtherWorkflow = entrypoint(
  { name: "someOtherWorkflow" },
  async (inputs: { value: number }) => {
    return inputs.value;
  }
);

const myWorkflow = entrypoint(
  { checkpointer, name: "myWorkflow" },
  async (inputs: { value: number }) => {
    const value = await someOtherWorkflow.invoke({ value: 1 });
    return value;
  }
);
```

<Accordion title="Extended example: calling another entrypoint">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { v7 as uuid7 } from "uuid";
  import { entrypoint, MemorySaver } from "@langchain/langgraph";

  // Initialize a checkpointer
  const checkpointer = new MemorySaver();

  // A reusable sub-workflow that multiplies a number
  const multiply = entrypoint(
    { name: "multiply" },
    async (inputs: { a: number; b: number }) => {
      return inputs.a * inputs.b;
    }
  );

  // Main workflow that invokes the sub-workflow
  const main = entrypoint(
    { checkpointer, name: "main" },
    async (inputs: { x: number; y: number }) => {
      const result = await multiply.invoke({ a: inputs.x, b: inputs.y });
      return { product: result };
    }
  );

  // Execute the main workflow
  const config = { configurable: { thread_id: uuid7() } };
  console.log(await main.invoke({ x: 6, y: 7 }, config)); // Output: { product: 42 }
  ```
</Accordion>

## 流媒体

**功能 API** 使用与 **图形 API** 相同的流机制。请
阅读[**streaming guide**](/oss/javascript/langgraph/streaming)部分了解更多详情。

使用流 API 从工作流运行流式传输值块的示例。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const config = {
  configurable: { thread_id: "functional-api-stream-custom-data" },
};

const stream = await main.streamEvents({ x: 5 }, { ...config, version: "v3" });
for await (const chunk of stream.values) {
  console.log(chunk);
}
// 10
```

1. 在计算开始之前发出自定义数据。
2. 计算结果后发出另一条自定义消息。
3. 使用`streamEvents()`处理流式输出。
4. 迭代`stream.values`以接收值快照。

## 重试策略

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  MemorySaver,
  entrypoint,
  task,
  RetryPolicy,
} from "@langchain/langgraph";

// This variable is just used for demonstration purposes to simulate a network failure.
// It's not something you will have in your actual code.
let attempts = 0;

// Let's configure the RetryPolicy to retry on ValueError.
// The default RetryPolicy is optimized for retrying specific network errors.
const retryPolicy: RetryPolicy = { retryOn: (error) => error instanceof Error };

const getInfo = task(
  {
    name: "getInfo",
    retry: retryPolicy,
  },
  () => {
    attempts += 1;

    if (attempts < 2) {
      throw new Error("Failure");
    }
    return "OK";
  }
);

const checkpointer = new MemorySaver();

const main = entrypoint(
  { checkpointer, name: "main" },
  async (inputs: Record<string, any>) => {
    return await getInfo();
  }
);

const config = {
  configurable: {
    thread_id: "1",
  },
};

await main.invoke({ any_input: "foobar" }, config);
```

```
'OK'
```

## 缓存任务

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  InMemoryCache,
  entrypoint,
  task,
  CachePolicy,
} from "@langchain/langgraph";

const slowAdd = task(
  {
    name: "slowAdd",
    cache: { ttl: 120 },   // [!code highlight]
  },
  async (x: number) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return x * 2;
  }
);

const main = entrypoint(
  { cache: new InMemoryCache(), name: "main" },
  async (inputs: { x: number }) => {
    const result1 = await slowAdd(inputs.x);
    const result2 = await slowAdd(inputs.x);
    return { result1, result2 };
  }
);

const stream = await main.streamEvents({ x: 5 }, { version: "v3" });
for await (const snapshot of stream.values) {
  console.log(snapshot);
}
```

1. `ttl` 以秒为单位指定。过了这个时间，缓存就会失效。

## 错误后恢复

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

// This variable is just used for demonstration purposes to simulate a network failure.
// It's not something you will have in your actual code.
let attempts = 0;

const getInfo = task("getInfo", async () => {
  /**
   * Simulates a task that fails once before succeeding.
   * Throws an exception on the first attempt, then returns "OK" on subsequent tries.
   */
  attempts += 1;

  if (attempts < 2) {
    throw new Error("Failure"); // Simulate a failure on the first attempt
  }
  return "OK";
});

// Initialize an in-memory checkpointer for persistence
const checkpointer = new MemorySaver();

const slowTask = task("slowTask", async () => {
  /**
   * Simulates a slow-running task by introducing a 1-second delay.
   */
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "Ran slow task.";
});

const main = entrypoint(
  { checkpointer, name: "main" },
  async (inputs: Record<string, any>) => {
    /**
     * Main workflow function that runs the slowTask and getInfo tasks sequentially.
     *
     * Parameters:
     * - inputs: Record<string, any> containing workflow input values.
     *
     * The workflow first executes `slowTask` and then attempts to execute `getInfo`,
     * which will fail on the first invocation.
     */
    const slowTaskResult = await slowTask(); // Blocking call to slowTask
    await getInfo(); // Exception will be raised here on the first attempt
    return slowTaskResult;
  }
);

// Workflow execution configuration with a unique thread identifier
const config = {
  configurable: {
    thread_id: "1", // Unique identifier to track workflow execution
  },
};

// This invocation will take ~1 second due to the slowTask execution
try {
  // First invocation will raise an exception due to the `getInfo` task failing
  await main.invoke({ any_input: "foobar" }, config);
} catch (err) {
  // Handle the failure gracefully
}
```

当我们恢复执行时，我们不需要重新运行`slowTask`，因为它的结果已经保存在检查点中。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await main.invoke(null, config);
```

```
'Ran slow task.'
```

## 人机交互函数式 API 支持使用 [⟦T36⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 函数和 `Command` 原语的 [human-in-the-loop](/oss/javascript/langgraph/interrupts) 工作流程。

### 基本的人机交互工作流程

我们将创建三个[tasks](/oss/javascript/langgraph/functional-api#task)：

1. 追加`"bar"`。
2. 暂停以等待人工输入。恢复时，附加人工输入。
3. 追加`"qux"`。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task, interrupt, Command } from "@langchain/langgraph";

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
```

我们现在可以在 [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) 中组合这些任务：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const graph = entrypoint(
  { checkpointer, name: "graph" },
  async (inputQuery: string) => {
    const result1 = await step1(inputQuery);
    const result2 = await humanFeedback(result1);
    const result3 = await step3(result2);

    return result3;
  }
);
```

[interrupt()](/oss/javascript/langgraph/interrupts#pause-using-interrupt) 在任务内部调用，使人们能够查看和编辑前一个任务的输出。先前任务的结果（在本例中为 `step_1`）将被保留，以便它们不会在 [⟦T41⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 之后再次运行。

让我们发送一个查询字符串：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const config = { configurable: { thread_id: "1" } };

const stream = await graph.streamEvents("foo", config, { version: "v3" });
for await (const message of stream.messages) {
  for await (const token of message.text) {
    process.stdout.write(token);
  }
}
```

请注意，我们在 `step_1` 之后暂停了 [⟦T42⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)。中断提供恢复运行的指令。为了继续，我们发出一个 [⟦T44⟧](/oss/javascript/langgraph/interrupts#resuming-interrupts)，其中包含 `human_feedback` 任务所需的数据。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Continue execution
const stream = await graph.streamEvents(
  new Command({ resume: "baz" }),
  config,
  { version: "v3" }
);
for await (const message of stream.messages) {
  for await (const token of message.text) {
    process.stdout.write(token);
  }
}
```

恢复后，运行将继续执行剩余步骤并按预期终止。

### 查看工具调用

为了在执行前检查工具调用，我们添加了一个调用 [⟦T47⟧](/oss/javascript/langgraph/interrupts#pause-using-interrupt) 的 `review_tool_call` 函数。当调用此函数时，执行将暂停，直到我们发出命令来恢复它。

给定一个工具调用，我们的函数将[⟦T48⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)进行人工审查。那时我们可以：* 接受工具调用
* 修改工具调用并继续
* 生成自定义工具消息（例如，指示模型重新格式化其工具调用）

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ToolCall } from "@langchain/core/messages/tool";
import { ToolMessage } from "@langchain/core/messages";

function reviewToolCall(toolCall: ToolCall): ToolCall | ToolMessage {
  // Review a tool call, returning a validated version
  const humanReview = interrupt({
    question: "Is this correct?",
    tool_call: toolCall,
  });

  const reviewAction = humanReview.action;
  const reviewData = humanReview.data;

  if (reviewAction === "continue") {
    return toolCall;
  } else if (reviewAction === "update") {
    const updatedToolCall = { ...toolCall, args: reviewData };
    return updatedToolCall;
  } else if (reviewAction === "feedback") {
    return new ToolMessage({
      content: reviewData,
      name: toolCall.name,
      tool_call_id: toolCall.id,
    });
  }

  throw new Error(`Unknown review action: ${reviewAction}`);
}
```

我们现在可以更新 [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) 来查看生成的工具调用。如果工具调用被接受或修改，我们将以与以前相同的方式执行。否则，我们只需附加人类提供的[⟦T49⟧](https://reference.langchain.com/javascript/langchain-core/messages/ToolMessage)。先前任务的结果（在本例中为初始模型调用）将被保留，以便它们不会在 [⟦T50⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 之后再次运行。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  MemorySaver,
  entrypoint,
  interrupt,
  Command,
  addMessages,
} from "@langchain/langgraph";
import { ToolMessage, AIMessage, BaseMessage } from "@langchain/core/messages";

const checkpointer = new MemorySaver();

const agent = entrypoint(
  { checkpointer, name: "agent" },
  async (
    messages: BaseMessage[],
    previous?: BaseMessage[]
  ): Promise<BaseMessage> => {
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

      for (let i = 0; i < modelResponse.tool_calls.length; i++) {
        const review = reviewToolCall(modelResponse.tool_calls[i]);
        if (review instanceof ToolMessage) {
          toolResults.push(review);
        } else {
          // is a validated tool call
          toolCalls.push(review);
          if (review !== modelResponse.tool_calls[i]) {
            modelResponse.tool_calls[i] = review; // update message
          }
        }
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
```

## 短期记忆

短期记忆允许跨同一**线程 ID**的不同**调用**存储信息。更多详情请参见[short-term memory](/oss/javascript/langgraph/functional-api#short-term-memory)。

### 管理检查点

您可以查看和删除检查点存储的信息。

<a />

#### 查看线程状态

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const config = {
  configurable: {
    thread_id: "1",  // [!code highlight]
    // optionally provide an ID for a specific checkpoint,
    // otherwise the latest checkpoint is shown
    // checkpoint_id: "1f029ca3-1f5b-6704-8004-820c16b69a5a" [!code highlight]
  },
};
await graph.getState(config);  // [!code highlight]
```

```
StateSnapshot {
  values: {
    messages: [
      HumanMessage { content: "hi! I'm bob" },
      AIMessage { content: "Hi Bob! How are you doing today?" },
      HumanMessage { content: "what's my name?" },
      AIMessage { content: "Your name is Bob." }
    ]
  },
  next: [],
  config: { configurable: { thread_id: '1', checkpoint_ns: '', checkpoint_id: '1f029ca3-1f5b-6704-8004-820c16b69a5a' } },
  metadata: {
    source: 'loop',
    writes: { call_model: { messages: AIMessage { content: "Your name is Bob." } } },
    step: 4,
    parents: {},
    thread_id: '1'
  },
  createdAt: '2025-05-05T16:01:24.680462+00:00',
  parentConfig: { configurable: { thread_id: '1', checkpoint_ns: '', checkpoint_id: '1f029ca3-1790-6b0a-8003-baf965b6a38f' } },
  tasks: [],
  interrupts: []
}
```

<a />

#### 查看线程的历史记录

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const config = {
  configurable: {
    thread_id: "1",  // [!code highlight]
  },
};
const history = [];  // [!code highlight]
for await (const state of graph.getStateHistory(config)) {
  history.push(state);
}
```

```
[
  StateSnapshot {
    values: {
      messages: [
        HumanMessage { content: "hi! I'm bob" },
        AIMessage { content: "Hi Bob! How are you doing today? Is there anything I can help you with?" },
        HumanMessage { content: "what's my name?" },
        AIMessage { content: "Your name is Bob." }
      ]
    },
    next: [],
    config: { configurable: { thread_id: '1', checkpoint_ns: '', checkpoint_id: '1f029ca3-1f5b-6704-8004-820c16b69a5a' } },
    metadata: { source: 'loop', writes: { call_model: { messages: AIMessage { content: "Your name is Bob." } } }, step: 4, parents: {}, thread_id: '1' },
    createdAt: '2025-05-05T16:01:24.680462+00:00',
    parentConfig: { configurable: { thread_id: '1', checkpoint_ns: '', checkpoint_id: '1f029ca3-1790-6b0a-8003-baf965b6a38f' } },
    tasks: [],
    interrupts: []
  },
  // ... more state snapshots
]
```

### 将返回值与保存的值分离

使用 `entrypoint.final` 将返回给调用者的内容与检查点中保存的内容解耦。这在以下情况下很有用：* 您想要返回计算结果（例如摘要或状态），但保存不同的内部值以供下次调用使用。
* 您需要控制下次运行时传递给前一个参数的内容。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const accumulate = entrypoint(
  { checkpointer, name: "accumulate" },
  async (n: number, previous?: number) => {
    const prev = previous || 0;
    const total = prev + n;
    // Return the *previous* value to the caller but save the *new* total to the checkpoint.
    return entrypoint.final({ value: prev, save: total });
  }
);

const config = { configurable: { thread_id: "my-thread" } };

console.log(await accumulate.invoke(1, config)); // 0
console.log(await accumulate.invoke(2, config)); // 1
console.log(await accumulate.invoke(3, config)); // 3
```

### 聊天机器人示例

使用功能 API 和 [⟦T52⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph-checkpoint.MemorySaver.html) 检查点的简单聊天机器人示例。

机器人能够记住之前的对话并从中断的地方继续。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import {
  addMessages,
  entrypoint,
  task,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({ model: "claude-sonnet-4-6" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (
    inputs: BaseMessage[],
    previous?: BaseMessage[]
  ): Promise<BaseMessage> => {
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };

const stream1 = await workflow.streamEvents([inputMessage], { ...config, version: "v3" });
for await (const snapshot of stream1.values) {
  console.log(snapshot);
}

const inputMessage2 = { role: "user", content: "what's my name?" };
const stream2 = await workflow.streamEvents([inputMessage2], { ...config, version: "v3" });
for await (const snapshot of stream2.values) {
  console.log(snapshot);
}
```

## 长期记忆

[long-term memory](/oss/javascript/concepts/memory#long-term-memory) 允许跨不同**线程 id** 存储信息。这对于在一个对话中了解有关给定用户的信息并在另一个对话中使用它可能很有用。

## 工作流程

* [Workflows and agent](/oss/javascript/langgraph/workflows-agents) 指南，了解如何使用功能 API 构建工作流程的更多示例。

## 与其他库集成

* [Add LangGraph's features to other frameworks using the functional API](/langsmith/deploy-other-frameworks)：将持久性、内存和流等 LangGraph 功能添加到其他不提供开箱即用的代理框架。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>