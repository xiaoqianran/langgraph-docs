<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Functional API overview | https://docs.langchain.com/oss/javascript/langgraph/functional-api -->

# 功能 API 概述

使用LangSmith部署的入口点和任务包装其他框架。涵盖检查点、恢复规则和常见陷阱。

**函数式 API** 使用 LangGraph 运行时功能（[persistence](/oss/javascript/langgraph/persistence)、[memory](/oss/javascript/langgraph/add-memory)、[human-in-the-loop](/oss/javascript/langgraph/interrupts) 和 [streaming](/oss/javascript/langgraph/streaming)）包装普通函数。当您已经拥有现有代码或正在使用不同的框架并且想要 [deploy it on LangSmith](/langsmith/deploy-other-frameworks) 而不将该代理重写为图形时，请使用它。首选[Graph API](/oss/javascript/langgraph/graph-api)来构建新代理。

此页面是入口点、任务、检查点和恢复规则的概念参考。有关包装和部署方法，请参阅 [Deploy other frameworks](/langsmith/deploy-other-frameworks)。

功能 API 使用两个构建块：

* **`entrypoint`**：封装工作流逻辑并管理执行、中断和检查点。
* **`task`**：标记离散的工作单元（例如，API 调用）。任务返回您在入口点内等待的 `Promise`。

## 何时使用函数式 API

|构建 |使用 |
| - | - |
|新的LangGraph代理和工作流程| [Graph API](/oss/javascript/langgraph/graph-api) |
|您想要在 LangSmith 部署 | 的另一个框架（Claude Agent SDK、Strands、CrewAI、AutoGen 等）中的现有代理通过 [Deploy other frameworks](/langsmith/deploy-other-frameworks) 的功能 API |与 Graph API 相比，Functional API 使用普通语言控制流（`if` / `else`、循环和调用），将值范围保持在入口点和任务范围内，而不是共享 [state](/oss/javascript/langgraph/graph-api#state) 模式，将任务结果保存在入口点检查点上而不是在每个 [super-step](/oss/javascript/langgraph/graph-api#super-steps) 之后，并且没有静态图形可视化。

## 入口点

`entrypoint` 函数从函数创建工作流。它管理长时间运行的工作和[interrupts](/oss/javascript/langgraph/interrupts)。

### 定义

当您需要坚持或人参与时，请通过[checkpointer](/oss/javascript/langgraph/persistence)。在配置中使用 `thread_id` 标识每次运行。线程是一次对话或工作流程运行的持久标识。

**入口点**是通过使用配置和函数调用`entrypoint`来创建的。

该函数**必须接受单个位置参数**作为工作流程输入。要传递多个值，请使用对象作为该参数。

结果是一个工作流对象。调用`invoke`来运行它。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver, entrypoint } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const myWorkflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (name: string): Promise<string> => {
    return `Hello, ${name}`;
  }
);

const config = { configurable: { thread_id: "1" } };
await myWorkflow.invoke("Alice", config); // "Hello, Alice"
```

> [!警告]
>
> **序列化**
> 配置检查点时，入口点 **输入** 和 **输出** 必须是 JSON 可序列化的。参见[Serialization](#serialization)。

### 运行并恢复

致电`invoke`获取最终结果。对于流，请参阅[Streaming](/oss/javascript/langgraph/streaming)。通过在 [⟦T20⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 中传递恢复值，在 [⟦T19⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 之后恢复。有关食谱，请参阅[Interrupts](/oss/javascript/langgraph/interrupts)。

发生错误后，用 `null` 恢复相同的 `thread_id`。

### 短期记忆

当 `entrypoint` 具有 `checkpointer` 时，对同一 **线程 id** 的连续调用会将状态存储在 [checkpoints](/oss/javascript/langgraph/checkpointers#checkpoints) 中。

在入口点内调用`getPreviousState`。它返回该线程上保存的最后一个值。第一次运行时是`undefined`。要为下次运行保存不同的值，请使用 [⟦T27⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint/final)。

### 可注入参数

您可以跳过此步骤，直到添加 [memory](/oss/javascript/langgraph/add-memory) 或 [custom streaming](/oss/javascript/langgraph/streaming)。

`entrypoint` 函数可以采用第二个 `config` 参数。 LangGraph 还提供了您在函数内调用的帮助程序：

|帮手|描述 |
| - | - |
| **获取上一个状态** |同一线程上一次调用的返回值（需要检查指针）。参见[short-term memory](#short-term-memory)。 |
| **配置** |具有运行时配置值的 `LangGraphRunnableConfig` 对象。 |
| **配置.store** | [long-term memory](/oss/javascript/langgraph/add-memory) 的商店实例。 |
| **配置.writer** |自定义流媒体的作家。参见[Streaming](/oss/javascript/langgraph/streaming)。 |

> [accordion] 请求可注入参数
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import {
>   MemorySaver,
>   InMemoryStore,
>   entrypoint,
>   getPreviousState,
> } from "@langchain/langgraph";
> import type { LangGraphRunnableConfig } from "@langchain/langgraph";
>
> const checkpointer = new MemorySaver();
> const store = new InMemoryStore();
>
> const myWorkflow = entrypoint(
>   { checkpointer, store, name: "workflow" },
>   async (
>     someInput: Record<string, unknown>,
>     config: LangGraphRunnableConfig
>   ) => {
>     const previous = getPreviousState();
>     const memoryStore = config.store;
>     const writer = config.writer;
>     return { previous, someInput };
>   }
> );
> ```

