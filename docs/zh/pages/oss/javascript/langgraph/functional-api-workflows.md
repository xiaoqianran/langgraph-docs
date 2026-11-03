<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Compose Functional API workflows | https://docs.langchain.com/oss/javascript/langgraph/functional-api-workflows -->

# 编写函数式 API 工作流程

构建入口点和任务、并行运行工作以及调用图或其他入口点。

使用这些配方从 [entrypoint](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint) 和 [task](https://reference.langchain.com/javascript/langchain-langgraph/index/task) 构建块组成功能 API 工作流程。

有关概念，请参阅[Functional API overview](/oss/javascript/langgraph/functional-api)。对于有序的构建路径，请参阅[Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)。

这些示例使用内存中的 [checkpointer](/oss/javascript/langgraph/persistence)，因此结果会保留在线程上。

## 创建一个简单的工作流程

这是来自 [Choosing between Graph and Functional APIs](/oss/javascript/langgraph/choosing-apis) 的偶数/奇数流。这个版本添加了一个检查指针，因此运行有一个线程。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

const isEven = task("isEven", async (number: number) => {
  return number % 2 === 0;
});

const formatMessage = task("formatMessage", async (isEven: boolean) => {
  return isEven ? "The number is even." : "The number is odd.";
});

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: { number: number }) => {
    const even = await isEven(inputs.number);
    return await formatMessage(even);
  }
);

const config = { configurable: { thread_id: crypto.randomUUID() } };
const result = await workflow.invoke({ number: 7 }, config);
console.log(result);
```

入口点采用一个位置参数作为输入。要传递多个字段，请使用字典：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const myWorkflow = entrypoint(
  { checkpointer, name: "myWorkflow" },
  async (inputs: { value: number; anotherValue: number }) => {
    const value = inputs.value;
    const anotherValue = inputs.anotherValue;
    return { sum: value + anotherValue };
  }
);

await myWorkflow.invoke(
  { value: 1, anotherValue: 2 },
  { configurable: { thread_id: "1" } }
);
```

## 并行运行任务

任务一调用就会开始并返回 `Promise`。首先收集这些承诺，然后等待`Promise.all`，以便工作重叠。

此模式有助于 I/O 密集型工作，例如 LLM API 调用。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver, task } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const addOne = task("addOne", async (number: number) => {
  return number + 1;
});

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (numbers: number[]) => {
    return await Promise.all(numbers.map(addOne));
  }
);
```

> [accordion] 扩展示例：并行 LLM 调用
>
> 每个任务都会生成一个关于不同主题的段落。结果连接成一个字符串。
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatAnthropic } from "@langchain/anthropic";
> import { entrypoint, task, MemorySaver } from "@langchain/langgraph";
>
> let model = new ChatAnthropic({ model: "claude-sonnet-4-6" });
>
> const generateParagraph = task("generateParagraph", async (topic: string) => {
>   const response = await model.invoke([
>     { role: "system", content: "You are a helpful assistant that writes educational paragraphs." },
>     { role: "user", content: `Write a paragraph about ${topic}.` }
>   ]);
>   return response.text;
> });
>
> const checkpointer = new MemorySaver();
>
> const workflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (topics: string[]) => {
>     const paragraphs = await Promise.all(topics.map(generateParagraph));
>     return paragraphs.join("\n\n");
>   }
> );
>
> const config = { configurable: { thread_id: crypto.randomUUID() } };
> const result = await workflow.invoke(["quantum computing", "climate change", "history of aviation"], config);
> console.log(result);
> ```

## 调用图表

功能 API 和 [Graph API](/oss/javascript/langgraph/graph-api) 共享相同的运行时。编译图是另一种可调用的：像任何其他函数一样从入口点调用它。除非将 `config` 传递到 `invoke`，否则嵌套图不会共享外线程。在入口点请求注入的`config`并转发它。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.number(),
});

const builder = new StateGraph(State)
  .addNode("double", (state) => {
    return { foo: state.foo * 2 };
  })
  .addEdge(START, "double");
const graph = builder.compile();

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (x: number, config) => {
    const result = await graph.invoke({ foo: x }, config);
    return { bar: result.foo };
  }
);

const config = { configurable: { thread_id: crypto.randomUUID() } };
console.log(await workflow.invoke(5, config)); // { bar: 10 }
```

## 调用其他入口点

您可以从入口点或任务内调用其他入口点。

当定义的子级没有检查指针时，从具有检查指针的父级调用它会使用父级的检查指针。除非您通过检查点，否则单独调用子进程不会持续存在。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

// Inherits the checkpointer when invoked from myWorkflow
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

> [accordion] 扩展示例：调用另一个入口点
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { entrypoint, MemorySaver } from "@langchain/langgraph";
>
> const checkpointer = new MemorySaver();
>
> const multiply = entrypoint(
>   { name: "multiply" },
>   async (inputs: { a: number; b: number }) => {
>     return inputs.a * inputs.b;
>   }
> );
>
> const main = entrypoint(
>   { checkpointer, name: "main" },
>   async (inputs: { x: number; y: number }) => {
>     const result = await multiply.invoke({ a: inputs.x, b: inputs.y });
>     return { product: result };
>   }
> );
>
> const config = { configurable: { thread_id: crypto.randomUUID() } };
> console.log(await main.invoke({ x: 6, y: 7 }, config)); // { product: 42 }
> ```

## 另请参阅

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Workflows and agents](/oss/javascript/langgraph/workflows-agents)
* [Add LangGraph's features to other frameworks using the Functional API](/langsmith/deploy-other-frameworks)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-workflows.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。