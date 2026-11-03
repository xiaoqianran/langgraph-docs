<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Functional API overview | https://docs.langchain.com/oss/python/langgraph/functional-api -->

# 功能 API 概述

了解功能 API 入口点和任务、检查点和重放的工作原理以及如何避免常见的恢复陷阱。

**函数式 API** 在普通函数的基础上添加了 LangGraph 功能（[persistence](/oss/python/langgraph/persistence)、[memory](/oss/python/langgraph/add-memory)、[human-in-the-loop](/oss/python/langgraph/interrupts) 和 [streaming](/oss/python/langgraph/streaming)）。使用标准语言控制流（`if` / `else`、循环和函数调用）而不是声明节点和边的图。

此页面是入口点、任务、检查点和恢复规则的概念参考。有关设计演练，请参阅[Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)。对于有序的构建路径，请参阅[Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)。

功能 API 使用两个构建块：

* **`@entrypoint`**：将函数标记为工作流程的开始。它管理执行、中断和检查点。
* **`@task`**：标记离散的工作单元（例如，API 调用）。任务返回一个类似 future 的对象，您可以使用 `.result()` 等待或解析该对象。

## 函数式 API 与图形 API

如果您已经选择了功能 API，则此比较是可选的。有关并行决策指南，请参阅[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)。这两个 API 共享相同的底层运行时，因此您可以在同一应用程序中一起使用它们。

