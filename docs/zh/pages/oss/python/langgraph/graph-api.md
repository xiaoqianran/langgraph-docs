<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Graph API overview | https://docs.langchain.com/oss/python/langgraph/graph-api -->

## 图表

LangGraph 的核心是将代理工作流程建模为图表。您可以使用三个关键组件来定义代理的行为：

1. [⟦T40⟧](#state)：表示应用程序当前快照的共享数据结构。它可以是任何数据类型，但通常使用共享状态模式定义。

2. [⟦T41⟧](#nodes)：对代理逻辑进行编码的函数。它们接收当前状态作为输入，执行一些计算或副作用，并返回更新的状态。

3. [⟦T42⟧](#edges)：根据当前状态决定接下来执行哪个`Node`的函数。它们可以是条件分支或固定转换。

通过组合 `Nodes` 和 `Edges`，您可以创建复杂的循环工作流程，随着时间的推移不断演变状态。然而，真正的力量来自 LangGraph 管理该状态的方式。

强调一下：`Nodes`和`Edges`只不过是函数——它们可以包含LLM或只是好的代码。

简而言之：*节点完成工作，边缘告诉下一步做什么*。LangGraph的底层图算法使用[message passing](https://en.wikipedia.org/wiki/Message_passing)来定义通用程序。当节点完成其操作时，它会沿着一条或多条边向其他节点发送消息。然后，这些接收节点执行其功能，将结果消息传递给下一组节点，然后该过程继续。受 Google [Pregel](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) 系统的启发，该程序以离散的“超级步骤”进行。

超级步骤可以被认为是图节点上的单次迭代。并行运行的节点是同一超级步骤的一部分，而顺序运行的节点则属于单独的超级步骤。在图执行开始时，所有节点都以 `inactive` 状态开始。当节点在其任何传入边缘（或“通道”）上接收到新消息（状态）时，它就会变为`active`。然后，活动节点运行其功能并以更新进行响应。在每个超级步骤结束时，没有传入消息的节点通过将自己标记为`inactive`来投票给`halt`。当所有节点都为 `inactive` 并且没有消息在传输时，图执行终止。

### 状态图

[⟦T53⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 类是要使用的主要图形类。这是由用户定义的 `State` 对象参数化的。

### 编译你的图表要构建图表，首先定义 [state](#state)，然后添加 [nodes](#nodes) 和 [edges](#edges)，然后编译它。到底是什么在编译你的图表以及为什么需要它？

编译是一个非常简单的步骤。它提供了对图形结构的一些基本检查（没有孤立节点等）。您还可以在其中指定运行时参数，例如 [checkpointers](/oss/python/langgraph/persistence) 和断点。您只需调用 `.compile` 方法即可编译图表：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph = graph_builder.compile(...)
```

<Warning>
  您**必须**先编译您的图表，然后才能使用它。
</Warning>

## 状态

定义图时要做的第一件事是定义图的`State`。 `State` 由 [schema of the graph](#schema) 以及 [⟦T58⟧ functions](#reducers) 组成，它们指定如何将更新应用于状态。 `State`的模式将是图中所有`Nodes`和`Edges`的输入模式，并且可以是`TypedDict`或`Pydantic`模型。所有 `Nodes` 都会向 `State` 发出更新，然后使用指定的 `reducer` 函数应用这些更新。

### 架构指定图模式的主要记录方法是使用 [⟦T67⟧](https://docs.python.org/3/library/typing.html#typing.TypedDict)。如果您想提供您所在州的默认值，请使用[⟦T68⟧](https://docs.python.org/3/library/dataclasses.html)。如果您想要递归数据验证，我们还支持使用 Pydantic [⟦T69⟧](/oss/python/langgraph/use-graph-api#use-pydantic-models-for-graph-state) 作为图形状态（但请注意，Pydantic 的性能低于 `TypedDict` 或 `dataclass`）。

默认情况下，图表将具有相同的输入和输出模式。如果你想改变这一点，你也可以直接指定显式的输入和输出模式。当您有很多键并且其中一些键明确用于输入而其他键明确用于输出时，这非常有用。请参阅[guide](/oss/python/langgraph/use-graph-api#define-input-and-output-schemas)了解更多信息。

<Info>
  `langchain` 中的更高级别[⟦T72⟧](/oss/python/langchain/agents) 工厂不支持 Pydantic 状态模式。
</Info>

#### 多个模式

通常，所有图节点都与单个模式通信。这意味着它们将读取和写入相同的状态通道。但是，在某些情况下我们希望对此有更多的控制：

* 内部节点可以传递图的输入/输出中不需要的信息。
* 我们可能还想对图表使用不同的输入/输出模式。例如，输出可能仅包含单个相关输出键。可以让节点写入图中的私有状态通道以进行内部节点通信。我们可以简单地定义一个私有模式，`PrivateState`。

还可以为图定义显式的输入和输出模式。在这些情况下，我们定义一个“内部”模式，其中包含与图操作相关的*所有*键。但是，我们还定义了 `input` 和 `output` 模式，它们是“内部”模式的子集，用于约束图的输入和输出。有关更多详细信息，请参阅[Define input and output schemas](/oss/python/langgraph/use-graph-api#define-input-and-output-schemas)。

让我们看一个例子：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class InputState(TypedDict):
    user_input: str


class OutputState(TypedDict):
    graph_output: str


class OverallState(TypedDict):
    foo: str
    user_input: str
    graph_output: str


class PrivateState(TypedDict):
    bar: str


def node_1(state: InputState) -> OverallState:
    # Write to OverallState
    return {"foo": state["user_input"] + " name"}


def node_2(state: OverallState) -> PrivateState:
    # Read from OverallState, write to PrivateState
    return {"bar": state["foo"] + " is"}


def node_3(state: PrivateState) -> OutputState:
    # Read from PrivateState, write to OutputState
    return {"graph_output": state["bar"] + " Lance"}


builder = StateGraph(OverallState, input_schema=InputState, output_schema=OutputState)
builder.add_node("node_1", node_1)
builder.add_node("node_2", node_2)
builder.add_node("node_3", node_3)
builder.add_edge(START, "node_1")
builder.add_edge("node_1", "node_2")
builder.add_edge("node_2", "node_3")
builder.add_edge("node_3", END)

graph = builder.compile()
graph.invoke({"user_input": "My"})
# {'graph_output': 'My name is Lance'}
```

这里有两个微妙而重要的点需要注意：

1. 我们将`state: InputState`作为输入模式传递给`node_1`。但是，我们写入`foo`，`OverallState` 中的一个通道。我们如何写入不包含在输入模式中的状态通道？这是因为节点*可以写入图状态中的任何状态通道。*图状态是初始化时定义的状态通道的并集，其中包括`OverallState`以及过滤器`InputState`和`OutputState`。

2. 我们用以下方法初始化图表：

   ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
   StateGraph(
       OverallState,
       input_schema=InputState,
       output_schema=OutputState
   )
   ```

   我们如何在`node_2`中写入`PrivateState`？如果未在 `StateGraph` 初始化中传递该架构，那么该图如何访问该架构？我们可以这样做，因为只要状态模式定义存在，`_nodes`还可以声明附加状态`channels_`。在这种情况下，定义了`PrivateState`模式，因此我们可以将`bar`添加为图中的新状态通道并写入它。

<Warning>
  **私人频道在流式传输时不会被编辑。**

  输入、输出和私有模式限制每个节点*读取*的内容（其输入模式）以及`invoke`*返回*（输出模式）。他们**不会**隐藏`stream`的频道。

  当您使用 `stream_mode="values"` 进行流式传输时，图表默认会发出其**所有**状态通道，包括私有通道，因为值流式传输默认为完整的状态通道集而不是输出模式。这就是为什么像 `bar` 这样的私人频道被 `invoke` 隐藏但在流式传输时可见：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  stream = graph.stream_events({"user_input": "My"}, version="v3")
  for snapshot in stream.values:
      print(snapshot)
  # {'user_input': 'My'}
  # {'foo': 'My name', 'user_input': 'My'}
  # {'foo': 'My name', 'user_input': 'My', 'bar': 'My name is'}        # <-- private channel
  # {'foo': 'My name', 'user_input': 'My', 'graph_output': 'My name is Lance', 'bar': 'My name is'}
  ```

  要将流式传输的值限制为一组特定的通道（例如，仅输出模式），请传递 `output_keys`：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  stream = graph.stream_events(
      {"user_input": "My"},
      version="v3",
      output_keys=["graph_output"],  # [!code highlight]
  )
  for snapshot in stream.values:
      print(snapshot)
  # {'graph_output': 'My name is Lance'}
  ```

  如果您只需要节点实际每一步产生的通道（而不是完整的累积状态），请改用`stream_mode="updates"`。
</Warning>

### 减速机减速器是理解节点更新如何应用于`State`的关键。 `State`中的每个按键都有自己独立的减速器功能。如果没有显式指定减速器函数，则假定对该键的所有更新都应覆盖它。有几种不同类型的减速器，从默认类型的减速器开始：

#### 减速器参数

每个减速器都是一个具有两个位置参数的二元函数：

* **左参数**：当前值已存储在该键的状态中。
* **右参数**：节点返回的键的更新。

当节点返回部分更新时，LangGraph 为每个更新的键调用reducer，并将返回值保存为新的状态值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
new_value = reducer(left=current_state[key], right=node_update[key])
```

左边的参数总是来自累积状态。正确的论点始终来自最新的节点更新。以下示例明确命名两个参数：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated

from typing_extensions import TypedDict


def append_strings(left: list[str], right: list[str]) -> list[str]:
    """Combine the existing state value (left) with a node update (right)."""
    return left + right


class State(TypedDict):
    tags: Annotated[list[str], append_strings]
```

假设状态为`{"tags": ["draft"]}`，节点返回`{"tags": ["review"]}`。 LangGraph 调用：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
append_strings(left=["draft"], right=["review"])  # returns ["draft", "review"]
```

`tags` 的新状态值为 `["draft", "review"]`。

自定义减速器结合了左右参数。 [default reducer](#default-reducer) 丢弃左侧参数并仅保留右侧参数。

#### 默认减速器默认的reducer会忽略左边的参数并用右边的参数替换状态值。这个例子展示了如何使用默认的reducer：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict


class State(TypedDict):
    foo: int
    bar: list[str]
```

在此示例中，没有为任何键指定减速器函数。我们假设图表的输入是：

`{"foo": 1, "bar": ["hi"]}`。然后我们假设第一个 `Node` 返回 `{"foo": 2}`。这被视为对状态的更新。请注意，`Node` 不需要返回整个 `State` 模式 - 只需要更新即可。应用此更新后，`State` 将变为 `{"foo": 2, "bar": ["hi"]}`。如果第二个节点返回`{"bar": ["bye"]}`，则`State`将是`{"foo": 2, "bar": ["bye"]}`

#### 定制减速器

自定义化简器组合左右参数，而不是替换状态值，这对于累积值很有用，例如将更新附加到列表。此示例显示如何指定自定义减速器：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from operator import add
from typing import Annotated

from typing_extensions import TypedDict


class State(TypedDict):
    foo: int
    bar: Annotated[list[str], add]
```在此示例中，我们使用 `Annotated` 类型为第二个键 (`bar`) 指定减速器函数 (`operator.add`)。请注意，第一个键保持不变。我们假设图的输入是`{"foo": 1, "bar": ["hi"]}`。然后我们假设第一个 `Node` 返回 `{"foo": 2}`。这被视为对状态的更新。请注意，`Node` 不需要返回整个 `State` 模式 - 只需要更新即可。应用此更新后，`State` 将变为 `{"foo": 2, "bar": ["hi"]}`。如果第二个节点返回`{"bar": ["bye"]}`，则`State`将是`{"foo": 2, "bar": ["hi", "bye"]}`。请注意，`bar` 键是通过将两个列表添加在一起来更新的。

#### 覆盖

<Tip>
  在某些情况下，您可能希望绕过减速器并直接覆盖状态值。 LangGraph 为此提供了 [⟦T128⟧](https://reference.langchain.com/python/langgraph/types/) 类型。 [Learn how to use ⟦T129⟧ here](/oss/python/langgraph/use-graph-api#bypass-reducers-with-overwrite)。
</Tip>

### 在图形状态下处理消息

#### 为什么要使用消息？

大多数现代法学硕士提供商都有一个聊天模型界面，接受消息列表作为输入。 LangChain 的[chat model interface](/oss/python/langchain/models) 特别接受消息对象列表作为输入。这些消息有多种形式，例如[⟦T130⟧](https://reference.langchain.com/python/langchain-core/messages/human/HumanMessage)（用户输入）或[⟦T131⟧](https://reference.langchain.com/python/langchain-core/messages/ai/AIMessage)（LLM 响应）。

要了解有关消息对象的更多信息，请参阅[Messages conceptual guide](/oss/python/langchain/messages)。#### 在图表中使用消息

在许多情况下，将先前的对话历史记录存储为图形状态中的消息列表会很有帮助。为此，我们可以向存储`Message`对象列表的图状态添加一个键（通道），并使用reducer函数对其进行注释（请参阅下面示例中的`messages`键）。减速器函数对于告诉图如何在每次状态更新时（例如，当节点发送更新时）更新状态中的 `Message` 对象列表至关重要。如果您不指定减速器，则每次状态更新都会用最近提供的值覆盖消息列表。如果您想简单地将消息附加到现有列表，您可以使用 `operator.add` 作为减速器。但是，您可能还想手动更新图形状态中的消息（例如人机循环）。如果您要使用`operator.add`，您发送到图表的手动状态更新将被附加到现有的消息列表中，而不是更新现有的消息。为了避免这种情况，您需要一个可以跟踪消息 ID 并覆盖现有消息（如果更新）的缩减程序。为此，您可以使用预构建的 [⟦T137⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 函数。对于全新的消息，它只会附加到现有列表，但它也会正确处理现有消息的更新。

#### 序列化

除了跟踪消息 ID 之外，每当在 `messages` 通道上收到状态更新时，[⟦T138⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 函数还会尝试将消息反序列化为 LangChain `Message` 对象。

欲了解更多信息，请参阅[LangChain serialization/deserialization](https://python.langchain.com/docs/how_to/serialization/)。这允许以以下格式发送图形输入/状态更新：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# this is supported
{"messages": [HumanMessage(content="message")]}

# and this is also supported
{"messages": [{"type": "human", "content": "message"}]}
```

由于使用[⟦T142⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages)时，状态更新总是反序列化为LangChain`Messages`，因此您应该使用点表示法来访问消息属性，例如`state["messages"][-1].content`。

下面是使用 [⟦T144⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 作为其减速器函数的图示例。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AnyMessage
from langgraph.graph.message import add_messages
from typing import Annotated
from typing_extensions import TypedDict

class GraphState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

#### 消息状态由于状态中包含消息列表非常常见，因此存在一个名为 `MessagesState` 的预构建状态，这使得使用消息变得很容易。 `MessagesState` 使用单个 `messages` 键定义，该键是 `AnyMessage` 对象的列表，并使用 [⟦T149⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 缩减器。通常，要跟踪的状态不仅仅是消息，因此我们看到人们对此状态进行子类化并添加更多字段，例如：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import MessagesState

class State(MessagesState):
    documents: list[str]
```

## 节点

在 LangGraph 中，节点是接受以下参数的 Python 函数（同步或异步）：

1. `state`—图的[state](#state)
2. `config`—一个[⟦T152⟧](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)对象，包含`thread_id`等配置信息和`tags`等跟踪信息
3. `runtime`—包含 [runtime ⟦T157⟧](#runtime-context) 和其他信息的 `Runtime` 对象，如 `store`、`stream_writer`、`execution_info`、`server_info`、`heartbeat`（用于空闲超时刷新），以及`control`（适用于[graceful shutdown](/oss/python/langgraph/fault-tolerance#graceful-shutdown)）

与 `NetworkX` 类似，您可以使用 [⟦T165⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 方法将这些节点添加到图中：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from dataclasses import dataclass
from typing_extensions import TypedDict

from langgraph.graph import StateGraph
from langgraph.runtime import Runtime

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
    print("In node: ", runtime.context.user_id)
    return {"results": f"Hello, {state['input']}!"}

def node_with_execution_info(state: State, runtime: Runtime):
    print("In node with thread_id: ", runtime.execution_info.thread_id)  # [!code highlight]
    return {"results": f"Hello, {state['input']}!"}


builder.add_node("plain_node", plain_node)
builder.add_node("node_with_runtime", node_with_runtime)
builder.add_node("node_with_execution_info", node_with_execution_info)
...
```

在幕后，函数会转换为 [⟦T166⟧](https://reference.langchain.com/python/langchain-core/runnables/base/RunnableLambda)，这会与 [native tracing and debugging](/langsmith/observability) 一起为您的函数添加批处理和异步支持。

如果将节点添加到图中而不指定名称，则会为其指定一个与函数名称等效的默认名称。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.add_node(my_node)
# You can then create edges to/from this node by referencing it as `"my_node"`
```

### 重执行和幂等性当您使用[checkpointer](/oss/python/langgraph/persistence)进行编译时，LangGraph将检查点保存在[super-step](#graphs)边界，而不是节点内的中间函数。如果执行停止并稍后恢复（例如在 [interrupt](/oss/python/langgraph/interrupts) 或 [retry](/oss/python/langgraph/fault-tolerance#retries) 之后），受影响的 **节点** 从其功能开始时再次运行。暂停之前的代码和副作用再次运行。

**幂等性。**设计**节点**逻辑，以便重新执行不会破坏状态。如果节点插入数据库行，则运行两次不应创建重复行，除非是故意的。使用幂等键、更新插入或先读后写检查。有关`interrupt()`周围的效果，请参阅[Side effects called before ⟦T168⟧ must be idempotent](/oss/python/langgraph/interrupts#side-effects-called-before-interrupt-must-be-idempotent)。

**图形更改。** [Determinism](/oss/python/langgraph/functional-api#determinism) 有关代码更改的规则不适用于图形结构。您可以添加或删除**节点**和边，而不会破坏现有线程的恢复。恢复的运行使用保存的状态并执行您现在编译的任何图形。**节点内的任务和中断。** 如果 **节点** 调用 [**tasks**](/oss/python/langgraph/functional-api#task) 或 [⟦T169⟧](https://reference.langchain.com/python/langgraph/types/interrupt)，则在恢复时应用更严格的确定性规则。 LangGraph 从检查点恢复已完成的 **任务** 结果，但在恢复点之前更改代码中的 **任务** 或 [⟦T170⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 顺序可能会与缓存的值不匹配。 [Functional API](/oss/python/langgraph/functional-api) **入口点** 编译为单个 **节点**，以这种方式运行整个入口点方法。请参阅 [Determinism](/oss/python/langgraph/functional-api#determinism)、[Idempotency](/oss/python/langgraph/functional-api#idempotency) 和 [Using tasks in nodes](#using-tasks-in-nodes)。

### 在节点中使用任务

如果 [node](#nodes) 包含多个操作，您可能会发现将每个操作实现为 [**task**](/oss/python/langgraph/functional-api#task) 比将逻辑拆分到多个节点更容易。当图表使用检查点时，任务结果会被设置检查点，因此恢复线程可以跳过节点内已完成的**任务**工作。

<Tabs>
  <Tab title="Original">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from typing import NotRequired

    import requests
    from langchain_core.utils.uuid import uuid7
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.graph import END, START, StateGraph
    from typing_extensions import TypedDict


    class State(TypedDict):
        url: str
        result: NotRequired[str]


    def call_api(state: State):
        """Example node that makes an API request."""
        result = requests.get(state["url"]).text[:100]  # [!code highlight]
        return {"result": result}


    builder = StateGraph(State)
    builder.add_node("call_api", call_api)
    builder.add_edge(START, "call_api")
    builder.add_edge("call_api", END)

    checkpointer = InMemorySaver()
    graph = builder.compile(checkpointer=checkpointer)

    thread_id = str(uuid7())
    config = {"configurable": {"thread_id": thread_id}}

    graph.invoke({"url": "https://www.example.com"}, config)
    ```
  </Tab>

  <Tab title="With task">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from typing import NotRequired

    import requests
    from langchain_core.utils.uuid import uuid7
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.func import task
    from langgraph.graph import END, START, StateGraph
    from typing_extensions import TypedDict


    class State(TypedDict):
        urls: list[str]
        results: NotRequired[list[str]]


    @task
    def _make_request(url: str):
        """Make a request."""
        return requests.get(url).text[:100]  # [!code highlight]


    def call_api(state: State):
        """Example node that makes API requests as checkpointed tasks."""
        futures = [_make_request(url) for url in state["urls"]]  # [!code highlight]
        results = [f.result() for f in futures]
        return {"results": results}


    builder = StateGraph(State)
    builder.add_node("call_api", call_api)
    builder.add_edge(START, "call_api")
    builder.add_edge("call_api", END)

    checkpointer = InMemorySaver()
    graph = builder.compile(checkpointer=checkpointer)

    thread_id = str(uuid7())
    config = {"configurable": {"thread_id": thread_id}}

    graph.invoke({"urls": ["https://www.example.com"]}, config)
    ```
  </Tab>
</Tabs>

### `START` 节点

[⟦T172⟧](https://reference.langchain.com/python/langgraph/constants/START) 节点是一个特殊节点，表示将用户输入发送到图表的节点。引用该节点的主要目的是确定应该首先调用哪些节点。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START

graph.add_edge(START, "node_a")
```

### `END` 节点`END`节点是一个特殊的节点，代表终端节点。当您想要指示哪些边完成后没有任何操作时，将引用该节点。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END

graph.add_edge("node_a", END)
```

### 节点缓存

LangGraph 支持根据节点的输入来缓存任务/节点。使用缓存：

* 编译图时指定缓存（或指定入口点）
* 指定节点的缓存策略。每个缓存策略支持：
  * `key_func` 用于根据节点的输入生成缓存键，默认为带有pickle的输入的`hash`。
  * `ttl`，缓存的生存时间（以秒为单位）。如果不指定，缓存将永远不会过期。

例如：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time
from typing_extensions import TypedDict
from langgraph.graph import StateGraph
from langgraph.cache.memory import InMemoryCache
from langgraph.types import CachePolicy


class State(TypedDict):
    x: int
    result: int


builder = StateGraph(State)


def expensive_node(state: State) -> dict[str, int]:
    # expensive computation
    time.sleep(2)
    return {"result": state["x"] * 2}


builder.add_node("expensive_node", expensive_node, cache_policy=CachePolicy(ttl=3))
builder.set_entry_point("expensive_node")
builder.set_finish_point("expensive_node")

graph = builder.compile(cache=InMemoryCache())

print(graph.invoke({"x": 5}, stream_mode='updates'))    # [!code highlight]
# [{'expensive_node': {'result': 10}}]
print(graph.invoke({"x": 5}, stream_mode='updates'))    # [!code highlight]
# [{'expensive_node': {'result': 10}, '__metadata__': {'cached': True}}]
```

<Note>
  `set_entry_point(node)` 定义图形将执行的第一个节点。
  相当于`builder.add_edge(START, node)`。

  `set_finish_point(node)` 定义图中的最后一个节点。
  相当于`builder.add_edge(node, END)`。

  两种方法都有效，但是`add_edge(START, ...)`和`add_edge(..., END)`
  是推荐的现代语法。
</Note>

1. 第一次运行需要两秒钟才能运行（由于模拟的昂贵计算）。
2、第二次运行利用缓存，返回速度快。

## 边缘边定义逻辑如何路由以及图形如何决定停止。这是代理如何工作以及不同节点如何相互通信的重要组成部分。有几种关键的边类型：

* 普通边：直接从一个节点到下一个节点。
* 条件边：调用函数来确定下一个节点。
* 入口点：当用户输入到达时首先调用哪个节点。
* 条件入口点：调用函数来确定当用户输入到达时首先调用哪个节点。

一个节点可以有多个出边。如果一个节点有多个传出边，则这些目标节点的**所有**将作为下一个超级步骤的一部分并行执行。

<Warning>
  对于每个节点，选择一种路由机制：使用普通边进行静态路由，或使用条件边/[⟦T184⟧](https://reference.langchain.com/python/langgraph/types/Command)进行动态路由。不要混合来自同一节点的普通边和动态路由，因为这两条路径都可以执行并使图行为更难以推理。
</Warning>

### 正常边缘

如果你**总是**想从节点A到节点B，你可以直接使用[⟦T185⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge)方法。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_edge("node_a", "node_b")
```

### 条件边如果您想**可选地**路由到一个或多个边缘（或可选地终止），您可以使用 [⟦T186⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges) 方法。此方法接受节点的名称和在该节点执行后调用的“路由函数”：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_conditional_edges("node_a", routing_function)
```

与节点类似，`routing_function`接受图的当前`state`并返回一个值。

默认情况下，返回值`routing_function`用作将状态发送到下一个的节点（或节点列表）的名称。所有这些节点将作为下一个超级步骤的一部分并行运行。

您可以选择提供一个字典，将 `routing_function` 的输出映射到下一个节点的名称。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_conditional_edges("node_a", routing_function, {True: "node_b", False: "node_c"})
```

<Tip>
  如果您想将状态更新和路由合并在一个函数中，请使用 [⟦T191⟧](#command) 而不是条件边。
</Tip>

### 入口点

入口点是图启动时运行的第一个节点。您可以使用从虚拟[⟦T193⟧](https://reference.langchain.com/python/langgraph/constants/START)节点到第一个要执行的节点的[⟦T192⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge)方法来指定从何处进入图形。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START

graph.add_edge(START, "node_a")
```

### 条件入口点

条件入口点可让您根据自定义逻辑从不同的节点开始。您可以使用虚拟 [⟦T195⟧](https://reference.langchain.com/python/langgraph/constants/START) 节点中的 [⟦T194⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges) 来完成此操作。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START

graph.add_conditional_edges(START, routing_function)
```您可以选择提供一个字典，将 `routing_function` 的输出映射到下一个节点的名称。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.add_conditional_edges(START, routing_function, {True: "node_b", False: "node_c"})
```

## `Send`

默认情况下，`Nodes`和`Edges`提前定义并在相同的共享状态上运行。但是，在某些情况下，可能无法提前知道确切的边缘和/或您可能希望同时存在不同版本的 `State`。一个常见的例子是[map-reduce](/oss/python/langgraph/use-graph-api#map-reduce-and-the-send-api)设计模式。在此设计模式中，第一个节点可能会生成对象列表，并且您可能希望将一些其他节点应用于所有这些对象。对象的数量可能提前未知（意味着边的数量可能未知），并且下游`Node`的输入`State`应该不同（每个生成的对象一个）。

为了支持这种设计模式，LangGraph 支持从条件边返回 [⟦T203⟧](https://reference.langchain.com/python/langgraph/types/Send) 对象。 `Send` 有两个参数：第一个是节点的名称，第二个是传递给该节点的状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Send

def continue_to_jokes(state: OverallState):
    return [Send("generate_joke", {"subject": s}) for s in state['subjects']]

graph.add_conditional_edges("node_a", continue_to_jokes)
```

## `Command`

[⟦T206⟧](https://reference.langchain.com/python/langgraph/types/Command) 是一种用于控制图形执行的多功能原语。它接受四个参数：* `update`：应用状态更新（类似于从节点返回更新）。
* `goto`：导航到特定节点（类似于[conditional edges](#conditional-edges)）。
* `graph`：从 [subgraphs](/oss/python/langgraph/use-subgraphs) 导航时定位父图。
* `resume`：提供一个值以在[interrupt](/oss/python/langgraph/interrupts)之后恢复执行。

`Command` 用于三种情况：

* **[Return from nodes](#return-from-nodes)**：使用`update`、`goto`和`graph`将状态更新与控制流结合起来。
* **[Input to ⟦T215⟧ or ⟦T216⟧](#input-to-invoke-or-stream)**：使用`resume`在中断后继续执行。
* **[Return from tools](#return-from-tools)**：与从节点返回类似，将状态更新和工具内部的控制流结合起来。

### 从节点返回

#### `update` 和 `goto`

从节点函数返回[⟦T220⟧](https://reference.langchain.com/python/langgraph/types/Command)，以一步更新状态并路由到下一个节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    return Command(
        # state update
        update={"foo": "bar"},
        # control flow
        goto="my_other_node"
    )
```

使用[⟦T221⟧](https://reference.langchain.com/python/langgraph/types/Command)，您还可以实现动态控制流行为（与[conditional edges](#conditional-edges)相同）：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    if state["foo"] == "bar":
        return Command(update={"foo": "baz"}, goto="my_other_node")
```

当您需要**同时**更新状态**和**路由到不同的节点时，请使用[⟦T222⟧](https://reference.langchain.com/python/langgraph/types/Command)。如果您只需要路由而不更新状态，请改用[conditional edges](#conditional-edges)。<Note>
  在节点函数中返回 [⟦T223⟧](https://reference.langchain.com/python/langgraph/types/Command) 时，必须添加返回类型注释以及节点路由到的节点名称列表，例如`Command[Literal["my_other_node"]]`。这对于图形渲染是必要的，并告诉 LangGraph `my_node` 可以导航到 `my_other_node`。
</Note>

<Warning>
  [⟦T227⟧](https://reference.langchain.com/python/langgraph/types/Command) 仅添加动态边 - 使用 `add_edge` / `addEdge` 定义的静态边仍然执行。例如，如果 `node_a` 返回 `Command(goto="my_other_node")` 并且您还有 `graph.add_edge("node_a", "node_b")`，则 `node_b` 和 `my_other_node` 都将运行。对于每个节点，使用 [⟦T235⟧](https://reference.langchain.com/python/langgraph/types/Command) 或静态边路由到下一个节点，而不是同时使用两者。
</Warning>

查看此 [how-to guide](/oss/python/langgraph/use-graph-api#combine-control-flow-and-state-updates-with-command)，了解如何使用 [⟦T236⟧](https://reference.langchain.com/python/langgraph/types/Command) 的端到端示例。

#### `graph`

如果您使用 [subgraphs](/oss/python/langgraph/use-subgraphs)，则可以通过在 [⟦T239⟧](https://reference.langchain.com/python/langgraph/types/Command) 中指定 `graph=Command.PARENT` 从子图中的节点导航到父图中的不同节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["other_subgraph"]]:
    return Command(
        update={"foo": "bar"},
        goto="other_subgraph",  # where `other_subgraph` is a node in the parent graph
        graph=Command.PARENT
    )
```

<Note>
  将 `graph` 设置为 `Command.PARENT` 将导航到最近的父图。

  当您将父图和子图[state schemas](#schema)共享的键的更新从子图节点发送到父图节点时，您**必须**为您在父图状态中更新的键定义一个[reducer](#reducers)。请参阅此[example](/oss/python/langgraph/use-graph-api#navigate-to-a-node-in-a-parent-graph)。
</Note>

这在实现[multi-agent handoffs](/oss/python/langchain/multi-agent/handoffs)时特别有用。详情请查看[Navigate to a node in a parent graph](/oss/python/langgraph/use-graph-api#navigate-to-a-node-in-a-parent-graph)。### 输入`invoke`或`stream`

<Warning>
  `Command(resume=...)` 是 **唯一** `Command` 模式，旨在作为 `invoke()`/`stream()` 的输入（可以选择与 `update=...` 组合，以便在恢复时也应用状态更改）。不要单独使用`Command(update=...)`作为输入来继续多轮对话 - 因为传递任何`Command`作为输入从最新的检查点（即运行的最后一步，而不是`__start__`）恢复，如果已经完成，图表将显示为卡住。要在现有线程上继续对话，请传递一个简单的输入字典：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # WRONG - graph resumes from the latest checkpoint
  # (last step that ran), appears stuck
  graph.invoke(Command(update={  # [!code --]
      "messages": [{"role": "user", "content": "follow up"}]  # [!code --]
  }), config)  # [!code --]

  # CORRECT - plain dict restarts from __start__
  graph.invoke( {  # [!code ++]
      "messages": [{"role": "user", "content": "follow up"}]  # [!code ++]
  }, config)  # [!code ++]
  ```
</Warning>

#### `resume`

使用`Command(resume=...)`提供一个值并在[interrupt](/oss/python/langgraph/interrupts)之后恢复图形执行。传递给 `resume` 的值成为暂停节点内 `interrupt()` 调用的返回值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class State(TypedDict):
    messages: list[dict]


def human_review(state: State):
    # Pauses the graph and waits for a value
    answer = interrupt("Do you approve?")
    return {"messages": [{"role": "user", "content": answer}]}


graph = (
    StateGraph(State)
    .add_node("human_review", human_review)
    .add_edge(START, "human_review")
    .add_edge("human_review", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "graph-api-resume"}}

# First run - hits the interrupt and pauses
stream = graph.stream_events({"messages": []}, config, version="v3")
_ = stream.output  # drive the stream to completion
print(stream.interrupts)

# Resume with a value - the interrupt() call returns "yes"
resumed = graph.stream_events(Command(resume="yes"), config, version="v3")
final = resumed.output
```

查看 [interrupts conceptual guide](/oss/python/langgraph/interrupts) 了解中断模式的完整详细信息，包括多个中断和验证循环。

### 从工具返回

您可以从工具返回[⟦T256⟧](https://reference.langchain.com/python/langgraph/types/Command)来更新图状态和控制流。使用 `update` 修改状态（例如，保存在对话期间查找的客户信息），并使用 `goto` 在工具完成后路由到特定节点。<Warning>
  当在工具内部使用时，`goto` 添加动态边 - 调用该工具的节点上已定义的任何静态边仍将执行。对于每个节点，使用工具驱动的动态路由或静态边来路由到下一个节点，而不是同时使用两者。
</Warning>

详情请参阅[Use inside tools](/oss/python/langgraph/use-graph-api#use-inside-tools)。

## 图迁移

即使使用检查指针来跟踪状态，LangGraph 也可以轻松处理图定义（节点、边和状态）的迁移。

* 对于图末尾的线程（即未中断），您可以更改图的整个拓扑（即所有节点和边、删除、添加、重命名等）
* 对于当前中断的线程，我们支持除重命名/删除节点之外的所有拓扑更改（因为该线程现在可能即将进入不再存在的节点）——如果这是一个阻止者，请与我们联系，我们可以优先考虑解决方案。
* 对于修改状态，我们对添加和删除键具有完全的向后和向前兼容性
* 重命名的状态键会丢失其在现有线程中保存的状态* 类型以不兼容方式更改的状态键目前可能会导致更改前线程状态出现问题 - 如果这是一个阻碍因素，请联系我们，我们可以优先考虑解决方案。

<Tip>
  对于技术上兼容但改变业务逻辑的更改，例如重写工具集或重组对话流程，请参阅[Business compatibility](/oss/python/langgraph/backward-compatibility#business-compatibility)。该页面介绍了将行为版本固定在状态中，以便现有线程保留旧路径，而新线程则选择最新版本。
</Tip>

## 运行时上下文

创建图时，您可以为传递给节点的运行时上下文指定 `context_schema`。这对于通过很有用
向不属于图状态一部分的节点发送的信息。例如，您可能想要传递模型名称或数据库连接等依赖项。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@dataclass
class ContextSchema:
    llm_provider: str = "openai"

graph = StateGraph(State, context_schema=ContextSchema)
```

然后，您可以使用 `invoke` 方法的 `context` 参数将此上下文传递到图中。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke(inputs, context={"llm_provider": "anthropic"})
```

然后，您可以在节点或条件边内访问和使用此上下文：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import Runtime

def node_a(state: State, runtime: Runtime[ContextSchema]):
    llm = get_llm(runtime.context.llm_provider)
    # ...
```

有关配置的完整详细信息，请参阅[Add runtime configuration](/oss/python/langgraph/use-graph-api#add-runtime-configuration)。

### 递归限制递归限制设置了图在单次执行期间可以执行的最大数量 [super-steps](#graphs)。一旦达到限制，LangGraph 将提高 `GraphRecursionError`。从版本 1.0.6 开始，默认递归限制设置为 1000 步。递归限制可以在运行时在任何图上设置，并通过配置字典传递给`invoke`/`stream`。重要的是，`recursion_limit`是一个独立的`config`密钥，不应像所有其他用户定义的配置一样在`configurable`密钥内传递。请参阅下面的示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke(inputs, config={"recursion_limit": 5}, context={"llm": "anthropic"})
```

阅读 [Recursion limit](/oss/python/langgraph/graph-api#recursion-limit) 了解有关递归限制如何工作的更多信息。

### 访问和处理递归计数器

当前步计数器可在任何节点内的`config["metadata"]["langgraph_step"]`中访问，允许在达到递归限制之前进行主动递归处理。这使您能够在图形逻辑中实施优雅的降级策略。

#### 它是如何工作的

计步器存储在`config["metadata"]["langgraph_step"]`中。 LangGraph 在图形执行时递增此计数器，并在超出配置的 `recursion_limit` 时引发 `GraphRecursionError`。

#### 访问当前计步器

您可以访问任何节点内的当前步计数器以监控执行进度。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph

def my_node(state: dict, config: RunnableConfig) -> dict:
    current_step = config["metadata"]["langgraph_step"]
    print(f"Currently on step: {current_step}")
    return state
```#### 主动递归处理

LangGraph 提供了一个 `RemainingSteps` 托管值，用于跟踪在达到递归限制之前还剩多少步。这允许您的图表内进行优雅的降级。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated, Literal
from langgraph.graph import StateGraph, START, END
from langgraph.managed import RemainingSteps

class State(TypedDict):
    messages: Annotated[list, lambda x, y: x + y]
    remaining_steps: RemainingSteps  # Managed value - tracks steps until limit

def reasoning_node(state: State) -> dict:
    # RemainingSteps is automatically populated by LangGraph
    remaining = state["remaining_steps"]

    # Check if we're running low on steps
    if remaining <= 2:
        return {"messages": ["Approaching limit, wrapping up..."]}

    # Normal processing
    return {"messages": ["thinking..."]}

def route_decision(state: State) -> Literal["reasoning_node", "fallback_node"]:
    """Route based on remaining steps"""
    if state["remaining_steps"] <= 2:
        return "fallback_node"
    return "reasoning_node"

def fallback_node(state: State) -> dict:
    """Handle cases where recursion limit is approaching"""
    return {"messages": ["Reached complexity limit, providing best effort answer"]}

# Build graph
builder = StateGraph(State)
builder.add_node("reasoning_node", reasoning_node)
builder.add_node("fallback_node", fallback_node)
builder.add_edge(START, "reasoning_node")
builder.add_conditional_edges("reasoning_node", route_decision)
builder.add_edge("fallback_node", END)

graph = builder.compile()

# RemainingSteps works with any recursion_limit
result = graph.invoke({"messages": []}, {"recursion_limit": 10})
```

#### 主动与被动方法

处理递归限制有两种主要方法：主动式（在图表内监控）和被动式（在外部捕获错误）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated, Literal, TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.managed import RemainingSteps
from langgraph.errors import GraphRecursionError

class State(TypedDict):
    messages: Annotated[list, lambda x, y: x + y]
    remaining_steps: RemainingSteps

# Proactive Approach (recommended) - using RemainingSteps
def agent_with_monitoring(state: State) -> dict:
    """Proactively monitor and handle recursion within the graph"""
    remaining = state["remaining_steps"]

    # Early detection - route to internal handling
    if remaining <= 2:
        return {
            "messages": ["Approaching limit, returning partial result"]
        }

    # Normal processing
    return {"messages": [f"Processing... ({remaining} steps remaining)"]}

def route_decision(state: State) -> Literal["agent", END]:
    if state["remaining_steps"] <= 2:
        return END
    return "agent"

# Build graph
builder = StateGraph(State)
builder.add_node("agent", agent_with_monitoring)
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", route_decision)
graph = builder.compile()

# Proactive: Graph completes gracefully
result = graph.invoke({"messages": []}, {"recursion_limit": 10})

# Reactive Approach (fallback) - catching error externally
try:
    result = graph.invoke({"messages": []}, {"recursion_limit": 10})
except GraphRecursionError as e:
    # Handle externally after graph execution fails
    result = {"messages": ["Fallback: recursion limit exceeded"]}
```

这些方法之间的主要区别是：

|方法|检测|处理|控制流程|
| ---------------------------------------------------- | -------------------- | ------------------------------------------------ | ---------------------------------- |
|主动（使用`RemainingSteps`）|达到限制之前|通过条件路由的内部图 |图形继续完成节点 |
|反应式（捕捉`GraphRecursionError`）|超出限制后 | try/catch 中的外部图 |图形执行终止 |

**主动优势：*** 图表内的优雅降级
* 可以在检查点保存中间状态
* 部分结果带来更好的用户体验
* 图表正常完成（无异常）

**反应式优势：**

* 更简单的实现
* 无需修改图逻辑
* 集中错误处理

#### 其他可用元数据

除了 `langgraph_step` 之外，`config["metadata"]` 中还提供以下元数据：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def inspect_metadata(state: dict, config: RunnableConfig) -> dict:
    metadata = config["metadata"]

    print(f"Step: {metadata['langgraph_step']}")
    print(f"Node: {metadata['langgraph_node']}")
    print(f"Triggers: {metadata['langgraph_triggers']}")
    print(f"Path: {metadata['langgraph_path']}")
    print(f"Checkpoint NS: {metadata['langgraph_checkpoint_ns']}")

    return state
```

## 可视化

能够可视化图表通常是件好事，尤其是当它们变得更加复杂时。 LangGraph 附带了几种内置的图形可视化方法。请参阅[Visualize your graph](/oss/python/langgraph/use-graph-api#visualize-your-graph)了解更多信息。

## 可观察性和追踪

要跟踪、调试和评估您的代理，请使用[LangSmith](/langsmith/observability)。

## 了解更多

* [How to use the Graph API](/oss/python/langgraph/use-graph-api)
* [Functional API conceptual overview](/oss/python/langgraph/functional-api)
* [Choosing between Graph API and Functional API](/oss/python/langgraph/choosing-apis)

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>