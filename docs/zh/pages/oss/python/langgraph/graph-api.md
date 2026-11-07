<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Graph API overview | https://docs.langchain.com/oss/python/langgraph/graph-api -->

# 图 API 概述

了解 LangGraph 如何将代理工作流程建模为共享状态、节点和边的图。

图形 API 将代理工作流程定义为 [state](#state)、[nodes](#nodes) 和 [edges](#edges) 的图形。 [⟦T22⟧](#send)和[⟦T23⟧](#command)控制图的运行方式：`Send`动态调用节点进行扇出，`Command`在路由到下一个节点时更新状态（包括中断后恢复）。当您需要显式共享状态和可视化控制流时，请使用图形 API。

有关构建过程中的逐步决策，请参阅[Build checklist for the Graph API](/oss/python/langgraph/use-graph-api)。有关指导演练，请参阅 [Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)。

## 图表

LangGraph 将代理工作流程建模为由三个部分构建的图表：

1. [⟦T26⟧](#state)：应用程序的共享快照。通常是类型化模式。
2. [⟦T27⟧](#nodes)：读取状态、执行工作并返回更新的函数。
3. [⟦T28⟧](#edges)：确定下一个节点的固定或条件转换。

组合节点和边来构建序列、分支和循环。节点和边是普通函数。他们可以调用法学硕士或运行其他代码。

简而言之：节点完成工作；边缘决定接下来运行什么。

### 超级步骤

LangGraph 使用 [message passing](https://en.wikipedia.org/wiki/Message_passing) 运行图表，采用 Google [Pregel](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) 系统的风格。离散**超级步骤**中的执行进展：* 并行运行的节点共享一个超级步。
* 按顺序运行的节点使用单独的超级步骤。
* 当节点在传入边上接收到输入时，该节点将变为活动状态。
* 在超级步骤之后，没有待处理消息的节点将变为非活动状态。
* 当每个节点都处于非活动状态并且没有消息仍在传输时，运行结束。

### 状态图

[⟦T29⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 是主要的图形生成器。使用您的状态模式对其进行参数化。

### 编译你的图表

通过定义[state](#state)，添加[nodes](#nodes)和[edges](#edges)，然后编译来构建图。编译检查图结构（例如孤立节点）。您还可以在此处附加运行时选项，例如 [checkpointers](/oss/python/langgraph/persistence) 和断点。

您必须先编译该图，然后再调用或流式传输它。这是最小的端到端示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    text: str


def node_a(state: State):
    return {"text": state["text"] + "a"}


graph = (
    StateGraph(State)
    .add_node("node_a", node_a)
    .add_edge(START, "node_a")
    .add_edge("node_a", END)
    .compile()
)

graph.invoke({"text": ""})
# {'text': 'a'}
```

## 状态

状态是节点读取和更新的共享数据。 LangGraph 将该数据存储在**通道**中：状态模式中的命名槽（状态对象的键）。每个通道都保存一个值并定义更新如何合并到其中。大多数通道使用最后写入获胜。具有 [reducer](#reducers) 的通道会组合值，例如通过附加到列表。

状态有两部分：* 声明图中通道的[schema](#schema)
*可选的[reducers](#reducers)控制更新如何合并到每个通道

节点返回部分更新。 LangGraph 通过每个通道的减速器应用这些更新。

当需要验证时，使用 [⟦T30⟧](https://docs.python.org/3/library/typing.html#typing.TypedDict)、[⟦T31⟧](https://docs.python.org/3/library/dataclasses.html)（默认值）或 Pydantic [⟦T32⟧](/oss/python/langgraph/graph-api-state#use-pydantic-models-for-graph-state) 定义状态。出于性能考虑，首选 `TypedDict` 或 `dataclass`。

> [!注意]
>
> [⟦T35⟧](/oss/python/langchain/agents) 状态模式必须是 `TypedDict`。不支持 Pydantic 模型。

### 架构

默认情况下，图形输入和输出模式与完整状态匹配。当某些键仅是内部键时，您可以缩小它们的范围。参见[Define input and output schemas](/oss/python/langgraph/graph-api-state#define-input-and-output-schemas)。

#### 多个模式

大多数图共享一个状态模式。当您需要以下任一功能时，请使用多个架构：

* 内部节点共享的私有通道，但不属于图输入或输出的一部分
* 显式输入和输出模式是完整内部状态的子集

节点可以写入图状态中的任何通道，包括其声明的输入模式之外的通道。当定义这些模式时，节点还可以引入私有通道。输入和输出模式限制 `invoke` 接受和返回的内容。默认情况下，它们不会隐藏 [streaming](/oss/python/langgraph/streaming) 的频道。参见[Private channels and streaming](/oss/python/langgraph/graph-api-state#private-channels-and-streaming)。例如，请参阅 [Define input and output schemas](/oss/python/langgraph/graph-api-state#define-input-and-output-schemas) 和 [Pass private state between nodes](/oss/python/langgraph/graph-api-state#pass-private-state-between-nodes)。

### 减速机

减速器控制节点更新如何合并到状态中。每个键都有自己的减速器。如果没有减速器，更新会覆盖以前的值。

#### 减速器参数

减速器是一个二元函数：

* **左**：该键的当前状态值
* **右**：节点针对该键返回的更新

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
new_value = reducer(left=current_state[key], right=node_update[key])
```

定义一个减速器并将其附加到带有 `Annotated` 的状态键：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated

from typing_extensions import TypedDict


def append_strings(left: list[str], right: list[str]) -> list[str]:
    """Combine the existing state value (left) with a node update (right)."""
    return left + right


class State(TypedDict):
    tags: Annotated[list[str], append_strings]
```

使用 left 和 right 调用减速器显示了值如何组合：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
append_strings(left=["draft"], right=["review"])  # returns ["draft", "review"]
```

#### 默认减速器

默认的reducer用右边的值替换左边的值。节点返回部分更新，而不是完整状态。

例如，从 `{"foo": 1, "bar": ["hi"]}` 开始。 `{"foo": 2}` 的更新产生`{"foo": 2, "bar": ["hi"]}`。后来的`{"bar": ["bye"]}`产生`{"foo": 2, "bar": ["bye"]}`。

#### 定制减速器

使用自定义化简器来组合值，例如附加到列表。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated

from typing_extensions import TypedDict


class State(TypedDict):
    foo: int
    bar: Annotated[list[str], operator.add]
```

这里`foo`覆盖。 `bar` 附加`operator.add`。从`{"foo": 1, "bar": ["hi"]}`，`{"bar": ["bye"]}`更新为`{"foo": 1, "bar": ["hi", "bye"]}`。

#### 覆盖

要绕过合并减速器并替换值（包括清除它），请使用[⟦T50⟧](https://reference.langchain.com/python/langgraph/types/)。参见[Bypass reducers with Overwrite](/oss/python/langgraph/graph-api-state#bypass-reducers-with-overwrite)。

#### 重置reducer字段使用合并减速器，返回空值会保留先前的数据。这对于必须在尝试之间清除的错误缓冲区或重试计数器很重要。参见[Resetting a reducer field](/oss/python/langgraph/graph-api-state#resetting-a-reducer-field)和[Bypass reducers with Overwrite](/oss/python/langgraph/graph-api-state#bypass-reducers-with-overwrite)。

### 在图形状态下处理消息

#### 为什么要使用消息？

聊天模型将消息列表作为输入。 LangChain 的 [chat model interface](/oss/python/langchain/models) 接受消息对象，例如 [⟦T51⟧](https://reference.langchain.com/python/langchain-core/messages/human/HumanMessage) 和 [⟦T52⟧](https://reference.langchain.com/python/langchain-core/messages/ai/AIMessage)。请参阅[Messages conceptual guide](/oss/python/langchain/messages)。

#### 在图表中使用消息

将对话历史记录存储为状态消息列表，并使用一个缩减器附加新消息并按 ID 更新现有消息。

在 `messages` 键上使用 [⟦T53⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages)。普通 `operator.add` 仅附加，因此它无法在人工循环编辑期间就地更新现有消息。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated

from langchain.messages import AnyMessage
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class GraphState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

#### 序列化

消息缩减器还将常见的有线格式反序列化为LangChain消息对象。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Supported
{"messages": [HumanMessage(content="message")]}

# Also supported
{"messages": [{"type": "human", "content": "message"}]}
```

使用点表示法访问属性，例如 `state["messages"][-1].content`。参见[LangChain serialization](/oss/python/langchain/messages#serialization)。

#### 消息状态

`MessagesState` 是一个预构建状态，具有使用 [⟦T59⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 的单个 `messages` 键。将其子类化以添加字段：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import MessagesState


class State(MessagesState):
    documents: list[str]
```

## 节点

节点是实现图形步骤的同步或异步函数。

节点可以接受：1.`state`：图表[state](#state)
2. `config`：[⟦T62⟧](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)，其值为 `thread_id` 和 `tags`
3. `runtime`：一个`Runtime`对象，带有[runtime context](#runtime-context)、`store`、`stream_writer`、`execution_info`以及相关助手

添加带有 [⟦T70⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 的节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from dataclasses import dataclass

from langgraph.graph import StateGraph
from langgraph.runtime import Runtime
from typing_extensions import TypedDict


class State(TypedDict):
    input: str
    results: str


@dataclass
class Context:
    user_id: str


builder = StateGraph(State)


def plain_node(state: State):
    return state


def node_with_runtime(state: State, runtime: Runtime[Context]):
    return {"results": f"Hello, {state['input']}!"}


builder.add_node("plain_node", plain_node)
builder.add_node("node_with_runtime", node_with_runtime)
```

在幕后，LangGraph将函数包装为[⟦T71⟧](https://reference.langchain.com/python/langchain-core/runnables/base/RunnableLambda)，因此它们获得批处理、异步支持和[tracing](/langsmith/observability)。

如果省略节点名称，LangGraph 使用函数名称。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.add_node(my_node)
# Reference the node as "my_node" in edges
```

### 重执行和幂等性

使用 [checkpointer](/oss/python/langgraph/persistence)，LangGraph 将检查点保存在 [super-step](#super-steps) 边界，而不是节点内的中间功能。在[interrupt](/oss/python/langgraph/interrupts)或[retry](/oss/python/langgraph/fault-tolerance#retries)之后，受影响的节点从其功能开始处再次运行。暂停前再次运行有副作用。

设计节点逻辑，确保重新执行是安全的。首选幂等键、更新插入或先读后写检查。有关重试下的持久密钥和外部副作用，请参阅[Retry boundaries and idempotency](/oss/python/langgraph/fault-tolerance#retry-boundaries-and-idempotency)。有关`interrupt()`周围的效果，请参阅[Side effects called before ⟦T73⟧ must be idempotent](/oss/python/langgraph/interrupts#side-effects-called-before-interrupt-must-be-idempotent)。

您可以添加或删除节点和边，而不会中断现有线程的恢复。恢复的运行使用保存的状态和您现在编译的图表。如果节点调用[tasks](/oss/python/langgraph/functional-api#task)或[⟦T74⟧](https://reference.langchain.com/python/langgraph/types/interrupt)，则恢复时将应用更严格的[determinism](/oss/python/langgraph/functional-api#determinism)规则。已完成的任务结果从检查点恢复。在恢复点之前更改任务或中断顺序可能会导致缓存值不匹配。参见[Idempotency](/oss/python/langgraph/functional-api#idempotency)。

### 选择工作单位

[node](#nodes) 是检查点和重试边界。这也是图表可以采取不同路径的地方。解析、检索或固定工具链等确定性工作不需要自己的节点，除非您需要该边界。

询问该步骤是否决定接下来发生的事情，或者执行已经决定的事情。然后选择与您需要的恢复行为相匹配的原语：|原始|自己的检查站|恢复或重试时 |选择何时 |
| - | - | - | - |
|节点内的普通函数 |不。它在节点的 [super-step](#super-steps) 内部运行。 |每当节点重新运行时就重新运行。 |该步骤之后没有路由分叉，并且对节点的其余部分重复该步骤是可以接受的。 |
| [Task](/oss/python/langgraph/functional-api#task) |没有新的图形检查点。结果与正在运行的入口点或父检查点一起存储。 |封闭的入口点或节点从头开始重播。已完成的任务返回存储的结果。 |该步骤有副作用或成本高昂，并且不得在简历中重复。 |
| [Subgraph](/oss/python/langgraph/use-subgraphs) |对于有状态模式是：在父线程的命名空间下节点检查点。使用 `checkpointer=False` 编译，无子图检查点。 |有状态模式在中断或故障节点的子图中恢复。 |该单元有自己的路由或状态模式，或者多个父图重用它。 |
|图节点|是的。检查点遵循其运行所在的 [super-step](#super-steps)。恢复从该节点开始。较早的节点不会重新运行。 |该步骤之后可能会出现路由分支，或者您需要中断、恢复或 [time travel](/oss/python/langgraph/use-time-travel) 边界。 |

有关重试时的副作用，请参阅[Retry boundaries and idempotency](/oss/python/langgraph/fault-tolerance#retry-boundaries-and-idempotency)。任务重试和超时请参见[Fault tolerance](/oss/python/langgraph/fault-tolerance)。### 在节点中使用任务

当一个节点运行多个应独立检查点的操作时，请将每个操作包装在 [task](/oss/python/langgraph/functional-api#task) 中，而不是跨节点拆分工作。使用检查指针，可以保存已完成的任务结果，因此恢复的线程可以跳过节点内已完成的工作。有关模式和示例，请参阅 [Tasks](/oss/python/langgraph/functional-api#task) 和 [Common pitfalls](/oss/python/langgraph/functional-api#common-pitfalls)。

### `START` 节点

[⟦T77⟧](https://reference.langchain.com/python/langgraph/constants/START) 是将用户输入传递到图中的虚拟条目。用它来标记哪些节点首先运行。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START

graph.add_edge(START, "node_a")
```

### `END` 节点

`END` 标记终端边缘。当路径应该停止时使用它。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END

graph.add_edge("node_a", END)
```

### 节点缓存

LangGraph 可以通过输入缓存节点（和任务）结果。编译图时传递一个缓存，并在节点上附加一个[⟦T80⟧](https://reference.langchain.com/python/langgraph/types/CachePolicy)。

有关选项、端到端示例和图范围默认值，请参阅[Add node caching](/oss/python/langgraph/graph-api-nodes#add-node-caching)。

## 边缘

边缘决定控制下一步的走向：

* **普通边**：总是从一个节点到下一个节点
* **条件边**：调用函数来确定下一个节点
* **入口点**：用户输入后的第一个节点（`START`→节点）
* **条件入口点**：从 `START` 使用函数进行路由

一个节点可以有多个出边。这些边缘上的目的地在下一个超级步骤中并行运行。> [!警告]
>
> 对于每个节点，使用静态边或动态路由 ([conditional edges](#conditional-edges) / [⟦T83⟧](https://reference.langchain.com/python/langgraph/types/Command))，而不是同时使用两者。混合它们可以运行两条路径。

### 正常边缘

如果你总是想从节点 A 到节点 B，请使用 [⟦T84⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_edge("node_a", "node_b")
```

### 条件边

如果您想选择性地路由到一个或多个节点（或终止），请使用 [⟦T85⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges)。传递源节点和一个路由函数以在该节点运行后调用：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_conditional_edges("node_a", routing_function)
# Or with an explicit map:
graph.add_conditional_edges(
    "node_a",
    routing_function,
    {"path_a": "node_b", "path_b": "node_c"},
)
```

路由函数接收当前图状态。默认情况下，它的返回值是下一个节点的名称（或名称列表）。这些节点在下一个超级步骤中并行运行。您还可以传递一个字典，将函数的输出映射到节点名称。

路由函数可以返回节点名称、`END`、名称列表（扇出）或[⟦T87⟧](https://reference.langchain.com/python/langgraph/types/Send)用于map-reduce的对象。参见[Build sequences, branches, and loops](/oss/python/langgraph/graph-api-control-flow)。

> [!提示]
>
> 当您想要将状态更新和路由合并到单个函数中时，请使用 [⟦T88⟧](https://reference.langchain.com/python/langgraph/types/Command) 代替条件边。

### 入口点

入口点是图启动时运行的第一个（或多个）节点。从虚拟[⟦T89⟧](https://reference.langchain.com/python/langgraph/constants/START)节点添加一条边到第一个要执行的节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_edge(START, "node_a")
```

### 条件入口点条件入口点可让您根据自定义逻辑从不同的节点开始。使用[⟦T91⟧](https://reference.langchain.com/python/langgraph/constants/START)中的[⟦T90⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_conditional_edges(START, routing_function)
```

您可以选择提供一个字典，将路由函数的输出映射到下一个节点名称。

## `Send`

当您需要为每个项目运行一次相同的节点，每个项目都有自己的输入，并且项目的数量仅在运行时才知道时，请使用[⟦T93⟧](https://reference.langchain.com/python/langgraph/types/Send)。这种形状通常称为映射缩减或协调工作人员：一个节点生成一个列表，工作人员并行处理每个项目，然后稍后的节点读取组合结果。

普通边缘无法做到这一点。他们选择接下来运行哪些节点，但每个选定的节点仍然接收共享图状态，并且在构建图时拓扑是固定的。

从条件边返回一个或多个 `Send` 对象。每个 `Send` 命名一个目标节点并传递一个自定义参数作为该调用的输入。 LangGraph 并行运行这些调用。当工作人员写入共享状态键时，[reducers](#reducers)合并他们的更新，例如通过连接列表。

`Send` 的第一个参数是目标节点名称。第二个是该调用的状态（或部分状态）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Send


def continue_to_jokes(state: OverallState):
    return [Send("generate_joke", {"subject": s}) for s in state["subjects"]]


graph.add_conditional_edges("node_a", continue_to_jokes)
```

有关完整的映射缩减示例，请参阅[Use Send for map-reduce](/oss/python/langgraph/graph-api-send-command#use-send-for-map-reduce)。

## `Command`当单个步骤必须更新状态并选择接下来运行的内容时，请使用[⟦T98⟧](https://reference.langchain.com/python/langgraph/types/Command)。通常这些作业是分开的：节点返回状态更新，并且[edges](#edges)（或[conditional edges](#conditional-edges)）决定下一个节点。当下一跳取决于您刚刚在同一函数中所做的工作时，从节点返回`Command`。

`Command` 还涵盖了普通返回和边不包含的其他两种情况：在 [interrupt](/oss/python/langgraph/interrupts) 之后恢复运行，以及从 [tool](#return-from-tools) 内部更新或路由。

对于单独的路由，更喜欢条件边。当您需要同时更新和路由（或上面的中断/工具箱之一）时，请使用`Command`。

`Command`接受：

* **`update`**：状态更新（就像正常的节点返回一样）
* **`goto`**：下一个节点（如条件边）
* **`graph`**：从 [subgraph](/oss/python/langgraph/use-subgraphs) 导航时的父图目标
* **`resume`**：用于在 [interrupt](/oss/python/langgraph/interrupts) 之后恢复的值

在三个地方使用`Command`：

* **[Return from nodes](#return-from-nodes)**：`update`、`goto` 和 `graph`
* **[Input to ⟦T111⟧ or ⟦T112⟧](#input-to-invoke-or-stream)**: 中断后`resume`
* **[Return from tools](#return-from-tools)**：从工具内部更新和路由

### 从节点返回

#### `update` 和 `goto`

返回[⟦T116⟧](https://reference.langchain.com/python/langgraph/types/Command)一步更新状态和路由：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: CommandState) -> Command[Literal["my_other_node"]]:
    return Command(
        update={"foo": "bar"},
        goto="my_other_node",
    )
```使用允许的目的地注释返回类型，例如 `Command[Literal["my_other_node"]]`。这告诉LangGraph要渲染哪些边。

当您同时需要更新和路线时，请使用[⟦T118⟧](https://reference.langchain.com/python/langgraph/types/Command)。对于单独路由，首选[conditional edges](#conditional-edges)。

> [!警告]
>
> `Command` 添加动态边缘。来自同一节点的静态边仍然运行。不要将来自一个节点的 `Command` 路由与 `add_edge` 混合使用。

参见[Combine control flow and state updates with Command](/oss/python/langgraph/graph-api-send-command#combine-control-flow-and-state-updates-with-command)。

#### `graph`

从 [subgraph](/oss/python/langgraph/use-subgraphs) 节点，导航到父图中带有 `Command.PARENT` 的节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: CommandState) -> Command[Literal["other_subgraph"]]:
    return Command(
        update={"foo": "bar"},
        goto="other_subgraph",  # where `other_subgraph` is a node in the parent graph
        graph=Command.PARENT,
    )
```

当您更新子图也使用的父键时，请在父键中为该键定义 [reducer](#reducers)。参见[Navigate to a node in a parent graph](/oss/python/langgraph/graph-api-send-command#navigate-to-a-node-in-a-parent-graph)。

### 输入`invoke`或`stream`

> [!警告]
>
> `Command(resume=...)` 是唯一的 `Command` 模式，意味着作为 `invoke()` / `stream()` 的输入（可选地在恢复时使用 `update=...`）。不要单独通过`Command(update=...)`继续对话。任何 `Command` 作为输入都从最新的检查点恢复，而不是从 `START`，因此完成的线程可能看起来被卡住。传递一个简单的字典来开始新的回合：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> # Wrong: resumes from the latest checkpoint
> graph.invoke(Command(update={  # [!code --]
>     "messages": [{"role": "user", "content": "follow up"}]  # [!code --]
> }), config)  # [!code --]
>
> # Correct: plain dict restarts from START
> graph.invoke({  # [!code ++]
>     "messages": [{"role": "user", "content": "follow up"}]  # [!code ++]
> }, config)  # [!code ++]
> ```

#### `resume`

在 [interrupt](/oss/python/langgraph/interrupts) 之后使用 `Command(resume=...)`。该值成为暂停的 `interrupt()` 调用的返回值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke(Command(resume="yes"), config)
```

有关完整模式，请参阅[Interrupts](/oss/python/langgraph/interrupts)。

### 从工具返回工具完成后，从工具返回[⟦T137⟧](https://reference.langchain.com/python/langgraph/types/Command)更新状态和路线。工具中的`goto`添加了动态边缘。调用节点上的静态边仍然运行，因此不要混合两者。

参见[Use inside tools](/oss/python/langgraph/graph-api-send-command#use-inside-tools)。

## 图迁移

即使 [checkpointer](/oss/python/langgraph/persistence) 已经存储了线程状态，您也可以更改图的节点、边和状态模式。什么是安全的取决于线程是否已完成或已暂停。

**拓扑（节点和边）**

* 完成的线程（不中断）：您可以自由添加、删除或重命名节点和边。
* 中断的线程：可以更改边并添加节点。不要重命名或删除线程即将进入的节点。恢复时，LangGraph 按名称查找该节点，缺少名称则运行失败。

**状态模式**

* 添加或删除键是向后和向前兼容的。
* 重命名键会删除现有线程中该键的已保存值。
* 对现有键的不兼容类型更改（例如，缩小或要求旧检查点省略的字段）可能会破坏旧的线程状态。

对于保持模式兼容的逻辑更改（例如，新的工具集），请参阅[Business compatibility](/oss/python/langgraph/backward-compatibility#business-compatibility)。

## 运行时上下文运行时上下文将依赖项传递到节点中，而不将它们置于图形状态（例如，模型名称或数据库句柄）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from dataclasses import dataclass

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from typing_extensions import TypedDict


class State(TypedDict):
    input: str
    output: str


@dataclass
class ContextSchema:
    llm_provider: str = "openai"


def get_llm(provider: str) -> str:
    return provider


def node_a(state: State, runtime: Runtime[ContextSchema]):
    llm = get_llm(runtime.context.llm_provider)
    return {"output": llm}


graph = (
    StateGraph(State, context_schema=ContextSchema)
    .add_node("node_a", node_a)
    .add_edge(START, "node_a")
    .add_edge("node_a", END)
    .compile()
)
graph.invoke({"input": "hi"}, context={"llm_provider": "anthropic"})
```

参见[Add runtime configuration](/oss/python/langgraph/graph-api-nodes#add-runtime-configuration)。

### 递归限制

递归限制限制了一次运行可以执行的[super-steps](#super-steps)数量。当超过限制时，LangGraph升高`GraphRecursionError`。

从版本 1.1.4 开始，默认为 10,007 个超级步。在 1.0.6 和 1.1.3 之间，默认值为 10,000 步。使用 `LANGGRAPH_DEFAULT_RECURSION_LIMIT` 环境变量覆盖它，或将 `recursion_limit` 作为顶级配置键传递（不在 `configurable` 下）。

有关秘诀（捕获错误、阅读 `langgraph_step` 和 Python `RemainingSteps`），请参阅 [Impose a recursion limit](/oss/python/langgraph/graph-api-control-flow#impose-a-recursion-limit) 和 [Access and handle the recursion counter](/oss/python/langgraph/graph-api-control-flow#access-and-handle-the-recursion-counter)。

## 了解更多

* [Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)
* [LangGraph quickstart](/oss/python/langgraph/quickstart)
* [Build checklist for the Graph API](/oss/python/langgraph/use-graph-api)
* [Define and update state](/oss/python/langgraph/graph-api-state)
* [Build sequences, branches, and loops](/oss/python/langgraph/graph-api-control-flow)
* [Use Send and Command](/oss/python/langgraph/graph-api-send-command)
* [Configure nodes](/oss/python/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/python/langgraph/graph-api-visualize)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。