高层差异：* **控制流**：功能 API 使用标准语言结构。 [Graph API](/oss/python/langgraph/graph-api) 使用节点和边。
* **状态**：Graph API 需要声明 [state](/oss/python/langgraph/graph-api#state)，并且通常需要声明 [reducers](/oss/python/langgraph/graph-api#reducers)。功能 API 将状态范围保持在函数范围内：任务将值作为返回值传递，没有共享状态模式。
* **检查点**：每个 [super-step](/oss/python/langgraph/graph-api#super-steps) 之后的 Graph API 检查点。功能 API 将任务结果保存到入口点检查点。
* **可视化**：Graph API 支持图表。功能 API 则不然，因为图表是在运行时构建的。

## 入口点

`@entrypoint` 装饰器从函数创建工作流程。它管理长时间运行的工作和[interrupts](/oss/python/langgraph/interrupts)。

### 定义

当您需要坚持或人在循环中时，请通过[checkpointer](/oss/python/langgraph/persistence)。在配置中使用 `thread_id` 标识每次运行。线程是一次对话或工作流程运行的持久标识。

**入口点**是一个用 `@entrypoint` 修饰的函数。

该函数**必须接受单个位置参数**作为工作流程输入。要传递多个值，请使用字典（或类似的）作为该参数。

装饰该函数会生成一个工作流对象（一个 [⟦T19⟧](https://reference.langchain.com/python/langgraph/pregel/#langgraph.pregel.Pregel.stream) 实例）。调用`invoke`或`ainvoke`来运行它。

> [选项卡] 同步
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
>
> checkpointer = InMemorySaver()
>
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(name: str) -> str:
>     return f"Hello, {name}"
>
>
> config = {"configurable": {"thread_id": "1"}}
> my_workflow.invoke("Alice", config)  # "Hello, Alice"
> ```> [选项卡] 异步
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import asyncio
>
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
>
> checkpointer = InMemorySaver()
>
>
> @entrypoint(checkpointer=checkpointer)
> async def my_workflow(name: str) -> str:
>     return f"Hello, {name}"
>
>
> config = {"configurable": {"thread_id": "1"}}
> asyncio.run(my_workflow.ainvoke("Alice", config))  # "Hello, Alice"
> ```

> [!警告]
>
> **序列化**
> 配置检查点时，入口点 **输入** 和 **输出** 必须是 JSON 可序列化的。参见[Serialization](#serialization)。

### 运行并恢复

致电`invoke`或`ainvoke`获取最终结果。对于流，请参阅[Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)。

通过在 [⟦T25⟧](https://reference.langchain.com/python/langgraph/types/Command) 中传递恢复值，在 [⟦T24⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 后恢复。有关食谱，请参阅[Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)。

发生错误后，用 `None` 恢复相同的 `thread_id`。参见[Resume after an error](/oss/python/langgraph/functional-api-tasks#resume-after-an-error)。

### 短期记忆

当 `entrypoint` 具有 `checkpointer` 时，对同一 **线程 id** 的连续调用会将状态存储在 [checkpoints](/oss/python/langgraph/checkpointers#checkpoints) 中。

添加仅关键字 `previous` 参数。 LangGraph 将其设置为该线程上保存的最后一个值。第一次运行时是`None`。要为下次运行保存不同的值，请使用 [⟦T32⟧](https://reference.langchain.com/python/langgraph/func/entrypoint/final)。参见[Return a different saved value](/oss/python/langgraph/functional-api-memory#return-a-different-saved-value)。

关于累积和检查检查点，请参阅[Save state on a thread](/oss/python/langgraph/functional-api-memory#save-state-on-a-thread)。

### 可注入参数

您可以跳过此步骤，直到添加 [memory](/oss/python/langgraph/functional-api-memory) 或 [custom streaming](/oss/python/langgraph/functional-api-streaming)。

声明 `entrypoint` 时，您可以请求 LangGraph 在运行时注入的附加参数：|参数|描述 |
| - | - |
| **上一页** |同一线程上一次调用的返回值（需要检查指针）。参见[short-term memory](/oss/python/langgraph/functional-api-memory#save-state-on-a-thread)。 |
| **配置** |具有运行时配置值的 [⟦T34⟧](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig) 对象。 |
| **商店** | [long-term memory](/oss/python/langgraph/functional-api-memory#save-facts-across-threads) 的 [⟦T35⟧](https://reference.langchain.com/python/langchain-core/stores/BaseStore) 实例。也可用作 `runtime.store`。 |
| **作家** |用于自定义流媒体的`StreamWriter`。也可用作 `runtime.stream_writer`。参见[Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)。 |
| **运行时** |当前运行的[⟦T39⟧](https://reference.langchain.com/python/langgraph/runtime/Runtime)对象，包括上下文、存储和编写器。 |

> [!警告]
>
> 使用适当的名称和类型注释来声明可注入参数。

> [accordion] 请求可注入参数
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from typing import Any
>
> from langchain_core.runnables import RunnableConfig
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
> from langgraph.runtime import Runtime
> from langgraph.store.memory import InMemoryStore
>
> checkpointer = InMemorySaver()
> store = InMemoryStore()
>
>
> @entrypoint(
>     checkpointer=checkpointer,
>     store=store,
> )
> def my_workflow(
>     some_input: dict,  # The input (for example, passed via `invoke`)
>     *,
>     previous: Any = None,  # Short-term memory from the previous invocation
>     config: RunnableConfig,  # Run-time configuration
>     runtime: Runtime,  # Context, store, and writer for the current run
> ) -> dict:
>     memory_store = runtime.store
>     writer = runtime.stream_writer
>     return {
>         "previous": previous,
>         "some_input": some_input,
>         "has_store": memory_store is not None,
>         "has_writer": writer is not None,
>         "thread_id": config["configurable"]["thread_id"],
>     }
> ```

## 任务

**任务**是一个离散的工作单元（例如，API 调用或数据步骤）。任务有两个关键属性：

* **并发执行**：调用任务会立即启动它。仅当您等待结果时，入口点才会阻塞，因此独立任务可以重叠。
* **检查点**：保存任务结果，以便恢复可以恢复它们。参见[persistence](/oss/python/langgraph/persistence)。

### 定义

使用 `@task` 装饰器定义任务：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.func import task


@task
def slow_computation(input_value: int) -> int:
    # Long-running or side-effecting work
    return input_value * 2
```

> [!警告]
>
> **序列化**：任务 **输出** 必须可 JSON 序列化以支持检查点。

＃＃＃ 执行仅从**入口点**、另一个**任务**或[Graph API node](/oss/python/langgraph/graph-api#nodes)调用**任务**。不要从工作流程之外的应用程序代码调用它们。

调用任务会立即返回 future。使用`.result()`（同步）或`await`（异步）解决它。

> [选项卡] 同步
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
>
> checkpointer = InMemorySaver()
>
>
> @task
> def slow_computation(input_value: int) -> int:
>     return input_value * 2
>
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(some_input: int) -> int:
>     future = slow_computation(some_input)
>     return future.result()
> ```

> [选项卡] 异步
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
>
> checkpointer = InMemorySaver()
>
>
> @task
> async def slow_computation(input_value: int) -> int:
>     return input_value * 2
>
>
> @entrypoint(checkpointer=checkpointer)
> async def my_workflow(some_input: int) -> int:
>     return await slow_computation(some_input)
> ```

### 何时使用任务

当您需要时使用**任务**：

* **检查点**：保存长时间运行的结果，以便恢复时不会重新计算它。
* **人机交互**：在任务暂停后结束不应重做的工作，例如 LLM 通话。待[interrupt](/oss/python/langgraph/interrupts)恢复结果后继续。对于随机性，请参阅[Determinism](#determinism)。
* **并行执行**：同时运行独立的 I/O 密集型工作。
* **可观察性**：跟踪[LangSmith](/langsmith/observability)中的离散步骤。
* **重试**：将重试策略应用于离散的工作单元。参见[Configure Functional API tasks](/oss/python/langgraph/functional-api-tasks)。

## 恢复和检查点

恢复重放取决于序列化、确定性和幂等性。

### 序列化

配置检查指针时适用两条规则：

1. `entrypoint` 输入和输出必须是 JSON 可序列化的。
2. `task` 输出必须是 JSON 可序列化的。

使用 Python 原语，例如字典、列表、字符串、数字和布尔值。序列化使任务结果和中间值可恢复，以实现人机交互、容错和并行执行。配置检查指针时，不可序列化的值会引发运行时错误。

### 决定论

恢复**不**从执行停止的确切行继续。执行返回到检查点边界并向前**重播**，直到再次遇到暂停。

对于功能 API，重播从 **入口点** 的开头开始。 LangGraph 从检查点恢复已完成的 [**task**](#task) 和 [**subgraph**](/oss/python/langgraph/use-subgraphs) 结果，而不是重新计算它们。这可以保留暂停期间的步骤顺序，包括长时间运行或不确定的**任务**输出。

对于**人机交互**，将非确定性工作（例如随机值）和副作用（例如文件写入或 API 调用）放入 [**tasks**](#task) 中。

不同的运行可以产生不同的结果。恢复**特定**线程应该重播相同的持久**任务**和**子图**结果。

指南：* **避免重复工作**：为入口点中的每个副作用赋予其自己的**任务**，以便恢复恢复输出而不是重新运行它们。
* **封装非确定性操作**：将尝试之间变化的值（随机数、挂钟时间）保留在**任务**内。
* **使用幂等操作**：部分失败和重试请参见[Idempotency](#idempotency)。

### 幂等性

幂等性意味着多次运行相同的操作与运行一次具有相同的效果。将 API 调用和其他写入放入 **任务** 中，并将这些任务设计为在再次运行时是安全的。

恢复时，LangGraph 恢复已完成的**任务**结果。已启动但未完成的**任务**可能会再次运行，因此请在写入之前使用幂等键或检查现有结果。

## 暂停以供人工审核

此工作流程编写一篇文章和 [interrupts](/oss/python/langgraph/interrupts) 供人工审阅：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.types import interrupt


@task
def write_essay(topic: str) -> str:
    """Write an essay about the given topic."""
    time.sleep(1)  # Placeholder for a long-running task.
    return f"An essay about topic: {topic}"


@entrypoint(checkpointer=InMemorySaver())
def workflow(topic: str) -> dict:
    """Write an essay and pause for review."""
    essay = write_essay(topic).result()
    is_approved = interrupt({
        # Any JSON-serializable payload. Surfaces as an Interrupt when streaming.
        "essay": essay,
        "action": "Please approve/reject the essay",
    })

    return {
        "essay": essay,
        "is_approved": is_approved,
    }
```

使用 `"cat"` 等主题进行调用。跑步写完文章，然后在`interrupt`处暂停。暂停可以无限期地持续。恢复从入口点的开头开始。

`write_essay`任务结果被恢复，而不是重新计算。

有关流、恢复和工具调用审核的信息，请参阅 [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)。

## 常见陷阱

### 处理副作用将副作用（写入文件、发送电子邮件）放入任务中，以便恢复不会再次运行它们。

> [选项卡] 不正确
>
> 文件写入在入口点运行，因此恢复会第二次执行它。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
> from langgraph.types import interrupt
>
> checkpointer = InMemorySaver()
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(inputs: dict) -> int:
>     # Runs again on resume.
>     with open("output.txt", "w") as f:  # [!code highlight]
>         f.write("Side effect executed")  # [!code highlight]
>     value = interrupt("question")
>     return value
> ```

> [选项卡] 正确
>
> 副作用存在于任务中，因此恢复会恢复检查点结果。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
> from langgraph.types import interrupt
>
> checkpointer = InMemorySaver()
>
> @task  # [!code highlight]
> def write_to_file() -> None:  # [!code highlight]
>     with open("output.txt", "w") as f:
>         f.write("Side effect executed")
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(inputs: dict) -> int:
>     write_to_file().result()
>     value = interrupt("question")
>     return value
> ```

### 非确定性控制流

将时间和随机性封装在任务中，以便恢复返回相同的值。

* 在任务中：获取随机数（5）→中断→恢复→（再次返回5）→...
* 不在任务中：获取随机数（5）→中断→恢复→获取新的随机数（7）→...

通过多次 [⟦T48⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用，LangGraph 通过索引**将恢复值与每个中断进行匹配。如果恢复更改了中断的顺序，则恢复值可能会附加到错误的中断。参见[Determinism](#determinism)。

> [选项卡] 不正确
>
> 读取入口点中的时钟可以更改恢复时运行的分支。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import time
>
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
> from langgraph.types import interrupt
>
> checkpointer = InMemorySaver()
>
> @task
> def slow_task(x: int) -> int:
>     return x
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(inputs: dict) -> dict:
>     t0 = inputs["t0"]
>     t1 = time.time()  # [!code highlight]
>
>     delta_t = t1 - t0
>
>     if delta_t > 1:
>         result = slow_task(1).result()
>         value = interrupt("question")
>     else:
>         result = slow_task(2).result()
>         value = interrupt("question")
>
>     return {"result": result, "value": value}
> ```

> [选项卡] 正确
>
> 读取任务内的时钟，以便恢复恢复相同的时间戳和分支。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import time
>
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
> from langgraph.types import interrupt
>
> checkpointer = InMemorySaver()
>
> @task
> def slow_task(x: int) -> int:
>     return x
>
> @task  # [!code highlight]
> def get_time() -> float:  # [!code highlight]
>     return time.time()
>
> @entrypoint(checkpointer=checkpointer)
> def my_workflow(inputs: dict) -> dict:
>     t0 = inputs["t0"]
>     t1 = get_time().result()  # [!code highlight]
>
>     delta_t = t1 - t0
>
>     if delta_t > 1:
>         result = slow_task(1).result()
>         value = interrupt("question")
>     else:
>         result = slow_task(2).result()
>         value = interrupt("question")
>
>     return {"result": result, "value": value}
> ```

## 了解更多

* [Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Compose Functional API workflows](/oss/python/langgraph/functional-api-workflows)
* [Configure Functional API tasks](/oss/python/langgraph/functional-api-tasks)
* [Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)
* [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)
* [Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)
* [Graph API overview](/oss/python/langgraph/graph-api)
* [Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。