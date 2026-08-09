<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Functional API overview | https://docs.langchain.com/oss/python/langgraph/functional-api -->

# 功能 API 概述

**功能 API** 允许您将 LangGraph 的关键功能（[persistence](/oss/python/langgraph/persistence)、[memory](/oss/python/langgraph/add-memory)、[human-in-the-loop](/oss/python/langgraph/interrupts) 和 [streaming](/oss/python/langgraph/streaming)）添加到您的应用程序中，只需对现有代码进行最少的更改。

它旨在将这些功能集成到现有代码中，这些代码可以使用标准语言原语进行分支和控制流，例如`if`语句、`for`循环和函数调用。与许多需要将代码重组为显式管道或 DAG 的数据编排框架不同，功能 API 允许您合并这些功能，而无需强制执行严格的执行模型。

功能 API 使用两个关键构建块：

* **`@entrypoint`**：将函数标记为工作流的起点，封装逻辑并管理执行流程，包括处理长时间运行的任务和中断。
* **[⟦T30⟧](https://reference.langchain.com/python/langgraph/func/task)**：表示可以在入口点内异步执行的离散工作单元，例如 API 调用或数据处理步骤。任务返回一个类似 future 的对象，可以同步等待或解析。

这为构建具有状态管理和流的工作流提供了最小的抽象。<Tip>
  有关如何使用函数式 API 的信息，请参阅[Use Functional API](/oss/python/langgraph/use-functional-api)。
</Tip>

## 函数式 API 与图形 API

对于喜欢更具声明性方法的用户，LangGraph 的 [Graph API](/oss/python/langgraph/graph-api) 允许您使用图形范式定义工作流程。这两个 API 共享相同的底层运行时，因此您可以在同一应用程序中一起使用它们。

以下是一些主要区别：

* **控制流**：Functional API 不需要考虑图形结构。您可以使用标准 Python 结构来定义工作流程。这通常会减少您需要编写的代码量。
* **短期记忆**：**GraphAPI** 需要声明 [**State**](/oss/python/langgraph/graph-api#state) 并且可能需要定义 [**reducers**](/oss/python/langgraph/graph-api#reducers) 来管理图形状态的更新。 `@entrypoint` 和 `@tasks` 不需要显式状态管理，因为它们的状态仅限于函数，并且不会在函数之间共享。
* **检查点**：两个 API 都会生成并使用检查点。在 **Graph API** 中，每个 [superstep](/oss/python/langgraph/graph-api) 后都会生成一个新的检查点。在 **Functional API** 中，执行任务时，其结果将保存到与给定入口点关联的现有检查点，而不是创建新检查点。* **可视化**：图形 API 可以轻松地将工作流程可视化为图形，这对于调试、理解工作流程以及与他人共享非常有用。功能 API 不支持可视化，因为图形是在运行时动态生成的。

## 示例

下面我们演示一个简单的应用程序，它可以写一篇文章和 [interrupts](/oss/python/langgraph/interrupts) 来请求人工审核。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.types import interrupt

@task
def write_essay(topic: str) -> str:
    """Write an essay about the given topic."""
    time.sleep(1) # A placeholder for a long-running task.
    return f"An essay about topic: {topic}"

@entrypoint(checkpointer=InMemorySaver())
def workflow(topic: str) -> dict:
    """A simple workflow that writes an essay and asks for a review."""
    essay = write_essay("cat").result()
    is_approved = interrupt({
        # Any json-serializable payload provided to interrupt as argument.
        # It will be surfaced on the client side as an Interrupt when streaming data
        # from the workflow.
        "essay": essay, # The essay we want reviewed.
        # We can add any additional information that we need.
        # For example, introduce a key called "action" with some instructions.
        "action": "Please approve/reject the essay",
    })

    return {
        "essay": essay, # The essay that was generated
        "is_approved": is_approved, # Response from HIL
    }
```

<Accordion title="Detailed Explanation">
  此工作流程将写一篇关于“猫”主题的文章，然后暂停以获取人类的评论。工作流程可以无限期中断，直到提供审核。

  当工作流恢复时，它会从头开始执行，但由于`writeEssay`任务的结果已经保存，因此任务结果将从检查点加载，而不是重新计算。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import time

  from langchain_core.utils.uuid import uuid7
  from langgraph.checkpoint.memory import InMemorySaver
  from langgraph.func import entrypoint, task
  from langgraph.types import Command, interrupt


  @task
  def write_essay(topic: str) -> str:
      """Write an essay about the given topic."""
      time.sleep(1)  # This is a placeholder for a long-running task.
      return f"An essay about topic: {topic}"


  @entrypoint(checkpointer=InMemorySaver())
  def workflow(topic: str) -> dict:
      """A simple workflow that writes an essay and asks for a review."""
      essay = write_essay("cat").result()
      is_approved = interrupt(
          {
              # Any json-serializable payload provided to interrupt as argument.
              # It will be surfaced on the client side as an Interrupt when streaming data
              # from the workflow.
              "essay": essay,  # The essay we want reviewed.
              # We can add any additional information that we need.
              # For example, introduce a key called "action" with some instructions.
              "action": "Please approve/reject the essay",
          }
      )
      return {
          "essay": essay,  # The essay that was generated
          "is_approved": is_approved,  # Response from HIL
      }


  thread_id = str(uuid7())
  config = {"configurable": {"thread_id": thread_id}}
  stream = workflow.stream_events("cat", config, version="v3")
  _ = stream.output
  print({"write_essay": stream.interrupts[0].value["essay"]})
  print({"__interrupt__": stream.interrupts})
  # {'write_essay': 'An essay about topic: cat'}
  # {
  #   '__interrupt__': [
  #     Interrupt(
  #       value={
  #           'essay': 'An essay about topic: cat',
  #           'action': 'Please approve/reject the essay'
  #       },
  #       id='369d44b3d93d4a631ae583367ac6b5cc'
  #     )
  #   ]
  # }
  ```

  一篇论文已经写好，准备供审阅。一旦提供审核，我们就可以恢复工作流程：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Get review from a user (e.g., via a UI)
  # In this case, we're using a bool, but this can be any json-serializable value.
  human_review = True

  resumed_stream = workflow.stream_events(Command(resume=human_review), config, version="v3")
  print(resumed_stream.output)
  # {'essay': 'An essay about topic: cat', 'is_approved': True}
  ```

  工作流程已完成，评论已添加到论文中。
</Accordion>

## 入口点[⟦T34⟧](https://reference.langchain.com/python/langgraph/func/entrypoint) 装饰器可用于从函数创建工作流。它封装了工作流逻辑并管理执行流，包括处理*长时间运行的任务*和[interrupts](/oss/python/langgraph/interrupts)。

### 定义

**入口点**是通过使用 `@entrypoint` 装饰器装饰函数来定义的。

该函数**必须接受单个位置参数**，用作工作流输入。如果需要传递多条数据，请使用字典作为第一个参数的输入类型。

使用 `entrypoint` 装饰函数会生成 [⟦T37⟧](https://reference.langchain.com/python/langgraph/pregel/#langgraph.pregel.Pregel.stream) 实例，该实例有助于管理工作流的执行（例如，处理流式传输、恢复和检查点）。

您通常需要将 **检查指针** 传递给 `@entrypoint` 装饰器以启用持久性并使用 **人在循环** 等功能。

<Tabs>
  <Tab title="Sync">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.func import entrypoint

    @entrypoint(checkpointer=checkpointer)
    def my_workflow(some_input: dict) -> int:
        # some logic that may involve long-running tasks like API calls,
        # and may be interrupted for human-in-the-loop.
        ...
        return result
    ```
  </Tab>

  <Tab title="Async">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.func import entrypoint

    @entrypoint(checkpointer=checkpointer)
    async def my_workflow(some_input: dict) -> int:
        # some logic that may involve long-running tasks like API calls,
        # and may be interrupted for human-in-the-loop
        ...
        return result
    ```
  </Tab>
</Tabs>

<Warning>
  **序列化**
  入口点的 **输入** 和 **输出** 必须是 JSON 可序列化的才能支持检查点。更多详情请参阅[serialization](#serialization)部分。
</Warning>

### 可注入参数声明 `entrypoint` 时，您可以请求访问将在运行时自动注入的其他参数。这些参数包括：

|参数|描述 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **上一页** |访问与给定线程的前一个 `checkpoint` 关联的状态。参见[short-term-memory](#short-term-memory)。                                               |
| **商店** | \[BaseStore]\[langgraph.store.base.BaseStore] 的实例。对[long-term memory](/oss/python/langgraph/use-functional-api#long-term-memory)有用。                     |
| **作家** |使用异步 Python 时用于访问 StreamWriter \< 3.11. See ⟦T82⟧. |
| **config**   | For accessing run time configuration. See ⟦T83⟧ for information.                           |

<Warning>
  使用适当的名称和类型注释来声明参数。
</Warning>

<Accordion title="Requesting Injectable Parameters">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langchain_core.runnables import RunnableConfig
  from langgraph.func import entrypoint
  from langgraph.store.base import BaseStore
  from langgraph.store.memory import InMemoryStore
  from langgraph.checkpoint.memory import InMemorySaver
  from langgraph.types import StreamWriter

  in_memory_checkpointer = InMemorySaver(...)
  in_memory_store = InMemoryStore(...)  # An instance of InMemoryStore for long-term memory

  @entrypoint(
      checkpointer=in_memory_checkpointer,  # Specify the checkpointer
      store=in_memory_store  # Specify the store
  )
  def my_workflow(
      some_input: dict,  # The input (e.g., passed via `invoke`)
      *,
      previous: Any = None, # For short-term memory
      store: BaseStore,  # For long-term memory
      writer: StreamWriter,  # For streaming custom data
      config: RunnableConfig  # For accessing the configuration passed to the entrypoint
  ) -> ...:
  ```
</Accordion>

### 执行中

使用 [⟦T41⟧](#entrypoint) 会生成 [⟦T42⟧](https://reference.langchain.com/python/langgraph/pregel/#langgraph.pregel.Pregel.stream) 对象，该对象可以使用 `invoke`、`ainvoke`、`stream` 和 `astream` 方法执行。

<Tabs>
  <Tab title="Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }
    my_workflow.invoke(some_input, config)  # Wait for the result synchronously
    ```
  </Tab>

  <Tab title="Async Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }
    await my_workflow.ainvoke(some_input, config)  # Await result asynchronously
    ```
  </Tab><Tab title="Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = my_workflow.stream_events(some_input, config, version="v3")
    for message in stream.messages:
        for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>

  <Tab title="Async Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = await my_workflow.astream_events(some_input, config, version="v3")
    async for message in stream.messages:
        async for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>
</Tabs>

### 恢复

在 [interrupt](https://reference.langchain.com/python/langgraph/types/interrupt) 之后恢复执行可以通过将 **resume** 值传递给 [⟦T47⟧](https://reference.langchain.com/python/langgraph/types/Command) 原语来完成。

<Tabs>
  <Tab title="Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    my_workflow.invoke(Command(resume=some_resume_value), config)
    ```
  </Tab>

  <Tab title="Async Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    await my_workflow.ainvoke(Command(resume=some_resume_value), config)
    ```
  </Tab>

  <Tab title="Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = my_workflow.stream_events(Command(resume=some_resume_value), config, version="v3")
    for message in stream.messages:
        for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>

  <Tab title="Async Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = await my_workflow.astream_events(Command(resume=some_resume_value), config, version="v3")
    async for message in stream.messages:
        async for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>
</Tabs>

**发生错误后恢复**

要在错误后恢复，请使用 `None` 和相同的 **线程 id** （配置）运行 `entrypoint`。

这假设底层的**错误**已得到解决并且执行可以成功进行。

<Tabs>
  <Tab title="Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    my_workflow.invoke(None, config)
    ```
  </Tab>

  <Tab title="Async Invoke">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    await my_workflow.ainvoke(None, config)
    ```
  </Tab>

  <Tab title="Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = my_workflow.stream_events(None, config, version="v3")
    for message in stream.messages:
        for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>

  <Tab title="Async Stream">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}

    config = {
        "configurable": {
            "thread_id": "some_thread_id"
        }
    }

    stream = await my_workflow.astream_events(None, config, version="v3")
    async for message in stream.messages:
        async for token in message.text:
            print(token, end="", flush=True)
    ```
  </Tab>
</Tabs>

### 短期记忆

当使用`checkpointer`定义`entrypoint`时，它将在[checkpoints](/oss/python/langgraph/checkpointers#checkpoints)中存储同一**线程id**上的连续调用之间的信息。

这允许使用 `previous` 参数访问先前调用的状态。

默认情况下，`previous`参数是上一次调用的返回值。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@entrypoint(checkpointer=checkpointer)
def my_workflow(number: int, *, previous: Any = None) -> int:
    previous = previous or 0
    return number + previous

config = {
    "configurable": {
        "thread_id": "some_thread_id"
    }
}

my_workflow.invoke(1, config)  # 1 (previous was None)
my_workflow.invoke(2, config)  # 3 (previous was 1 from the previous invocation)
```

#### `entrypoint.final`

[⟦T55⟧](https://reference.langchain.com/python/langgraph/func/entrypoint/final) 是一个特殊的原语，可以从入口点返回，并允许将检查点中保存的值与入口点的返回值**解耦**。第一个值是入口点的返回值，第二个值是将保存在检查点中的值。类型注释是`entrypoint.final[return_type, save_type]`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@entrypoint(checkpointer=checkpointer)
def my_workflow(number: int, *, previous: Any = None) -> entrypoint.final[int, int]:
    previous = previous or 0
    # This will return the previous value to the caller, saving
    # 2 * number to the checkpoint, which will be used in the next invocation
    # for the `previous` parameter.
    return entrypoint.final(value=previous, save=2 * number)

config = {
    "configurable": {
        "thread_id": "1"
    }
}

my_workflow.invoke(3, config)  # 0 (previous was None)
my_workflow.invoke(1, config)  # 6 (previous was 3 * 2 from the previous invocation)
```

## 任务

**任务**代表一个离散的工作单元，例如 API 调用或数据处理步骤。它有两个关键特征：

* **异步执行**：任务被设计为异步执行，允许多个操作同时运行而不会阻塞。
* **检查点**：任务结果保存到检查点，从而可以从上次保存的状态恢复工作流程。 （更多详情请参见[persistence](/oss/python/langgraph/persistence)）。

### 定义

任务是使用 `@task` 装饰器定义的，它包装了常规的 Python 函数。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.func import task

@task()
def slow_computation(input_value):
    # Simulate a long-running operation
    ...
    return result
```

<Warning>
  **序列化**
  任务的 **输出** 必须是 JSON 可序列化的以支持检查点。
</Warning>

### 执行

**任务**只能从**入口点**、另一个**任务**或[state graph node](/oss/python/langgraph/graph-api#nodes)内调用。

任务*不能*直接从主应用程序代码调用。

当您调用 **任务** 时，它会“立即”返回一个 future 对象。未来是稍后可用的结果的占位符。要获取**任务**的结果，您可以同步等待（使用`result()`）或异步等待（使用`await`）。

<Tabs>
  <Tab title="Synchronous Invocation">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @entrypoint(checkpointer=checkpointer)
    def my_workflow(some_input: int) -> int:
        future = slow_computation(some_input)
        return future.result()  # Wait for the result synchronously
    ```
  </Tab>

  <Tab title="Asynchronous Invocation">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @entrypoint(checkpointer=checkpointer)
    async def my_workflow(some_input: int) -> int:
        return await slow_computation(some_input)  # Await result asynchronously
    ```
  </Tab>
</Tabs>

## 何时使用任务

**任务**在以下场景中很有用：

* **检查点**：当您需要将长时间运行的操作的结果保存到检查点时，以便在恢复工作流程时不需要重新计算它。
* **人机交互**：如果您正在构建需要人工干预的工作流程，则必须使用 **任务** 来封装任何随机性（例如 API 调用），以确保工作流程可以正确恢复。有关更多详细信息，请参阅[determinism](#determinism)部分。
* **并行执行**：对于 I/O 密集型任务，**任务** 启用并行执行，允许多个操作同时运行而不会阻塞（例如，调用多个 API）。
* **可观察性**：将操作包装在**任务**中提供了一种跟踪工作流程进度并使用[LangSmith](/langsmith/observability)监控各个操作执行情况的方法。* **可重试工作**：当工作需要重试来处理失败或不一致时，**任务**提供了一种封装和管理重试逻辑的方法。

## 序列化

LangGraph 中的序列化有两个关键方面：

1. `entrypoint` 输入和输出必须是 JSON 可序列化的。
2. `task` 输出必须是 JSON 可序列化的。

这些要求对于启用检查点和工作流程恢复是必要的。使用字典、列表、字符串、数字和布尔值等 Python 基元来确保输入和输出可序列化。

序列化可确保工作流状态（例如任务结果和中间值）能够可靠地保存和恢复。这对于实现人机交互、容错和并行执行至关重要。

当工作流配置了检查点时，提供不可序列化的输入或输出将导致运行时错误。

## 决定论

当您恢复工作流运行时，代码**不会**从执行停止的**同一行代码**恢复。执行返回到检查点边界，并且工作流向前**重播**，直到再次达到暂停为止。对于Functional API，重播从**入口点**的开头开始，而LangGraph从检查点恢复已完成的[**task**](/oss/python/langgraph/functional-api#task)和[**subgraph**](/oss/python/langgraph/use-subgraphs)结果，而不是重新计算它们。这保留了暂停期间记录的步骤顺序，包括长时间运行或不确定的**任务**输出。

要使用诸如**人机交互**之类的功能，您必须将非确定性工作（例如随机值）和副作用（例如文件写入或 API 调用）放入 [**tasks**](/oss/python/langgraph/functional-api#task) 中。

工作流的不同运行可能会产生不同的结果，但恢复**特定**线程应该重播相同的持久**任务**和**子图**结果。

为了确保您的工作流程具有确定性并且可以一致地重播，请遵循以下准则：* **避免重复工作**：在**入口点**中，如果您链​​接多个副作用（例如，日志记录、文件写入或网络调用），请为每个副作用提供自己的**任务**，以便恢复从检查点恢复其输出，而不是再次运行它们。
* **封装非确定性操作**：将尝试之间可能发生变化的值（例如，随机数或挂钟读取）保留在**任务**内，以便重播与检查点的内容保持一致。
* **使用幂等操作**：部分任务失败和重试请参见[Idempotency](#idempotency)。

## 幂等性幂等性确保多次运行相同的操作会产生相同的结果。如果某个步骤因失败而重新运行，这有助于防止重复的 API 调用和冗余处理。始终将 API 调用放置在 **tasks** 函数中以进行检查点，并将它们设计为在重新执行时具有幂等性。
这对于导致数据写入的操作尤其重要。
当工作流程恢复时，LangGraph 会重播检查点中已完成的**任务**结果。已开始但未完成的**任务**可能会在该简历上再次运行，因此将副作用设计为幂等的。使用幂等性密钥或验证现有结果以避免意外重复。

## 常见陷阱

### 处理副作用

将副作用（例如，写入文件、发送电子邮件）封装在任务中，以确保在恢复工作流程时不会多次执行它们。

<Tabs>
  <Tab title="Incorrect">
    在本例中，副作用（写入文件）直接包含在工作流中，因此在恢复工作流时将再次执行。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @entrypoint(checkpointer=checkpointer)
    def my_workflow(inputs: dict) -> int:
        # This code will be executed a second time when resuming the workflow.
        # Which is likely not what you want.
        with open("output.txt", "w") as f:  # [!code highlight]
            f.write("Side effect executed")  # [!code highlight]
        value = interrupt("question")
        return value
    ```
  </Tab>

  <Tab title="Correct">
    在此示例中，副作用被封装在任务中，确保恢复时执行的一致性。```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.func import task

    @task  # [!code highlight]
    def write_to_file():  # [!code highlight]
        with open("output.txt", "w") as f:
            f.write("Side effect executed")

    @entrypoint(checkpointer=checkpointer)
    def my_workflow(inputs: dict) -> int:
        # The side effect is now encapsulated in a task.
        write_to_file().result()
        value = interrupt("question")
        return value
    ```
  </Tab>
</Tabs>

### 非确定性控制流

每次可能给出不同结果的操作（例如获取当前时间或随机数）应封装在任务中，以确保在恢复时返回相同的结果。

* 在任务中：获取随机数（5）→中断→恢复→（再次返回5）→...
* 不在任务中：获取随机数（5）→中断→恢复→获取新的随机数（7）→...

当使用带有多个中断调用的**人机交互**工作流程时，这一点尤其重要。 LangGraph 保留每个任务/入口点的恢复值列表。当遇到中断时，它会与相应的恢复值相匹配。这种匹配严格**基于索引**，因此恢复值的顺序应与中断的顺序匹配。

如果恢复时不保持执行顺序，则一次[⟦T62⟧](https://reference.langchain.com/python/langgraph/types/interrupt)调用可能会与错误的`resume`值匹配，从而导致不正确的结果。

请阅读[determinism](#determinism)部分了解更多详情。<Tabs>
  <Tab title="Incorrect">
    在此示例中，工作流使用当前时间来确定要执行哪个任务。这是不确定的，因为工作流的结果取决于它的执行时间。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.func import entrypoint

    @entrypoint(checkpointer=checkpointer)
    def my_workflow(inputs: dict) -> int:
        t0 = inputs["t0"]
        t1 = time.time()  # [!code highlight]

        delta_t = t1 - t0

        if delta_t > 1:
            result = slow_task(1).result()
            value = interrupt("question")
        else:
            result = slow_task(2).result()
            value = interrupt("question")

        return {
            "result": result,
            "value": value
        }
    ```
  </Tab>

  <Tab title="Correct">
    在此示例中，工作流使用输入 `t0` 来确定要执行哪个任务。这是确定性的，因为工作流的结果仅取决于输入。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import time

    from langgraph.func import task

    @task  # [!code highlight]
    def get_time() -> float:  # [!code highlight]
        return time.time()

    @entrypoint(checkpointer=checkpointer)
    def my_workflow(inputs: dict) -> int:
        t0 = inputs["t0"]
        t1 = get_time().result()  # [!code highlight]

        delta_t = t1 - t0

        if delta_t > 1:
            result = slow_task(1).result()
            value = interrupt("question")
        else:
            result = slow_task(2).result()
            value = interrupt("question")

        return {
            "result": result,
            "value": value
        }
    ```
  </Tab>
</Tabs>

## 了解更多

* [How to use the Functional API](/oss/python/langgraph/use-functional-api)
* [Graph API conceptual overview](/oss/python/langgraph/graph-api)
* [Choosing between Graph API and Functional API](/oss/python/langgraph/choosing-apis)

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>