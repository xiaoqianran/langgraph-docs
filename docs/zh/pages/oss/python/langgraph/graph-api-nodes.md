<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Configure nodes | https://docs.langchain.com/oss/python/langgraph/graph-api-nodes -->

# 配置节点

添加运行时配置、重试策略、超时、错误处理、默认值和缓存到 LangGraph 节点。

[Nodes](/oss/python/langgraph/graph-api#nodes)是Graph API图的步骤。本页介绍了添加节点时如何附加运行时配置、重试、超时、错误处理程序、默认值和缓存。有关将节点连接到序列、分支和循环中的信息，请参阅[Control flow](/oss/python/langgraph/graph-api-control-flow)。有关完整的重试、超时和错误生命周期，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance)。

## 添加运行时配置

将值传递到运行中（例如，LLM 或系统提示使用哪个），而不将这些值置于图形状态。

添加运行时配置：

1. 指定配置的架构
2. 将配置添加到节点或条件边的函数签名中
3. 将配置传递到图中

请参阅下面的简单示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END, StateGraph, START
from langgraph.runtime import Runtime
from typing_extensions import TypedDict

# 1. Specify config schema
class ContextSchema(TypedDict):
    my_runtime_value: str

# 2. Define a graph that accesses the config in a node
class State(TypedDict):
    my_state_value: int

def node(state: State, runtime: Runtime[ContextSchema]):  # [!code highlight]
    if runtime.context["my_runtime_value"] == "a":  # [!code highlight]
        return {"my_state_value": 1}
    elif runtime.context["my_runtime_value"] == "b":  # [!code highlight]
        return {"my_state_value": 2}
    else:
        raise ValueError("Unknown values.")

builder = StateGraph(State, context_schema=ContextSchema)  # [!code highlight]
builder.add_node(node)
builder.add_edge(START, "node")
builder.add_edge("node", END)

graph = builder.compile()

# 3. Pass in configuration at runtime:
print(graph.invoke({}, context={"my_runtime_value": "a"}))  # [!code highlight]
print(graph.invoke({}, context={"my_runtime_value": "b"}))  # [!code highlight]
```

```
{'my_state_value': 1}
{'my_state_value': 2}
```

> [accordion] 扩展示例：在运行时指定LLM
>
> 在调用时选择OpenAI 或Anthropic。这些示例调用实时提供程序并需要 API 密钥。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from dataclasses import dataclass
>
> from langchain.chat_models import init_chat_model
> from langgraph.graph import MessagesState, END, StateGraph, START
> from langgraph.runtime import Runtime
>
> @dataclass
> class ContextSchema:
>     model_provider: str = "anthropic"
>
> MODELS = {
>     "anthropic": init_chat_model("claude-haiku-4-5-20251001"),
>     "openai": init_chat_model("gpt-5.4-mini"),
> }
>
> def call_model(state: MessagesState, runtime: Runtime[ContextSchema]):
>     model = MODELS[runtime.context.model_provider]
>     response = model.invoke(state["messages"])
>     return {"messages": [response]}
>
> builder = StateGraph(MessagesState, context_schema=ContextSchema)
> builder.add_node("model", call_model)
> builder.add_edge(START, "model")
> builder.add_edge("model", END)
>
> graph = builder.compile()
>
> # Usage
> input_message = {"role": "user", "content": "hi"}
> # With no configuration, uses default (Anthropic)
> response_1 = graph.invoke({"messages": [input_message]}, context=ContextSchema())["messages"][-1]
> # Or, can set OpenAI
> response_2 = graph.invoke({"messages": [input_message]}, context={"model_provider": "openai"})["messages"][-1]
>
> print(response_1.response_metadata["model_name"])
> print(response_2.response_metadata["model_name"])
> ```
>
> ```
> claude-haiku-4-5-20251001
> gpt-5.4-mini
> ```> [accordion] 扩展示例：运行时指定模型和系统消息
>
> 在调用时配置模型提供程序和系统消息。这些示例调用实时提供程序并需要 API 密钥。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from dataclasses import dataclass
> from langchain.chat_models import init_chat_model
> from langchain.messages import SystemMessage
> from langgraph.graph import END, MessagesState, StateGraph, START
> from langgraph.runtime import Runtime
>
> @dataclass
> class ContextSchema:
>     model_provider: str = "anthropic"
>     system_message: str | None = None
>
> MODELS = {
>     "anthropic": init_chat_model("claude-haiku-4-5-20251001"),
>     "openai": init_chat_model("gpt-5.4-mini"),
> }
>
> def call_model(state: MessagesState, runtime: Runtime[ContextSchema]):
>     model = MODELS[runtime.context.model_provider]
>     messages = state["messages"]
>     if (system_message := runtime.context.system_message):
>         messages = [SystemMessage(system_message)] + messages
>     response = model.invoke(messages)
>     return {"messages": [response]}
>
> builder = StateGraph(MessagesState, context_schema=ContextSchema)
> builder.add_node("model", call_model)
> builder.add_edge(START, "model")
> builder.add_edge("model", END)
>
> graph = builder.compile()
>
> # Usage
> input_message = {"role": "user", "content": "hi"}
> response = graph.invoke({"messages": [input_message]}, context={"model_provider": "openai", "system_message": "Respond in Italian."})
> for message in response["messages"]:
>     message.pretty_print()
> ```
>
> ```
> ================================ Human Message ================================
>
> hi
> ================================== Ai Message ==================================
>
> Ciao! Come posso aiutarti oggi?
> ```

## 添加重试策略

当节点调用可能暂时失败的 API、数据库或 LLM 时，附加重试策略。

通过`retry_policy`到[⟦T17⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)。该值是一个 `RetryPolicy` 命名元组。此示例使用默认值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy

builder.add_node(
    "node_name",
    node_function,
    retry_policy=RetryPolicy(),
)
```

默认情况下，`retry_on`使用`default_retry_on`，它会重试除以下情况之外的任何异常：

* `ValueError`
* `TypeError`
* `ArithmeticError`
* `ImportError`
* `LookupError`
* `NameError`
* `SyntaxError`
* `RuntimeError`
* `ReferenceError`
* `StopIteration`
* `StopAsyncIteration`
* `OSError`

对于流行 HTTP 库（例如 `requests` 和 `httpx`）的异常，它仅重试 5xx 状态代码。有关完整的默认列表和参数，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance#retries)。

> [accordion]扩展示例：自定义重试策略
>
> 这些片段展示了如何附加不同的重试策略。他们不创建数据库表或调用图形。
>
> 将不同的重试策略传递给模型节点和 SQL 节点：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import sqlite3
> from langchain.chat_models import init_chat_model
> from langgraph.graph import END, MessagesState, StateGraph, START
> from langgraph.types import RetryPolicy
> from langchain.messages import AIMessage
>
> con = sqlite3.connect(":memory:")
> model = init_chat_model("claude-haiku-4-5-20251001")
>
> def query_database(state: MessagesState):
>     cursor = con.cursor()
>     cursor.execute("SELECT * FROM Artist LIMIT 10;")
>     query_result = str(cursor.fetchall())
>     return {"messages": [AIMessage(content=query_result)]}
>
> def call_model(state: MessagesState):
>     response = model.invoke(state["messages"])
>     return {"messages": [response]}
>
> # Define a new graph
> builder = StateGraph(MessagesState)
> builder.add_node(
>     "query_database",
>     query_database,
>     retry_policy=RetryPolicy(retry_on=sqlite3.OperationalError),
> )
> builder.add_node("model", call_model, retry_policy=RetryPolicy(max_attempts=5))
> builder.add_edge(START, "model")
> builder.add_edge("model", "query_database")
> builder.add_edge("query_database", END)
> graph = builder.compile()
> ```

## 设置节点超时

> [!注意]
>
> 需要`langgraph>=1.2`。将 `timeout` 传递给 [⟦T37⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 以限制单个异步节点尝试可以运行的时间。使用数字（秒）、`datetime.timedelta` 或 [⟦T39⟧](https://reference.langchain.com/python/langgraph/types/TimeoutPolicy) 来表示单独的运行和空闲限制：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import asyncio
from typing_extensions import TypedDict

from langgraph.errors import NodeTimeoutError
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    value: str


async def call_model(state: State) -> State:
    await asyncio.sleep(2)
    return {"value": "done"}


builder = StateGraph(State)
builder.add_node("model", call_model, timeout=1.0)
# Or: timeout=TimeoutPolicy(run_timeout=120, idle_timeout=30)
builder.add_edge(START, "model")
builder.add_edge("model", END)
graph = builder.compile()


async def main():
    try:
        await graph.ainvoke({"value": "start"})
    except NodeTimeoutError:
        print("Node timed out")


asyncio.run(main())
```

节点超时仅适用于 **异步** 节点。在同步节点上设置 `timeout` 在编译时会失败，因为无法在进程中安全地取消同步 Python 执行。对于单独的运行和空闲限制，请传递[⟦T41⟧](https://reference.langchain.com/python/langgraph/types/TimeoutPolicy)。

当节点超过其超时时，LangGraph将引发[⟦T42⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError)。它**不**内置 `TimeoutError` 子类（`OSError` 子类），因此当设置 `retry_policy` 时，默认重试策略将其视为可重试。超时独立地应用于每次尝试，因此计时器会在每次重试时重置。超时尝试不会提交缓冲写入。

有关完整超时生命周期、空闲超时刷新源和 `runtime.heartbeat()`，请参阅 [Fault tolerance](/oss/python/langgraph/fault-tolerance#timeouts)。

## 处理节点错误

> [!注意]
>
> 需要`langgraph>=1.2`。

将 `error_handler` 传递给 [⟦T49⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 以在节点发生故障并且所有重试都用尽后运行函数。处理程序接收当前状态和类型化的[⟦T50⟧](https://reference.langchain.com/python/langgraph/errors/NodeError)，并且可以通过[⟦T51⟧](https://reference.langchain.com/python/langgraph/types/Command)路由到恢复分支：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError
from langgraph.types import Command, RetryPolicy

def payment_error_handler(state: State, error: NodeError) -> Command:
    return Command(
        update={"status": f"compensated: {error.error}"},
        goto="finalize",
    )

builder.add_node(
    "charge_payment",
    charge_payment,
    retry_policy=RetryPolicy(max_attempts=3, retry_on=ConnectionError),
    error_handler=payment_error_handler,
)
```

请参阅 [Fault tolerance](/oss/python/langgraph/fault-tolerance#error-handling) 了解完整的可运行示例、补偿模式和 `Command` 路由。

## 设置图范围节点默认值

> [!注意]
>
> 需要`langgraph>=1.2`。使用 [⟦T54⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/set_node_defaults) 为图中的每个节点设置 `retry_policy`、`timeout`、`cache_policy` 或 `error_handler` 一次，而不是在每个 [⟦T59⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 调用中重复它们。每个节点的值总是获胜，并且在 [⟦T60⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile) 时间应用默认值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy, TimeoutPolicy

graph = (
    StateGraph(State)
    .set_node_defaults(
        retry_policy=RetryPolicy(max_attempts=3),
        timeout=TimeoutPolicy(run_timeout=30),
        error_handler=fallback_handler,
    )
    .add_node("a", node_a)
    .add_node("b", node_b, retry_policy=RetryPolicy(max_attempts=5))  # overrides default
    .add_edge(START, "a")
    .compile()
)
```

`retry_policy` 和 `timeout` 默认值适用于每个节点，包括错误处理程序节点。 `cache_policy` 和 `error_handler` 默认值仅适用于常规节点 - 处理程序永远不会捕获自己，并且缓存处理程序结果是不安全的。子图不会继承默认值。

有关完整的优先级规则和适用性表，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance#graph-defaults)。

## 访问节点内的执行信息

通过`runtime.execution_info`访问执行身份和重试信息。这会显示线程、运行和检查点标识符以及重试状态，而无需直接从 `config` 读取。|属性|类型 |描述 |
| - | - | - |
| `thread_id` | `str \| None` |当前执行的线程 ID。 `None` 没有检查点。 |
| `run_id` | `str \| None` |当前执行的运行 ID。 `None` 当配置中未提供时。 |
| `checkpoint_id` | `str` |当前执行的检查点 ID。 |
| `checkpoint_ns` | `str` |当前执行的检查点命名空间。 |
| `task_id` | `str` |当前执行的任务 ID。 |
| `node_attempt` | `int` |当前执行尝试次数（1 索引）。第一次尝试时为`1`，第一次重试时为`2`，等等 |
| `node_first_attempt_time` | `float \| None` |第一次尝试开始时的 Unix 时间戳（秒）。重试后保持不变。 |

#### 访问线程和运行 ID

使用 `execution_info` 访问节点内的线程 ID、运行 ID 和其他身份字段：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.runtime import Runtime
from typing_extensions import TypedDict

class State(TypedDict):
    result: str

def my_node(state: State, runtime: Runtime):
    info = runtime.execution_info
    if info is None:
        return {"result": "done"}
    print(f"Thread: {info.thread_id}, Run: {info.run_id}")  # [!code highlight]
    return {"result": "done"}

builder = StateGraph(State)
builder.add_node("my_node", my_node)
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)
graph = builder.compile()
```

#### 根据重试状态调整行为

当节点有重试策略时，使用`execution_info`检查当前的尝试次数，并在第一次尝试失败后切换到回退：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.runtime import Runtime
from langgraph.types import RetryPolicy
from typing_extensions import TypedDict

class State(TypedDict):
    result: str

def my_node(state: State, runtime: Runtime):
    info = runtime.execution_info
    if info is not None and info.node_attempt > 1:  # [!code highlight]
        # use a fallback on retries
        return {"result": call_fallback_api()}
    return {"result": call_primary_api()}

builder = StateGraph(State)
builder.add_node("my_node", my_node, retry_policy=RetryPolicy(max_attempts=3))
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)
graph = builder.compile()
```

一旦节点任务准备好，`execution_info`就被设置。即使没有重试策略，`node_attempt`默认为`1`，`node_first_attempt_time`在节点开始执行时设置。

## 访问节点内的服务器信息当您的图表在LangGraph服务器上运行时，您可以通过`runtime.server_info`访问特定于服务器的元数据。这会显示助手 ID、图形 ID 和经过身份验证的用户，而无需直接读取配置元数据或可配置密钥。

|属性|类型 |描述 |
| - | - | - |
| `assistant_id` | `str` |当前部署的助手 ID。 |
| `graph_id` | `str` |当前部署的图形 ID。 |
| `user` | `BaseUser \| None` |经过身份验证的用户（如果配置了[custom auth](/langsmith/custom-auth)）。 |

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.runtime import Runtime
from typing_extensions import TypedDict

class State(TypedDict):
    result: str

def my_node(state: State, runtime: Runtime):
    server = runtime.server_info
    if server is not None:
        print(f"Assistant: {server.assistant_id}, Graph: {server.graph_id}")  # [!code highlight]
        if server.user is not None:
            print(f"User: {server.user.identity}")
    return {"result": "done"}

builder = StateGraph(State)
builder.add_node("my_node", my_node)
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)
graph = builder.compile()
```

当图表未在 LangGraph 服务器上运行时（例如，在本地开发或测试期间），`server_info` 为 `None`。

> [!注意]
>
> 需要`langgraph>=1.1.5`。

## 访问节点内的耗尽状态

当请求 [graceful shutdown](/oss/python/langgraph/fault-tolerance#graceful-shutdown) 时，`runtime.drain_requested` 为 `True`。在节点内读取此内容以在下一个超级步边界之前跳过昂贵的工作：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import Runtime

def my_node(state: State, runtime: Runtime) -> State:
    if runtime.drain_requested:  # [!code highlight]
        return {"status": "skipped", "reason": runtime.drain_reason}
    return {"status": do_work()}
```

|物业 |类型 |描述 |
| - | - | - |
| `drain_requested` | `bool` | `True` 如果本次运行已调用 `RunControl.request_drain()`。 |
| `drain_reason` | `str \| None` |原因字符串传递给`request_drain()`，或者如果未请求排水则传递给`None`。 |

> [!注意]
>
> 需要`langgraph>=1.2`。请参阅 [Graceful shutdown](/oss/python/langgraph/fault-tolerance#graceful-shutdown) 了解完整的 `RunControl` API。

## 添加节点缓存

当步骤成本高昂并且您希望对同一输入重用结果时，请使用节点缓存。要启用缓存：

1. 编译图时传递一个缓存（例如`InMemoryCache`）。 `SqliteCache` 也可以在 Python 中使用。
2. 在节点上附加[⟦T115⟧](https://reference.langchain.com/python/langgraph/types/CachePolicy)。

[⟦T116⟧](https://reference.langchain.com/python/langgraph/types/CachePolicy)选项：

* **`key_func`**：从节点输入构建缓存键的函数。默认为输入的哈希值（通过 pickle）。
* **`ttl`**：以秒为单位的生存时间。当省略时，缓存条目不会过期。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time

from typing_extensions import TypedDict

from langgraph.cache.memory import InMemoryCache
from langgraph.graph import END, START, StateGraph
from langgraph.types import CachePolicy


class State(TypedDict):
    x: int
    result: int


def expensive_node(state: State) -> dict[str, int]:
    # Expensive computation
    time.sleep(2)
    return {"result": state["x"] * 2}


builder = StateGraph(State)
builder.add_node("expensive_node", expensive_node, cache_policy=CachePolicy(ttl=3))
builder.add_edge(START, "expensive_node")
builder.add_edge("expensive_node", END)

graph = builder.compile(cache=InMemoryCache())

print(graph.invoke({"x": 5}, stream_mode="updates"))  # [!code highlight]
# [{'expensive_node': {'result': 10}}]
print(graph.invoke({"x": 5}, stream_mode="updates"))  # [!code highlight]
# [{'expensive_node': {'result': 10}, '__metadata__': {'cached': True}}]
```

由于模拟工作，第一次运行大约需要两秒钟。第二次运行从缓存中返回。

您还可以使用 [⟦T120⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/set_node_defaults) 为图形设置一次 `cache_policy` （和其他节点选项）。参见[Set graph-wide node defaults](#set-graph-wide-node-defaults)。

## 另请参阅

* [Graph API](/oss/python/langgraph/graph-api#nodes)
* [Control flow](/oss/python/langgraph/graph-api-control-flow)
* [Fault tolerance](/oss/python/langgraph/fault-tolerance)
* [Define and update state](/oss/python/langgraph/graph-api-state)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-nodes.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。