## 任务

**任务**是一个离散的工作单元（例如，API 调用或数据步骤）。任务有两个关键属性：* **并发执行**：调用任务会立即启动它。仅当您等待结果时，入口点才会阻塞，因此独立任务可以重叠。
* **检查点**：保存任务结果，以便恢复可以恢复它们。参见[persistence](/oss/javascript/langgraph/persistence)。

### 定义

使用 `task` 函数定义任务：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { task } from "@langchain/langgraph";

const slowComputation = task("slowComputation", async (inputValue: number) => {
  // Long-running or side-effecting work
  return inputValue * 2;
});
```

> [!警告]
>
> **序列化**：任务 **输出** 必须可 JSON 序列化以支持检查点。

### 执行

仅从**入口点**、另一个**任务**或[Graph API node](/oss/javascript/langgraph/graph-api#nodes)调用**任务**。不要从工作流程之外的应用程序代码调用它们。

调用任务会返回一个`Promise`。在入口点内等待它：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver, entrypoint, task } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const slowComputation = task("slowComputation", async (inputValue: number) => {
  return inputValue * 2;
});

const myWorkflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (someInput: number): Promise<number> => {
    return await slowComputation(someInput);
  }
);
```

### 何时使用任务

当您需要时使用**任务**：

* **检查点**：保存长时间运行的结果，以便恢复时不会重新计算它。
* **人机交互**：在任务暂停后结束不应重做的工作，例如 LLM 通话。待[interrupt](/oss/javascript/langgraph/interrupts)恢复结果后继续。对于随机性，请参阅[Determinism](#determinism)。
* **并行执行**：同时运行独立的 I/O 密集型工作。
* **可观察性**：跟踪[LangSmith](/langsmith/observability)中的离散步骤。
* **重试**：将重试策略应用于离散的工作单元。参见[Fault tolerance](/oss/javascript/langgraph/fault-tolerance)。

## 恢复和检查点恢复重放取决于序列化、确定性和幂等性。

### 序列化

配置检查指针时适用两条规则：

1. `entrypoint` 输入和输出必须是 JSON 可序列化的。
2. `task` 输出必须是 JSON 可序列化的。

使用对象、数组、字符串、数字和布尔值等基元。

序列化使任务结果和中间值可恢复，以实现人机交互、容错和并行执行。配置检查指针时，不可序列化的值会引发运行时错误。

### 决定论

恢复**不**从执行停止的确切行继续。执行返回到检查点边界并向前**重播**，直到再次遇到暂停。

对于功能 API，重播从 **入口点** 的开头开始。 LangGraph 从检查点恢复已完成的 [**task**](#task) 和 [**subgraph**](/oss/javascript/langgraph/use-subgraphs) 结果，而不是重新计算它们。这可以保留暂停期间的步骤顺序，包括长时间运行或不确定的**任务**输出。

对于**人机交互**，将非确定性工作（例如随机值）和副作用（例如文件写入或 API 调用）放入 [**tasks**](#task) 中。不同的运行可以产生不同的结果。恢复**特定**线程应该重播相同的持久**任务**和**子图**结果。

指南：

* **避免重复工作**：为入口点中的每个副作用赋予其自己的**任务**，以便恢复恢复输出而不是重新运行它们。
* **封装非确定性操作**：将尝试之间变化的值（随机数、挂钟时间）保留在**任务**内。
* **使用幂等操作**：部分失败和重试请参见[Idempotency](#idempotency)。

### 幂等性

幂等性意味着多次运行相同的操作与运行一次具有相同的效果。将 API 调用和其他写入放入 **任务** 中，并将这些任务设计为在再次运行时是安全的。

恢复时，LangGraph 恢复已完成的**任务**结果。已启动但未完成的**任务**可能会再次运行，因此请在写入之前使用幂等键或检查现有结果。

## 暂停以供人工审核

此工作流程编写一篇文章和 [interrupts](/oss/javascript/langgraph/interrupts) 供人工审阅：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver, entrypoint, task, interrupt } from "@langchain/langgraph";

const writeEssay = task("writeEssay", async (topic: string) => {
  // Placeholder for a long-running task.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return `An essay about topic: ${topic}`;
});

const workflow = entrypoint(
  { checkpointer: new MemorySaver(), name: "workflow" },
  async (topic: string) => {
    const essay = await writeEssay(topic);
    const isApproved = interrupt({
      // Any JSON-serializable payload. Surfaces as an Interrupt when streaming.
      essay,
      action: "Please approve/reject the essay",
    });

    return {
      essay,
      isApproved,
    };
  }
);
```

使用 `"cat"` 等主题进行调用。跑步写完文章，然后在`interrupt`处暂停。暂停可以无限期地持续。恢复从入口点的开头开始。`writeEssay` 任务结果被恢复，而不是重新计算。

有关流、恢复和工具调用审核的信息，请参阅 [Interrupts](/oss/javascript/langgraph/interrupts)。

## 常见陷阱

### 处理副作用

将副作用（写入文件、发送电子邮件）放入任务中，以便恢复不会再次运行它们。

> [选项卡] 不正确
>
> 文件写入在入口点运行，因此恢复会第二次执行它。
>
> ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { MemorySaver, entrypoint, interrupt } from "@langchain/langgraph";
> import fs from "fs";
>
> const checkpointer = new MemorySaver();
>
> const myWorkflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (inputs: Record<string, any>) => {
>     // Runs again on resume.
>     fs.writeFileSync("output.txt", "Side effect executed");
>     const value = interrupt("question");
>     return value;
>   }
> );
> ```

> [选项卡] 正确
>
> 副作用存在于任务中，因此恢复会恢复检查点结果。
>
> ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { MemorySaver, entrypoint, task, interrupt } from "@langchain/langgraph";
> import * as fs from "fs";
>
> const checkpointer = new MemorySaver();
>
> const writeToFile = task("writeToFile", async () => {
>   fs.writeFileSync("output.txt", "Side effect executed");
> });
>
> const myWorkflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (inputs: Record<string, any>) => {
>     await writeToFile();
>     const value = interrupt("question");
>     return value;
>   }
> );
> ```

### 非确定性控制流

将时间和随机性封装在任务中，以便恢复返回相同的值。

* 在任务中：获取随机数（5）→中断→恢复→（再次返回5）→...
* 不在任务中：获取随机数（5）→中断→恢复→获取新的随机数（7）→...

通过多次 [⟦T38⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用，LangGraph 通过索引**将恢复值与每个中断进行匹配。如果恢复更改了中断的顺序，则恢复值可能会附加到错误的中断。参见[Determinism](#determinism)。

> [选项卡] 不正确
>
> 读取入口点中的时钟可以更改恢复时运行的分支。
>
> ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { MemorySaver, entrypoint, task, interrupt } from "@langchain/langgraph";
>
> const checkpointer = new MemorySaver();
>
> const slowTask = task("slowTask", async (x: number) => x);
>
> const myWorkflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (inputs: { t0: number }) => {
>     const t1 = Date.now();
>
>     const deltaT = t1 - inputs.t0;
>
>     if (deltaT > 1000) {
>       const result = await slowTask(1);
>       const value = interrupt("question");
>       return { result, value };
>     } else {
>       const result = await slowTask(2);
>       const value = interrupt("question");
>       return { result, value };
>     }
>   }
> );
> ```

> [选项卡] 正确
>
> 读取任务内的时钟，以便恢复恢复相同的时间戳和分支。
>
> ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { MemorySaver, entrypoint, task, interrupt } from "@langchain/langgraph";
>
> const checkpointer = new MemorySaver();
>
> const slowTask = task("slowTask", async (x: number) => x);
> const getTime = task("getTime", async () => Date.now());
>
> const myWorkflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (inputs: { t0: number }) => {
>     const t1 = await getTime();
>
>     const deltaT = t1 - inputs.t0;
>
>     if (deltaT > 1000) {
>       const result = await slowTask(1);
>       const value = interrupt("question");
>       return { result, value };
>     } else {
>       const result = await slowTask(2);
>       const value = interrupt("question");
>       return { result, value };
>     }
>   }
> );
> ```

## 了解更多* [Deploy other frameworks](/langsmith/deploy-other-frameworks)
* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Interrupts](/oss/javascript/langgraph/interrupts)
* [Streaming](/oss/javascript/langgraph/streaming)
* [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
* [Memory](/oss/javascript/langgraph/add-memory)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。