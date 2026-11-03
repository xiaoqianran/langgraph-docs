<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Fault tolerance | https://docs.langchain.com/oss/python/langgraph/fault-tolerance -->

# 容错能力

在 LangGraph 中配置每个节点的超时、重试、错误处理程序和恢复策略。

当节点因缓慢的外部 API、瞬态网络错误或未处理的异常而发生故障时，LangGraph 为您提供三种可组合的响应机制：

* [**Retries**](#retries)：根据异常类型和退避设置自动重新运行失败的尝试
* [**Timeouts**](#timeouts)：限制单次尝试可以运行的时间
* [**Error handling**](#error-handling)：在所有重试次数耗尽后运行恢复功能

使用[**⟦T29⟧**](#graph-defaults)为所有节点配置一次这些机制，而不是在每个`add_node`调用时重复它们。

它们以固定的顺序组成：当节点尝试引发任何异常（包括超时导致的[⟦T31⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError)）时，重试策略决定是否重试。仅当重试次数耗尽后，错误处理程序才会运行。

要在超级步边界处干净地停止运行并稍后恢复，请参阅[Graceful shutdown](#graceful-shutdown)。

> [!注意]
>
> 每节点超时和节点级错误处理程序需要 `langgraph>=1.2`。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    start([Attempt starts]) --> exec[Run node]
    exec -->|"success"| done([Continue graph])
    exec -->|"any exception<br/>including NodeTimeoutError"| retry{retry_policy<br/>matches?}
    retry -->|"yes, attempts left"| exec
    retry -->|"exhausted or absent"| handler{error_handler?}
    handler -->|"yes"| run_handler["Invoke handler<br/>with NodeError"]
    run_handler --> route([Update state +<br/>Command goto])
    handler -->|"no"| bubble([Exception<br/>bubbles up])

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef decision fill:#FDF3FF,stroke:#7E65AE,stroke-width:2px,color:#504B5F
    classDef alert fill:#F8E8E6,stroke:#B27D75,stroke-width:2px,color:#634643
    classDef output fill:#EBD0F0,stroke:#885270,stroke-width:2px,color:#441E33

    class exec,run_handler process
    class retry,handler decision
    class bubble alert
    class done,route,start output
```

## 重试

重试策略会根据异常类型和退避设置自动重新运行失败的节点尝试。

通过`retry_policy=`到[⟦T34⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy

builder.add_node(
    "call_api",
    call_api,
    retry_policy=RetryPolicy(max_attempts=3),
)
```

### 默认行为默认情况下，`retry_on`使用`default_retry_on`，它会重试除以下（及其子类）之外的**任何**异常：

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

对于流行 HTTP 库（例如 `requests` 和 `httpx`）的异常，它仅重试 5xx 状态代码。 [⟦T51⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError) 默认情况下可重试。

### 参数

|参数|类型 |默认 |描述 |
| - | - | - | - |
| `max_attempts` | `int` | `3` |最大尝试次数，包括第一次。 |
| `initial_interval` | `float` | `0.5` |第一次重试前的秒数。 |
| `backoff_factor` | `float` | `2.0` |乘数应用于每次重试后的间隔。 |
| `max_interval` | `float` | `128.0` |重试之间的最大秒数。 |
| `jitter` | `bool` | `True` |将随机抖动添加到间隔中。 |
| `retry_on` | `type[Exception] \| Sequence[type[Exception]] \| Callable[[Exception], bool]` | `default_retry_on` |要重试的异常，或者可调用的返回 `True` 的可重试异常。 |

### 自定义重试逻辑

将可调用或异常类型传递给`retry_on`。导入 `default_retry_on` 来扩展默认行为：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy, default_retry_on

def custom_retry_on(exc: BaseException) -> bool:
    if isinstance(exc, MyCustomError):
        return False
    return default_retry_on(exc)

builder.add_node(
    "call_api",
    call_api,
    retry_policy=RetryPolicy(max_attempts=3, retry_on=custom_retry_on),
)
```

### 检查重试状态

使用节点内部的执行信息来检查当前的尝试次数。当主调用持续失败时，这对于切换到后备非常有用：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.runtime import Runtime
from langgraph.types import RetryPolicy
from typing_extensions import TypedDict

class State(TypedDict):
    result: str

def my_node(state: State, runtime: Runtime) -> State:
    if runtime.execution_info.node_attempt > 1:  # [!code highlight]
        return {"result": call_fallback_api()}
    return {"result": call_primary_api()}

builder = StateGraph(State)
builder.add_node("my_node", my_node, retry_policy=RetryPolicy(max_attempts=3))
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)
````execution_info`公开以下字段：

|属性|类型 |描述 |
| - | - | - |
| `node_attempt` | `int` |当前尝试次数（1-索引）。第一次尝试时为`1`，第一次重试时为`2`，等等 |
| `node_first_attempt_time` | `float \| None` |第一次尝试开始时的 Unix 时间戳。重试后保持不变。 |
| `thread_id` | `str \| None` |当前执行的线程 ID。 `None` 没有检查点。 |
| `run_id` | `str \| None` |当前执行的运行 ID。 `None` 当配置中未提供时。 |
| `checkpoint_id` | `str` |当前执行的检查点 ID。 |
| `task_id` | `str` |当前执行的任务 ID。 |

即使没有重试策略，`execution_info` 也可用 — `node_attempt` 默认为 `1`。

## 重试边界和幂等性

[retry](#retries)从头开始重新运行整个节点功能。这为节点执行提供了**至少一次**语义：当策略匹配时，LangGraph再次调用节点。它不会使外部副作用只发生一次。

```text theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
attempt 1:  node starts -> call payment API -> payment succeeds -> process crashes
attempt 2:  node starts -> call payment API -> payment succeeds again
```

[Checkpoints](/oss/python/langgraph/checkpointers) 写在 [super-step](/oss/python/langgraph/graph-api#super-steps) 边界，而不是中间功能。失败尝试的图形写入将被丢弃。节点期间的副作用（付款、电子邮件、外部写入）超出了该边界。应用程序代码必须使这些效果具有幂等性。[interrupt](/oss/python/langgraph/interrupts) 或崩溃恢复后适用相同的重新执行模型。参见[Re-execution and idempotency](/oss/python/langgraph/graph-api#re-execution-and-idempotency)。要检查节点内部的工作，以便恢复可以跳过已完成的单元，请将每个单元包装在 [task](/oss/python/langgraph/graph-api#using-tasks-in-nodes) 中。

### 使用幂等密钥保护副作用

发送具有副作用的稳定幂等性密钥，以便提供商可以消除重复的重试。在副作用运行之前，密钥必须已经是持久的。不要在同一节点内生成它并依赖返回值：

```text theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
attempt 1:  node starts -> generate key K1 -> charge succeeds -> process dies before returning
attempt 2:  node starts -> state has no key -> generate key K2 -> charge runs again
```

`K1` 从未被检查过。从已经持久的状态派生密钥：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def charge_customer(state: State) -> dict:
    # Same order always produces the same key across retries and resumes.
    idempotency_key = f"charge:{state['order_id']}"

    provider.charge(
        customer_id=state["customer_id"],
        amount=state["amount"],
        idempotency_key=idempotency_key,
    )

    # Observability only. A retry must not depend on this return value.
    return {"last_payment_key": idempotency_key, "charged": True}
```

当不存在持久业务身份时，在副作用发生之前将生成的密钥保留在其自己的节点中。在进程崩溃时，只有当干预检查点持久时才有效。使用 [sync durability](/oss/python/langgraph/checkpointers#durability-modes) 来表示该模式。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import uuid

def reserve_key(state: State) -> dict:
    # Own node so the key is checkpointed before anything external runs.
    return {"payment_key": state.get("payment_key") or str(uuid.uuid4())}

def charge_customer(state: State) -> dict:
    provider.charge(..., idempotency_key=state["payment_key"])
    return {"charged": True}
```

两个要求：

1. **密钥可从持久状态重现。** 在新进程中重试或恢复会重建相同的密钥。
2. **外部服务尊重密钥。** 在依赖之前请检查提供商的文档。

### 将缺失的确认视为未知如果提供者提交并且确认丢失，则即使副作用可能已经发生，图也没有本地记录。当提供商进行重复数据删除时，稍后使用相同密钥的尝试可以避免盲目重复，但结果仍然未知。将缺失的本地状态视为未知，而不是作为效果未发生的证据。在补偿或继续之前向提供者查询操作的状态。

对于无法在 API 级别实现幂等的副作用，请将它们移出可重试节点。例如，在重试次数耗尽后从 [error handler](#error-handling) 运行它们，或者从按任务 ID 进行重复数据删除的单独工作线程运行它们。

## 超时

> [!注意]
>
> 需要`langgraph>=1.2`。

[⟦T96⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 上的 `timeout=` 参数限制了单个节点尝试可以运行的时间。传递一个数字（秒）、`timedelta`或[⟦T98⟧](https://reference.langchain.com/python/langgraph/types/TimeoutPolicy)以实现单独的运行和空闲限制：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from datetime import timedelta
from langgraph.types import TimeoutPolicy

# Simple wall-clock cap
builder.add_node("call_model", call_model, timeout=60)
builder.add_node("call_model", call_model, timeout=timedelta(minutes=2))

# Separate run and idle limits
builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(run_timeout=120, idle_timeout=30),
)
```

> [!警告]
>
> 节点超时仅适用于**异步**节点。具有 `timeout` 的同步节点在编译时会被拒绝。要包装阻塞 I/O，请在异步节点内使用 `asyncio.to_thread`。

### 运行超时

`run_timeout` 是一次尝试的硬挂钟上限。无论节点活动如何，它都永远不会刷新：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import TimeoutPolicy

builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(run_timeout=120),
)
```当超过限制时，LangGraph提高[⟦T102⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError)，清除失败尝试中的所有写入，并让重试策略决定是否重试。

### 空闲超时

`idle_timeout`是进度重置上限。仅当节点在指定持续时间内停止进行可观察的进度时才会触发 - 与 `run_timeout` 不同，只要节点产生进度信号，时钟就会重置：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(idle_timeout=30),
)
```

您可以同时设置`run_timeout`和`idle_timeout`。无论哪个先开火都会取消尝试。

#### 进度信号

在默认的`refresh_on="auto"`下，空闲时钟会在以下任意情况下重置：

* 状态通过`CONFIG_KEY_SEND`写入
* 流输出（产生异步流块）
* 子任务调度
* 运行时流写入器调用
* 来自节点或其后代的任何 LangChain 回调事件（LLM 代币、工具调用、链开始/结束等）

#### 心跳模式

设置 `refresh_on="heartbeat"` 将刷新源缩小为仅显式 `runtime.heartbeat()` 调用。当您想要一个严格的空闲定义且不会被爱说话的下属重置时，这非常有用：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(idle_timeout=30, refresh_on="heartbeat"),
)
```

#### 手动心跳

对于长时间运行的工作，不会自然发出进度信号，请调用 `runtime.heartbeat()` 手动重置空闲时钟：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.runtime import Runtime
from langgraph.types import TimeoutPolicy
from typing_extensions import TypedDict

class State(TypedDict):
    result: str

async def long_running_node(state: State, runtime: Runtime) -> State:
    for batch in fetch_batches():
        process(batch)
        runtime.heartbeat()  # [!code highlight]
    return {"result": "done"}

builder = StateGraph(State)
builder.add_node(
    "long_running_node",
    long_running_node,
    timeout=TimeoutPolicy(idle_timeout=30, refresh_on="heartbeat"),
)
builder.add_edge(START, "long_running_node")
builder.add_edge("long_running_node", END)
````runtime.heartbeat()` 是空闲时间尝试之外的无操作，因此您可以无条件调用它。

### 节点超时错误

当超时触发时，LangGraph会引发[⟦T113⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError)，并带有关于哪个限制被击中的结构化上下文：

|属性|类型 |描述 |
| - | - | - |
| `node` | `str` |执行超时的节点名称。 |
| `elapsed` | `float` |超时触发前已过了几秒。 |
| `kind` | `Literal["idle", "run"]` |哪个超时被触发。 |
| `idle_timeout` | `float \| None` |配置的空闲超时（秒）（如果有）。 |
| `run_timeout` | `float \| None` |配置的运行超时（秒）（如果有）。 |

`NodeTimeoutError` 默认情况下可重试。将 `timeout` 与重试策略相结合，可以开箱即用 - 每次新尝试时超时时钟都会重置，并且在下一次重试之前清除超时尝试的写入：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy, TimeoutPolicy

builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(idle_timeout=30),
    retry_policy=RetryPolicy(max_attempts=3),
)
```

### 发送的动态超时

当使用 [⟦T126⟧](https://reference.langchain.com/python/langgraph/types/Send) 动态调度节点时（例如，在 Map-Reduce 模式中），您可以直接在 `Send` 上传递超时，以覆盖目标节点针对该特定推送的静态超时：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Send, TimeoutPolicy

def fan_out(state: OverallState):
    return [
        Send("process_item", {"item": item}, timeout=TimeoutPolicy(idle_timeout=15))
        for item in state["items"]
    ]
```如果在`Send`上省略超时，则应用目标节点的超时（在[⟦T129⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)时间设置）。这使您可以在节点上设置默认超时并针对各个调用收紧它。

## 错误处理

> [!注意]
>
> 需要`langgraph>=1.2`。

错误处理程序在节点发生故障并且所有重试都用尽后运行。它接收当前状态并可以更新它或使用[⟦T131⟧](https://reference.langchain.com/python/langgraph/types/Command)路由到不同的节点。这对于您想要正常恢复而不是中止整个图的补偿流（Saga 模式）非常有用。

通过`error_handler=`到[⟦T133⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError
from langgraph.types import Command, RetryPolicy
from langgraph.graph import StateGraph, START
from typing_extensions import TypedDict

class State(TypedDict):
    status: str

def charge_payment(state: State) -> State:
    raise RuntimeError("payment gateway timeout")

def payment_error_handler(state: State, error: NodeError) -> Command:
    return Command(
        update={"status": f"compensated: {error.error}"},
        goto="finalize",
    )

def finalize(state: State) -> State:
    return state

graph = (
    StateGraph(State)
    .add_node(
        "charge_payment",
        charge_payment,
        retry_policy=RetryPolicy(max_attempts=3, retry_on=ConnectionError),
        error_handler=payment_error_handler,
    )
    .add_node("finalize", finalize)
    .add_edge(START, "charge_payment")
    .compile()
)
```

该处理程序仅在重试策略用尽后触发，或者如果未配置重试策略则立即触发。重试策略和错误处理程序保持解耦：独立配置何时重试和何时补偿。

### 节点错误

错误处理程序通过类型化的`error: NodeError`参数接收失败上下文，该参数通过类型注释注入（与`runtime: Runtime`相同的模式）：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError

def my_handler(state: State, error: NodeError) -> Command:
    print(f"Node {error.node} failed with: {error.error}")
    return Command(update={"status": "recovered"}, goto="next_step")
```

[⟦T136⟧](https://reference.langchain.com/python/langgraph/errors/NodeError) 是一个具有两个字段的冻结数据类：

|属性|类型 |描述 |
| - | - | - |
| `node` | `str` |执行失败的节点名称。 |
| `error` | `BaseException` |故障节点引发的异常。 |`error: NodeError` 参数是可选的。不需要失败上下文的处理程序可以使用更简单的签名，例如 `(state)` 或 `(state, runtime)`。

### 使用命令进行路由

错误处理程序可以返回 [⟦T144⟧](https://reference.langchain.com/python/langgraph/types/Command) 来更新状态并路由到特定节点，从而启用 Saga / 补偿模式：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError
from langgraph.types import Command, RetryPolicy
from langgraph.graph import StateGraph, START
from typing_extensions import TypedDict

class State(TypedDict):
    status: str

def reserve_inventory(state: State) -> State:
    return {"status": "reserved"}

def charge_payment(state: State) -> State:
    raise RuntimeError("payment timeout")

def payment_error_handler(state: State, error: NodeError) -> Command:
    return Command(
        update={"status": f"compensated_after_{error.node}: {error.error}"},
        goto="finalize",
    )

def finalize(state: State) -> State:
    return state

graph = (
    StateGraph(State)
    .add_node("reserve_inventory", reserve_inventory)
    .add_node(
        "charge_payment",
        charge_payment,
        retry_policy=RetryPolicy(max_attempts=3, retry_on=ConnectionError),
        error_handler=payment_error_handler,
    )
    .add_node("finalize", finalize)
    .add_edge(START, "reserve_inventory")
    .add_edge("reserve_inventory", "charge_payment")
    .compile()
)
```

`charge_payment` 重试 `ConnectionError` 最多 3 次。如果重试次数用尽（或者错误不是`ConnectionError`），处理程序会通过更新状态并路由到`finalize`来进行补偿，而不是中止图表。

### 恢复安全故障

> [!注意]
>
> 故障来源有检查点。如果在节点失败之后但处理程序完成之前图被中断或进程崩溃，则当图从其检查点恢复时，处理程序会看到相同的`NodeError`上下文。

### `interrupt()` 的行为

> [!警告]
>
> 在节点内引发的`interrupt()` **不会**路由到错误处理程序。中断使用 `GraphBubbleUp` 机制来暂停人机循环工作流程的图形执行，绕过重试策略和错误处理程序。图表照常暂停。

### 子图失败如果节点包装子图并且子图引发未处理的异常，则该异常会显示到父节点。如果父节点有错误处理程序，则该处理程序会在 `error.error` 中触发子图的异常。

## 恢复策略

重试和错误处理程序涵盖自动重试和耗尽后的补偿。节点逻辑中存在另外两种常见模式：

|战略|谁修的|机制|
| - | - | - |
|瞬态错误 |系统|节点上的[Retry policy](#retries) |
|重试后可恢复的故障 |开发商 | [⟦T154⟧ / ⟦T155⟧](#error-handling)（传奇/补偿）|
| LLM-可恢复错误|法学硕士 |将错误存储在状态中并使用 [⟦T156⟧](https://reference.langchain.com/python/langgraph/types/Command) | 返回
|用户可修复的错误 |人类 |暂停[⟦T157⟧](/oss/python/langgraph/interrupts)|
|意外错误 |开发商 |让异常冒泡并使运行失败 |

### LLM 可恢复错误

当工具调用或解析以模型可以纠正的方式失败时，在节点中捕获该错误，将其写入状态，然后路由回代理，以便 LLM 可以调整：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal

from langgraph.types import Command
from typing_extensions import TypedDict


class ToolError(Exception):
    """Raised when a tool call fails in a way the model can correct."""


class State(TypedDict):
    tool_call: str
    tool_result: str | None


def run_tool(tool_call: str) -> str:
    if tool_call == "bad":
        raise ToolError("invalid args")
    return f"ok:{tool_call}"


def execute_tool(state: State) -> Command[Literal["agent", "execute_tool"]]:
    try:
        result = run_tool(state["tool_call"])
        return Command(update={"tool_result": result}, goto="agent")
    except ToolError as e:
        # Let the LLM see what went wrong and try again
        return Command(
            update={"tool_result": f"Tool error: {e}"},
            goto="agent",
        )
```

这是应用程序级控制流，而不是`error_handler`。该节点处理已知的故障模式并保持运行。

### 意外错误不要发现你无法处理的故障。如果没有匹配的重试策略或错误处理程序，异常就会出现并导致运行失败，因此您可以修复错误：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict


class EmailAgentState(TypedDict):
    draft_response: str


class EmailService:
    def send(self, body: str) -> None:
        raise RuntimeError(f"SMTP unavailable while sending: {body}")


email_service = EmailService()


def send_reply(state: EmailAgentState) -> EmailAgentState:
    # Do not catch unexpected failures here. Let them bubble up and fail the run.
    email_service.send(state["draft_response"])
    return state
```

## 图表默认值

> [!注意]
>
> 需要`langgraph>=1.2`。

不要在每个 `add_node` 调用上重复相同的 `retry_policy=`、`error_handler=`、`timeout=` 或 `cache_policy=`，而是使用 [⟦T165⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/set_node_defaults) 在一个位置配置图形范围的默认值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError
from langgraph.types import RetryPolicy, TimeoutPolicy
from langgraph.graph import StateGraph, START
from typing_extensions import TypedDict

class State(TypedDict):
    status: str

def default_error_handler(state: State, error: NodeError) -> State:
    return {"status": f"handled: {error.error}"}

graph = (
    StateGraph(State)
    .set_node_defaults(
        retry_policy=RetryPolicy(max_attempts=3),
        error_handler=default_error_handler,
        timeout=TimeoutPolicy(run_timeout=30),
    )
    .add_node("step_a", step_a)
    .add_node("step_b", step_b)
    .add_edge(START, "step_a")
    .compile()
)
```

`step_a` 和 `step_b` 现在共享相同的重试策略、错误处理程序和超时，没有任何重复。

### 优先级

直接传递到`add_node()`的每个节点值始终覆盖`set_node_defaults()`设置的默认值。默认值在 `compile()` 时间解决，因此您可以按任意顺序在 `add_node()` 之前或之后调用 `set_node_defaults()`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph = (
    StateGraph(State)
    .set_node_defaults(error_handler=default_error_handler)
    .add_node("step_a", step_a)                                     # uses default_error_handler
    .add_node("step_b", step_b, error_handler=custom_error_handler) # uses custom_error_handler
    .add_edge(START, "step_a")
    .compile()
)
```

### 默认错误处理程序

当每个图形运行映射到外部进程（例如后台作业行）并且任何未处理的节点故障都应将该进程标记为失败，而不是在每个 `add_node` 上重复 `error_handler=` 时，`error_handler` 默认值特别有价值。当步骤需要自己的逻辑时，每节点处理程序仍然优先：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import NodeError
from langgraph.graph import StateGraph, START
from langgraph.types import Command, RetryPolicy
from typing_extensions import TypedDict

class State(TypedDict):
    process_id: str
    status: str

def fetch_data(state: State) -> State:
    return {"status": "fetched"}

def charge_payment(state: State) -> State:
    raise RuntimeError("payment timeout")

def finalize(state: State) -> State:
    return state

def mark_process_failed(state: State, error: NodeError) -> State:
    # Persist failure on the external process row keyed by process_id.
    return {"status": f"failed at {error.node}: {error.error}"}

def refund_payment(state: State, error: NodeError) -> Command:
    return Command(
        update={"status": f"compensated after {error.node}"},
        goto="finalize",
    )

graph = (
    StateGraph(State)
    .set_node_defaults(
        retry_policy=RetryPolicy(max_attempts=3),
        error_handler=mark_process_failed,
    )
    .add_node("fetch_data", fetch_data)  # uses mark_process_failed
    .add_node(
        "charge_payment",
        charge_payment,
        error_handler=refund_payment,  # overrides the graph-wide default
    )
    .add_node("finalize", finalize)
    .add_edge(START, "fetch_data")
    .add_edge("fetch_data", "charge_payment")
    .compile()
)
```

如果重试后`fetch_data`失败，则`mark_process_failed`运行。如果 `charge_payment` 在重试后失败，则 `refund_payment` 会运行，因为每个节点处理程序会覆盖默认值。该处理程序接受与 [Error handling](#error-handling) 中描述的相同的 `(state, error: NodeError)` 签名。如果您需要访问诸如 `thread_id` 之类的配置值，它还接受 `RunnableConfig` 作为可选的第三个参数：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.runnables import RunnableConfig

def mark_process_failed(
    state: State, error: NodeError, config: RunnableConfig
) -> State:
    thread_id = config["configurable"].get("thread_id")
    return {"status": f"failed on thread {thread_id}: {error.error}"}
```

### 适用性矩阵

并非所有默认值都适用于所有节点类型。错误处理程序节点（通过`add_node(error_handler=...)`注册的节点）被排除在某些默认值之外，以防止不安全行为：

| `set_node_defaults`参数|适用于常规节点 |适用于错误处理程序节点 |原因 |
| - | - | - | - |
| `retry_policy` | ✅ | ✅ |应对暂时性故障重试处理程序 |
| `timeout` | ✅ | ✅ |卡住的处理程序应该像卡住的常规节点一样被取消 |
| `error_handler` | ✅ | ❌ |处理者绝不能抓住自己|
| `cache_policy` | ✅ | ❌ |缓存处理程序结果是不安全的 |

### 范围

父图上设置的默认值**不会**被子图继承。每个图表都维护自己的默认值。

## 函数式API

函数式 API 中的 `@task` 和 `@entrypoint` 上提供了相同的 `timeout=` 和 `retry_policy=` 参数：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.func import entrypoint, task
from langgraph.types import RetryPolicy, TimeoutPolicy

@task(
    timeout=TimeoutPolicy(idle_timeout=30),
    retry_policy=RetryPolicy(max_attempts=3),
)
async def call_api(url: str) -> str:
    response = await fetch(url)
    return response.text

@entrypoint(timeout=60)
async def my_workflow(inputs: dict) -> str:
    result = await call_api("https://api.example.com/data")
    return result
```

其行为与`add_node`相同：`NodeTimeoutError`在超时时引发，缓冲写入被清除，重试策略决定是否重试。

## 优雅关闭协作关闭允许您在当前超级步骤完成后停止运行中的图形并保存可恢复的检查点。这对于处理 SIGTERM 信号或任何需要回收资源而不丢失工作的外部监控程序非常有用。

> [!注意]
>
> 需要`langgraph>=1.2`。

创建一个 [⟦T196⟧](https://reference.langchain.com/python/langgraph/runtime/RunControl) 并将其作为 `control=` 传递给 `invoke` 或 `stream`。从任何线程调用 `request_drain()` 来发出运行应该停止的信号：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import RunControl
from langgraph.errors import GraphDrained

control = RunControl()

# In a signal handler or supervisor:
# control.request_drain("sigterm")

try:
    result = graph.invoke(inputs, config, control=control)
except GraphDrained as e:
    # The graph stopped early and saved a checkpoint.
    # Resume later with the same config.
    print(f"Drained: {e.reason}")
```

### 语义

Drain 是协作式的，在超级步骤之间运行，不会抢占已经在运行的工作：

|场景 |行为 |
| - | - |
|节点执行中期 |运行至完成。 Drain 在下一个超级步骤中生效。 |
|具有重试策略的节点当前正在重试 |重试循环运行至耗尽或成功。排水后生效。 |
|图形在与耗尽相同的刻度上自然完成 |正常返回。检查`control.drain_requested`以区别于正常运行。 |
|仍有更多超级步骤|加薪`GraphDrained(reason)`。检查点已保存并可恢复。 |
|子图请求耗尽 | `GraphDrained` 在父级中冒泡，并在其自己的下一个超步边界处停止。 |

### 排水后恢复

使用相同的 `thread_id` 恢复用 `invoke(None, config)` 耗尽的运行：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
result = graph.invoke(None, config)
```### 读取节点内的耗尽状态

通过`runtime`参数访问drain状态，以在达到超步边界之前调整节点行为：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import Runtime

async def my_node(state: State, runtime: Runtime) -> State:
    if runtime.drain_requested:
        # Skip expensive work and return a minimal result
        return {"status": "skipped", "reason": runtime.drain_reason}
    return {"status": await do_work()}
```

### SIGTERM 钩子模式

处理进程关闭的推荐模式：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import signal
from langgraph.runtime import RunControl
from langgraph.errors import GraphDrained

control = RunControl()
signal.signal(signal.SIGTERM, lambda *_: control.request_drain("sigterm"))

try:
    result = graph.invoke(inputs, config, control=control)
except GraphDrained as e:
    log.info("graph drained: %s", e.reason)
    # Resume on next startup with the same config
```

> [!注意]
>
> `request_drain()` 不会取消正在运行的异步任务或终止线程。对于硬上限，将排出与优雅的超时和任务取消配对。

## 限制

* **超时仅是异步的**：具有 `timeout` 的同步节点在编译时被拒绝。
* **每个节点一个处理程序**：每个节点最多可以有一个`error_handler`。
* **处理程序失败冒泡**：如果错误处理程序本身引发，则该异常会传播，就像节点没有处理程序一样。
* **`set_node_defaults` 不被子图继承**：每个图独立管理自己的默认值。

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时答案。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/fault-tolerance.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。