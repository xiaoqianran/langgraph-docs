<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Define and update state | https://docs.langchain.com/oss/python/langgraph/graph-api-state -->

# 定义和更新状态

在 LangGraph Graph API 中定义图状态模式、reducer、消息和私有状态。

[State](/oss/python/langgraph/graph-api#state)是节点读写的共享模式。 [Reducers](/oss/python/langgraph/graph-api#reducers) 控制每次更新如何合并到当前值。此页面涵盖：

1. 如何使用状态来定义图的[schema](/oss/python/langgraph/graph-api#schema)
2. 如何使用reducers来控制状态更新的处理方式

## 定义状态

LangGraph 中的[State](/oss/python/langgraph/graph-api#state) 可以是`TypedDict`、`Pydantic` 模型或数据类。下面的示例使用`TypedDict`。大多数图表更喜欢这种形式；当您需要对输入进行运行时验证时，请参阅[Use Pydantic models for graph state](#use-pydantic-models-for-graph-state)。

默认情况下，图使用相同的模式进行输入和输出，并且状态决定该模式。有关不同的输入和输出模式，请参阅[Define input and output schemas](#define-input-and-output-schemas)。

从 [messages](/oss/python/langgraph/graph-api#working-with-messages-in-graph-state) 字段开始。这种形状适合许多法学硕士申请。欲了解更多详情，请参阅[Working with messages in graph state](/oss/python/langgraph/graph-api#working-with-messages-in-graph-state)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AnyMessage
from typing_extensions import TypedDict


class State(TypedDict):
    messages: list[AnyMessage]
    extra_field: int
```

此状态跟踪 [message](/oss/python/langchain/messages) 对象列表和一个额外的整数字段。目前还没有减速器，因此更新`messages`的节点必须返回完整列表。

## 更新状态

使用单个 [node](/oss/python/langgraph/graph-api#nodes) 构建图表。该节点是一个读取图状态并返回更新的 Python 函数。第一个参数始终是状态：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AIMessage


def node(state: State):
    messages = state["messages"]
    new_message = AIMessage("Hello!")
    return {"messages": messages + [new_message], "extra_field": 10}
```该节点通过连接返回值（还没有减速器）来附加消息并设置`extra_field`。

> [!警告]
>
> 节点应该直接返回状态更新，而不是改变状态。

使用此节点定义一个简单的图。使用 [⟦T40⟧](/oss/python/langgraph/graph-api#stategraph) 作为在此状态下运行的图，然后使用 [⟦T41⟧](/oss/python/langgraph/graph-api#nodes) 填充该图：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph

builder = StateGraph(State)
builder.add_node(node)
builder.set_entry_point("node")
graph = builder.compile()
```

LangGraph 提供用于可视化图形的内置实用程序。详情请参阅[Visualize your graph](/oss/python/langgraph/graph-api-visualize)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> n[node]

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class n process
    class startNode terminal
```

该图执行单个节点。调用它：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import HumanMessage

result = graph.invoke({"messages": [HumanMessage("Hi")]})
result
```

```
{'messages': [HumanMessage(content='Hi'), AIMessage(content='Hello!')], 'extra_field': 10}
```

请注意：

* 通过更新状态的单个键开始调用。
* 调用结果包含整个状态。

检查 [message](/oss/python/langchain/messages) 带有漂亮打印的内容：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for message in result["messages"]:
    message.pretty_print()
```

```
================================ Human Message ================================

Hi
================================== Ai Message ==================================

Hello!
```

## 使用减速器处理状态更新

状态中的每个键都可以有自己的[reducer](/oss/python/langgraph/graph-api#reducers)函数，该函数控制如何应用节点的更新。如果未指定reducer，则对该键的更新将替换以前的值。

对于`TypedDict`状态模式，通过使用reducer函数注释字段来定义reducer。

在前面的示例中，节点通过返回完整的串联列表来更新`"messages"`。添加一个减速器，以便自动附加更新：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import Annotated


def add(left, right):
    """Can also import `add` from the `operator` built-in."""
    return left + right


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add]  # [!code highlight]
    extra_field: int
```

然后该节点只能返回新消息：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def node(state: State):
    new_message = AIMessage("Hello!")
    return {"messages": [new_message], "extra_field": 10}  # [!code highlight]
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START

graph = StateGraph(State).add_node(node).add_edge(START, "node").compile()

result = graph.invoke({"messages": [HumanMessage("Hi")]})

for message in result["messages"]:
    message.pretty_print()
```

```
================================ Human Message ================================

Hi
================================== Ai Message ==================================

Hello!
```### 消息状态

在实践中，消息列表需要的不仅仅是简单的串联：

* 通过 ID 更新状态中的现有消息。
* 接受简写[message formats](/oss/python/langgraph/graph-api#serialization)，例如`{"role": "user", "content": "..."}`。

LangGraph 包含一个内置减速器 [⟦T45⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages)，可以处理这些情况：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph.message import add_messages


class State(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]  # [!code highlight]
    extra_field: int


def node(state: State):
    new_message = AIMessage("Hello!")
    return {"messages": [new_message], "extra_field": 10}


graph = StateGraph(State).add_node(node).set_entry_point("node").compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
input_message = {"role": "user", "content": "Hi"}  # [!code highlight]

result = graph.invoke({"messages": [input_message]})

for message in result["messages"]:
    message.pretty_print()
```

```
================================ Human Message ================================

Hi
================================== Ai Message ==================================

Hello!
```

此形状适合使用[chat models](/oss/python/langchain/models)的应用。为了方便起见，对预构建的 `MessagesState` 进行子类化：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import MessagesState


class State(MessagesState):
    extra_field: int
```

## 重置reducer字段

减速器常见的混淆来源是，使用合并减速器时，返回空值不会清除字段。减速器将右侧参数合并到左侧参数中，因此合并了一个空更新，并保留了先前累积的值。

此模式对于必须在重试尝试之间清除的错误缓冲区或重试计数器很重要：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from operator import add
from typing import Annotated

from typing_extensions import TypedDict


class State(TypedDict):
    errors: Annotated[list[str], add]


# node A returns {"errors": ["bad sql"]}
# node B returns {"errors": []}
# state["errors"] is still ["bad sql"]; the empty list is merged in, not cleared
```

要在保留合并减速器的同时清除字段，请使用 [⟦T47⟧](https://reference.langchain.com/python/langgraph/types/) 包装更新：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from operator import add
from typing import Annotated

from langgraph.types import Overwrite
from typing_extensions import TypedDict


class State(TypedDict):
    errors: Annotated[list[str], add]


def clear_errors(state: State):
    # Bypass the merging reducer and clear the field
    return {"errors": Overwrite([])}
```

有关更多信息，请参阅[Bypass reducers with Overwrite](#bypass-reducers-with-overwrite)。

## 带有 `Overwrite` 的旁路减速器

在某些情况下，您可能希望绕过减速器并直接覆盖状态值。当节点返回用 `Overwrite` 包装的值时，reducer 会被绕过，通道会直接设置为该值。当您想要重置或替换累积状态而不是将其与现有值合并时，这非常有用。

为此，LangGraph 提供了[⟦T50⟧](https://reference.langchain.com/python/langgraph/types/) 类型。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator

from langgraph.graph import END, START, StateGraph
from langgraph.types import Overwrite
from typing_extensions import Annotated, TypedDict


class State(TypedDict):
    messages: Annotated[list, operator.add]


def add_message(state: State):
    return {"messages": ["first message"]}


def replace_messages(state: State):
    # Bypass the reducer and replace the entire messages list
    return {"messages": Overwrite(["replacement message"])}


builder = StateGraph(State)
builder.add_node("add_message", add_message)
builder.add_node("replace_messages", replace_messages)
builder.add_edge(START, "add_message")
builder.add_edge("add_message", "replace_messages")
builder.add_edge("replace_messages", END)

graph = builder.compile()

result = graph.invoke({"messages": ["initial"]})
print(result["messages"])
```

```
['replacement message']
```

您还可以使用带有特殊键`"__overwrite__"`的JSON格式：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def replace_messages(state: State):
    return {"messages": {"__overwrite__": ["replacement message"]}}
```

> [!警告]
>
> 当节点并行执行时，只有一个节点可以在给定超级步骤中的同一状态键上使用`Overwrite`。如果多个节点尝试在同一个超级步骤中覆盖相同的密钥，则会引发`InvalidUpdateError`。 `Overwrite` 还会丢弃其他节点在该超级步骤中写入同一密钥的定期更新。密钥最终只有 `Overwrite` 值。

## 定义输入和输出模式

默认情况下，`StateGraph` 使用单个模式运行，所有节点都使用该模式进行通信。您还可以定义不同的输入和输出模式。

当指定不同的模式时，内部模式仍然用于节点之间的通信。输入模式验证提供的输入。输出模式过滤内部数据，因此 `invoke` 仅返回输出模式中的字段。

定义不同的输入和输出模式：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict


# Define the schema for the input
class InputState(TypedDict):
    question: str


# Define the schema for the output
class OutputState(TypedDict):
    answer: str


# Define the overall schema, combining both input and output
class OverallState(InputState, OutputState):
    pass


# Define the node that processes the input and generates an answer
def answer_node(state: InputState):
    # Example answer and an extra key
    return {"answer": "bye", "question": state["question"]}


# Build the graph with input and output schemas specified
builder = StateGraph(OverallState, input_schema=InputState, output_schema=OutputState)
builder.add_node(answer_node)  # Add the answer node
builder.add_edge(START, "answer_node")  # Define the starting edge
builder.add_edge("answer_node", END)  # Define the ending edge
graph = builder.compile()  # Compile the graph

# Invoke the graph with an input and print the result
print(graph.invoke({"question": "hi"}))
```

```
{'answer': 'bye'}
```

请注意，invoke 的输出仅包括输出模式。## 在节点之间传递私有状态

节点有时需要不应出现在图的主输入或输出模式中的中间数据。保持该数据的私密性，以便只有需要它的节点才能读取它。

以下顺序图具有三个节点。私有数据在前两个步骤之间传递。第三步只看公众整体状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END, START, StateGraph
from typing_extensions import TypedDict


# The overall state of the graph (this is the public state shared across nodes)
class OverallState(TypedDict):
    a: str


# Output from node_1 contains private data that is not part of the overall state
class Node1Output(TypedDict):
    private_data: str


# The private data is only shared between node_1 and node_2
def node_1(state: OverallState) -> Node1Output:
    output = {"private_data": "set by node_1"}
    print(f"Entered node `node_1`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


# Node 2 input only requests the private data available after node_1
class Node2Input(TypedDict):
    private_data: str


def node_2(state: Node2Input) -> OverallState:
    output = {"a": "set by node_2"}
    print(f"Entered node `node_2`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


# Node 3 only has access to the overall state (no access to private data from node_1)
def node_3(state: OverallState) -> OverallState:
    output = {"a": "set by node_3"}
    print(f"Entered node `node_3`:\n\tInput: {state}.\n\tReturned: {output}")
    return output


# Connect nodes in a sequence
# node_2 accepts private data from node_1, whereas
# node_3 does not see the private data.
builder = StateGraph(OverallState).add_sequence([node_1, node_2, node_3])
builder.add_edge(START, "node_1")
graph = builder.compile()

# Invoke the graph with the initial state
response = graph.invoke(
    {
        "a": "set at start",
    }
)

print()
print(f"Output of graph invocation: {response}")
```

```
Entered node `node_1`:
    Input: {'a': 'set at start'}.
    Returned: {'private_data': 'set by node_1'}
Entered node `node_2`:
    Input: {'private_data': 'set by node_1'}.
    Returned: {'a': 'set by node_2'}
Entered node `node_3`:
    Input: {'a': 'set by node_2'}.
    Returned: {'a': 'set by node_3'}

Output of graph invocation: {'a': 'set by node_3'}
```

## 私人频道和流媒体

输入、输出和私有模式限制每个节点读取的内容和`invoke`返回的内容。他们**不会**隐藏[streaming](/oss/python/langgraph/streaming)的频道。

默认情况下，值流会发出**所有**状态通道，包括私有通道。这适用于从 [event streaming](/oss/python/langgraph/event-streaming)（`stream_events` / `streamEvents` 和 `version="v3"`）到 `graph.stream` 的值投影（`stream_events` / `streamEvents` 上的`stream.values` 和 `stream_mode="values"` / `streamMode: "values"`）。值流使用完整状态，而不是输出模式。 `invoke` 输出中可能会缺少专用通道，但在流中可见。

此示例使用不同的输入、输出、整体和私有模式。 `invoke` 仅返回输出模式：

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

> [卡][View example trace](https://smith.langchain.com/public/370fbbfd-be69-4403-8123-716a0c2c9be6/r)
>
> 为此示例打开公共 LangSmith 运行。

使用值投影进行流式传输仍然包括私有 `bar` 通道：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events({"user_input": "My"}, version="v3")
for snapshot in stream.values:
    print(snapshot)
# {'user_input': 'My'}
# {'foo': 'My name', 'user_input': 'My'}
# {'foo': 'My name', 'user_input': 'My', 'bar': 'My name is'}        # <-- private channel
# {'foo': 'My name', 'user_input': 'My', 'graph_output': 'My name is Lance', 'bar': 'My name is'}
```> [卡][View example trace](https://smith.langchain.com/public/7d0325bb-3a2a-425f-a551-a636b297d0fb/r)
>
> 为此示例打开公共 LangSmith 运行。

要将流式值限制到特定通道（例如，仅输出模式），请将 `output_keys` 传递到 `graph.stream`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for snapshot in graph.stream(
    {"user_input": "My"},
    stream_mode="values",
    output_keys=["graph_output"],  # [!code highlight]
):
    print(snapshot)
# {'graph_output': 'My name is Lance'}
```

如果您只需要节点在每个步骤中生成的通道（而不是完整的累积状态），请改用`stream_mode="updates"`。参见[Streaming](/oss/python/langgraph/streaming)。

## 使用 pydantic 模型来表示图状态

[StateGraph](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 接受 [⟦T72⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema) 参数，该参数指定可以访问和更新的状态节点的形状。

本页上的大多数示例都使用 Python 原生 `TypedDict` 或 [⟦T74⟧](https://docs.python.org/3/library/dataclasses.html) 来表示 `state_schema`。 [⟦T76⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema) 可以是任意 [type](https://docs.python.org/3/library/stdtypes.html#type-objects)。

当您需要对**输入**进行运行时验证时，请使用 [Pydantic BaseModel](https://docs.pydantic.dev/latest/api/base_model/) 代替 [⟦T77⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema)。

> [!注意]
>
> **已知限制**
>
> * 图表的输出**不是** Pydantic 模型的实例。
> * 运行时验证仅发生在图中第一个节点的输入上，而不发生在后续节点或输出上。
> * Pydantic 的验证错误跟踪不显示错误出现在哪个节点。
> * Pydantic 的递归验证可能很慢。对于性能敏感的应用程序，首选`dataclass`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel


# The overall state of the graph (this is the public state shared across nodes)
class OverallState(BaseModel):
    a: str


def node(state: OverallState):
    return {"a": "goodbye"}


# Build the state graph
builder = StateGraph(OverallState)
builder.add_node(node)  # node_1 is the first node
builder.add_edge(START, "node")  # Start the graph with node_1
builder.add_edge("node", END)  # End the graph after node_1
graph = builder.compile()

# Test the graph with a valid input
graph.invoke({"a": "hello"})
```

使用**无效**输入调用图表

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
try:
    graph.invoke({"a": 123})  # Should be a string
except Exception as e:
    print("An exception was raised because `a` is an integer rather than a string.")
    print(e)
```

```
An exception was raised because `a` is an integer rather than a string.
1 validation error for OverallState
a
  Input should be a valid string [type=string_type, input_value=123, input_type=int]
    For further information visit https://errors.pydantic.dev/2.9/v/string_type
```

有关 Pydantic 模型状态的其他功能，请参阅下文：> [手风琴] 序列化行为
>
> 当使用 Pydantic 模型作为状态模式时，序列化尤其重要，尤其是在以下情况下：
>
> * 将 Pydantic 对象作为输入传递
> * 接收图表的输出
> * 使用嵌套 Pydantic 模型
>
> 以下示例显示了这些行为：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.graph import END, START, StateGraph
> from pydantic import BaseModel
>
>
> class NestedModel(BaseModel):
>     value: str
>
>
> class ComplexState(BaseModel):
>     text: str
>     count: int
>     nested: NestedModel
>
>
> def process_node(state: ComplexState):
>     # Node receives a validated Pydantic object
>     print(f"Input state type: {type(state)}")
>     print(f"Nested type: {type(state.nested)}")
>     # Return a dictionary update
>     return {"text": state.text + " processed", "count": state.count + 1}
>
>
> # Build the graph
> builder = StateGraph(ComplexState)
> builder.add_node("process", process_node)
> builder.add_edge(START, "process")
> builder.add_edge("process", END)
> graph = builder.compile()
>
> # Create a Pydantic instance for input
> input_state = ComplexState(text="hello", count=0, nested=NestedModel(value="test"))
> print(f"Input object type: {type(input_state)}")
>
> # Invoke graph with a Pydantic instance
> result = graph.invoke(input_state)
> print(f"Output type: {type(result)}")
> print(f"Output content: {result}")
>
> # Convert back to Pydantic model if needed
> output_model = ComplexState(**result)
> print(f"Converted back to Pydantic: {type(output_model)}")
> ```

> [手风琴] 运行时类型强制
>
> Pydantic 对某些数据类型执行运行时类型强制。这会有所帮助，但如果您不考虑它，它也可能会产生意想不到的值。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.graph import END, START, StateGraph
> from pydantic import BaseModel
>
>
> class CoercionExample(BaseModel):
>     # Pydantic will coerce string numbers to integers
>     number: int
>     # Pydantic will parse string booleans to bool
>     flag: bool
>
>
> def inspect_node(state: CoercionExample):
>     print(f"number: {state.number} (type: {type(state.number)})")
>     print(f"flag: {state.flag} (type: {type(state.flag)})")
>     return {}
>
>
> builder = StateGraph(CoercionExample)
> builder.add_node("inspect", inspect_node)
> builder.add_edge(START, "inspect")
> builder.add_edge("inspect", END)
> graph = builder.compile()
>
> # Demonstrate coercion with string inputs that will be converted
> result = graph.invoke({"number": "42", "flag": "true"})
>
> # This would fail with a validation error
> try:
>     graph.invoke({"number": "not-a-number", "flag": "true"})
> except Exception as e:
>     print(f"\nExpected validation error: {e}")
> ```

> [accordion] 使用消息模型
>
> 在状态模式中使用 LangChain 消息类型时，序列化很重要。当消息对象通过网络传输时，使用`AnyMessage`（而不是`BaseMessage`）进行正确的序列化和反序列化。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from typing import List
>
> from langchain.messages import AIMessage, AnyMessage, HumanMessage
> from langgraph.graph import END, START, StateGraph
> from pydantic import BaseModel
>
>
> class ChatState(BaseModel):
>     messages: List[AnyMessage]
>     context: str
>
>
> def add_message(state: ChatState):
>     return {"messages": state.messages + [AIMessage(content="Hello there!")]}
>
>
> builder = StateGraph(ChatState)
> builder.add_node("add_message", add_message)
> builder.add_edge(START, "add_message")
> builder.add_edge("add_message", END)
> graph = builder.compile()
>
> # Create input with a message
> initial_state = ChatState(
>     messages=[HumanMessage(content="Hi")], context="Customer support chat"
> )
>
> result = graph.invoke(initial_state)
> print(f"Output: {result}")
>
> # Convert back to Pydantic model to see message types
> output_model = ChatState(**result)
> for i, msg in enumerate(output_model.messages):
>     print(f"Message {i}: {type(msg).__name__} - {msg.content}")
> ```

## 另请参阅

* [Graph API overview](/oss/python/langgraph/graph-api#state)
* [Working with messages in graph state](/oss/python/langgraph/graph-api#working-with-messages-in-graph-state)
* [Event streaming](/oss/python/langgraph/event-streaming)
* [Streaming](/oss/python/langgraph/streaming)
* [Use the Graph API](/oss/python/langgraph/use-graph-api)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-state.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。