<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use the graph API | https://docs.langchain.com/oss/python/langgraph/use-graph-api -->

# 使用图形 API

本指南演示了 LangGraph 图形 API 的基础知识。它遍历了[state](#define-and-update-state)，并组合了常见的图结构，例如[sequences](#create-a-sequence-of-steps)、[branches](#create-branches)和[loops](#create-and-control-loops)。它还涵盖了 LangGraph 的控制功能，包括用于映射缩减工作流程的[Send API](#map-reduce-and-the-send-api)和用于将状态更新与跨节点“跳跃”相结合的[Command API](#combine-control-flow-and-state-updates-with-command)。

## 设置

安装`langgraph`：

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph
  ```
</CodeGroup>

<Tip>
  **设置 LangSmith 以便更好地调试**

  注册 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-use-graph-api) 可以快速发现问题并提高 LangGraph 项目的性能。 LangSmith 允许您使用跟踪数据来调试、测试和监控使用 LangGraph 构建的 LLM 应用程序 - 在 [docs](/langsmith/observability) 中了解有关如何开始的更多信息。
</Tip>

## 定义和更新状态

这里我们展示如何在 LangGraph 中定义和更新[state](/oss/python/langgraph/graph-api#state)。我们将演示：

1. 如何使用状态来定义图的[schema](/oss/python/langgraph/graph-api#schema)
2. 如何使用[reducers](/oss/python/langgraph/graph-api#reducers)来控制状态更新的处理方式。

### 定义状态

LangGraph 中的[State](/oss/python/langgraph/graph-api#state) 可以是`TypedDict`、`Pydantic` 模型或数据类。下面我们将使用`TypedDict`。有关使用 Pydantic 的详细信息，请参阅[Use Pydantic models for graph state](#use-pydantic-models-for-graph-state)。默认情况下，图将具有相同的输入和输出模式，并且状态决定该模式。有关如何定义不同的输入和输出模式，请参阅[Define input and output schemas](#define-input-and-output-schemas)。

让我们考虑一个使用 [messages](/oss/python/langgraph/graph-api#messagesstate) 的简单示例。这代表了许多法学硕士申请的通用状态表述。请参阅我们的[concepts page](/oss/python/langgraph/graph-api#working-with-messages-in-graph-state)了解更多详情。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AnyMessage
from typing_extensions import TypedDict

class State(TypedDict):
    messages: list[AnyMessage]
    extra_field: int
```

此状态跟踪 [message](https://python.langchain.com/docs/concepts/messages/) 对象列表，以及一个额外的整数字段。

### 更新状态

让我们构建一个具有单个节点的示例图。我们的[node](/oss/python/langgraph/graph-api#nodes)只是一个Python函数，它读取我们的图的状态并对其进行更新。该函数的第一个参数始终是状态：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AIMessage

def node(state: State):
    messages = state["messages"]
    new_message = AIMessage("Hello!")
    return {"messages": messages + [new_message], "extra_field": 10}
```

该节点只是将一条消息附加到我们的消息列表中，并填充一个额外的字段。

<Warning>
  节点应该直接返回状态更新，而不是改变状态。
</Warning>

接下来让我们定义一个包含该节点的简单图。我们使用[⟦T144⟧](/oss/python/langgraph/graph-api#stategraph)来定义一个在此状态上运行的图。然后我们使用 [⟦T145⟧](/oss/python/langgraph/graph-api#nodes) 填充我们的图表。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph

builder = StateGraph(State)
builder.add_node(node)
builder.set_entry_point("node")
graph = builder.compile()
```

LangGraph 提供了用于可视化图形的内置实用程序。让我们检查一下我们的图表。有关可视化的详细信息，请参阅[Visualize your graph](#visualize-your-graph)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Simple graph with single node" />在这种情况下，我们的图仅执行单个节点。让我们继续一个简单的调用：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import HumanMessage

result = graph.invoke({"messages": [HumanMessage("Hi")]})
result
```

```
{'messages': [HumanMessage(content='Hi'), AIMessage(content='Hello!')], 'extra_field': 10}
```

请注意：

* 我们通过更新状态的单个键来启动调用。
* 我们在调用结果中收到整个状态。

为了方便起见，我们经常通过漂亮打印检查[message objects](https://python.langchain.com/docs/concepts/messages/)的内容：

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

### 使用减速器处理状态更新

状态中的每个键都可以有自己独立的[reducer](/oss/python/langgraph/graph-api#reducers)函数，该函数控制如何应用节点的更新。如果没有显式指定减速器函数，则假定对键的所有更新都应覆盖它。

对于`TypedDict`状态模式，我们可以通过用reducer函数注释状态的相应字段来定义reducers。

在前面的示例中，我们的节点通过向其附加消息来更新状态中的 `"messages"` 键。下面，我们向该键添加一个减速器，以便自动附加更新：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import Annotated

def add(left, right):
    """Can also import `add` from the `operator` built-in."""
    return left + right

class State(TypedDict):
    messages: Annotated[list[AnyMessage], add]  # [!code highlight]
    extra_field: int
```

现在我们的节点可以简化：

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
```

#### 消息状态

在实践中，更新消息列表还有其他注意事项：* 我们可能希望更新该州的现有消息。
* 我们可能希望接受 [message formats](/oss/python/langgraph/graph-api#using-messages-in-your-graph) 的简写形式，例如 [OpenAI format](https://python.langchain.com/docs/concepts/messages/#openai-format)。

LangGraph 包含一个内置的减速器 [⟦T148⟧](https://reference.langchain.com/python/langgraph/graph/message/add_messages) 来处理这些注意事项：

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

对于涉及[chat models](https://python.langchain.com/docs/concepts/chat_models/)的应用程序来说，这是一种通用的状态表示。为了方便起见，LangGraph 包含一个预构建的 `MessagesState`，这样我们就可以：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import MessagesState

class State(MessagesState):
    extra_field: int
```

### 带有 `Overwrite` 的旁路减速器

在某些情况下，您可能希望绕过减速器并直接覆盖状态值。 LangGraph为此提供了[⟦T151⟧](https://reference.langchain.com/python/langgraph/types/)类型。当节点返回用 `Overwrite` 包装的值时，reducer 会被绕过，通道会直接设置为该值。

当您想要重置或替换累积状态而不是将其与现有值合并时，这非常有用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.types import Overwrite
from typing_extensions import Annotated, TypedDict
import operator

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

<Warning>
  当节点并行执行时，只有一个节点可以在给定超级步骤中的同一状态键上使用`Overwrite`。如果多个节点尝试在同一个超级步骤中覆盖相同的密钥，则会引发`InvalidUpdateError`。
</Warning>

### 定义输入和输出模式默认情况下，`StateGraph` 使用单个模式运行，并且所有节点都应使用该模式进行通信。但是，也可以为图定义不同的输入和输出模式。

当指定不同的模式时，内部模式仍将用于节点之间的通信。输入模式确保提供的输入与预期结构匹配，而输出模式根据定义的输出模式过滤内部数据以仅返回相关信息。

下面，我们将了解如何定义不同的输入和输出模式。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
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

请注意，invoke 的输出仅包括输出模式。

### 在节点之间传递私有状态

在某些情况下，您可能希望节点交换对中间逻辑至关重要的信息，但不需要成为图的主模式的一部分。该私有数据与图的整体输入/输出无关，仅应在某些节点之间共享。下面，我们将创建一个由三个节点（节点\_1、节点\_2和节点\_3）组成的示例顺序图，其中私有数据在前两个步骤（节点\_1和节点\_2）之间传递，而第三个步骤（节点\_3）只能访问公共整体状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
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

### 使用 pydantic 模型进行图状态

[StateGraph](https://langchain-ai.github.io/langgraph/reference/graphs.md#langgraph.graph.StateGraph) 在初始化时接受 [⟦T157⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema) 参数，该参数指定图中的节点可以访问和更新的状态的“形状”。

在我们的示例中，我们通常使用 python 原生 `TypedDict` 或 [⟦T159⟧](https://docs.python.org/3/library/dataclasses.html) 来表示 `state_schema`，但 [⟦T161⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema) 可以是任何 [type](https://docs.python.org/3/library/stdtypes.html#type-objects)。

在这里，我们将了解如何将 [Pydantic BaseModel](https://docs.pydantic.dev/latest/api/base_model/) 用于 [⟦T162⟧](https://reference.langchain.com/python/langchain/middleware/#langchain.agents.middleware.AgentMiddleware.state_schema) 以在 **输入** 上添加运行时验证。

<Note>
  **已知限制**

  * 目前，图表的输出**不是** pydantic 模型的实例。
  * 运行时验证仅发生在图中第一个节点的输入上，而不发生在后续节点或输出上。
  * pydantic 的验证错误跟踪不显示错误出现在哪个节点。
  * Pydantic 的递归验证可能很慢。对于性能敏感的应用程序，您可能需要考虑使用`dataclass`。
</Note>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from typing_extensions import TypedDict
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
``````
An exception was raised because `a` is an integer rather than a string.
1 validation error for OverallState
a
  Input should be a valid string [type=string_type, input_value=123, input_type=int]
    For further information visit https://errors.pydantic.dev/2.9/v/string_type
```

有关 Pydantic 模型状态的其他功能，请参阅下文：

<Accordion title="Serialization Behavior">
  当使用 Pydantic 模型作为状态模式时，了解序列化的工作原理非常重要，尤其是在以下情况下：

  * 传递 Pydantic 对象作为输入
  * 接收图表的输出
  * 使用嵌套 Pydantic 模型

  让我们看看这些行为的实际效果。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.graph import StateGraph, START, END
  from pydantic import BaseModel

  class NestedModel(BaseModel):
      value: str

  class ComplexState(BaseModel):
      text: str
      count: int
      nested: NestedModel

  def process_node(state: ComplexState):
      # Node receives a validated Pydantic object
      print(f"Input state type: {type(state)}")
      print(f"Nested type: {type(state.nested)}")
      # Return a dictionary update
      return {"text": state.text + " processed", "count": state.count + 1}

  # Build the graph
  builder = StateGraph(ComplexState)
  builder.add_node("process", process_node)
  builder.add_edge(START, "process")
  builder.add_edge("process", END)
  graph = builder.compile()

  # Create a Pydantic instance for input
  input_state = ComplexState(text="hello", count=0, nested=NestedModel(value="test"))
  print(f"Input object type: {type(input_state)}")

  # Invoke graph with a Pydantic instance
  result = graph.invoke(input_state)
  print(f"Output type: {type(result)}")
  print(f"Output content: {result}")

  # Convert back to Pydantic model if needed
  output_model = ComplexState(**result)
  print(f"Converted back to Pydantic: {type(output_model)}")
  ```
</Accordion>

<Accordion title="Runtime Type Coercion">
  Pydantic 对某些数据类型执行运行时类型强制。这可能会有所帮助，但如果您没有意识到，也会导致意外行为。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.graph import StateGraph, START, END
  from pydantic import BaseModel

  class CoercionExample(BaseModel):
      # Pydantic will coerce string numbers to integers
      number: int
      # Pydantic will parse string booleans to bool
      flag: bool

  def inspect_node(state: CoercionExample):
      print(f"number: {state.number} (type: {type(state.number)})")
      print(f"flag: {state.flag} (type: {type(state.flag)})")
      return {}

  builder = StateGraph(CoercionExample)
  builder.add_node("inspect", inspect_node)
  builder.add_edge(START, "inspect")
  builder.add_edge("inspect", END)
  graph = builder.compile()

  # Demonstrate coercion with string inputs that will be converted
  result = graph.invoke({"number": "42", "flag": "true"})

  # This would fail with a validation error
  try:
      graph.invoke({"number": "not-a-number", "flag": "true"})
  except Exception as e:
      print(f"\nExpected validation error: {e}")
  ```
</Accordion>

<Accordion title="Working with Message Models">
  在状态模式中使用 LangChain 消息类型时，序列化有重要的注意事项。当通过网络使用消息对象时，您应该使用 `AnyMessage` （而不是 `BaseMessage`）进行正确的序列化/反序列化。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.graph import StateGraph, START, END
  from pydantic import BaseModel
  from langchain.messages import HumanMessage, AIMessage, AnyMessage
  from typing import List

  class ChatState(BaseModel):
      messages: List[AnyMessage]
      context: str

  def add_message(state: ChatState):
      return {"messages": state.messages + [AIMessage(content="Hello there!")]}

  builder = StateGraph(ChatState)
  builder.add_node("add_message", add_message)
  builder.add_edge(START, "add_message")
  builder.add_edge("add_message", END)
  graph = builder.compile()

  # Create input with a message
  initial_state = ChatState(
      messages=[HumanMessage(content="Hi")], context="Customer support chat"
  )

  result = graph.invoke(initial_state)
  print(f"Output: {result}")

  # Convert back to Pydantic model to see message types
  output_model = ChatState(**result)
  for i, msg in enumerate(output_model.messages):
      print(f"Message {i}: {type(msg).__name__} - {msg.content}")
  ```
</Accordion>

## 添加运行时配置

有时您希望能够在调用图表时对其进行配置。例如，您可能希望能够指定在运行时使用什么 LLM 或系统提示，*不会用这些参数污染图形状态*。

添加运行时配置：1. 指定配置的架构
2. 将配置添加到节点或条件边的函数签名中
3. 将配置传递到图中。

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
    my_state_value: str

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

<Accordion title="Extended example: specifying LLM at runtime">
  下面我们演示一个实际示例，其中我们配置运行时使用的 LLM。我们将使用 OpenAI 和 Anthropic 模型。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from dataclasses import dataclass

  from langchain.chat_models import init_chat_model
  from langgraph.graph import MessagesState, END, StateGraph, START
  from langgraph.runtime import Runtime
  from typing_extensions import TypedDict

  @dataclass
  class ContextSchema:
      model_provider: str = "anthropic"

  MODELS = {
      "anthropic": init_chat_model("claude-haiku-4-5-20251001"),
      "openai": init_chat_model("gpt-5.4-mini"),
  }

  def call_model(state: MessagesState, runtime: Runtime[ContextSchema]):
      model = MODELS[runtime.context.model_provider]
      response = model.invoke(state["messages"])
      return {"messages": [response]}

  builder = StateGraph(MessagesState, context_schema=ContextSchema)
  builder.add_node("model", call_model)
  builder.add_edge(START, "model")
  builder.add_edge("model", END)

  graph = builder.compile()

  # Usage
  input_message = {"role": "user", "content": "hi"}
  # With no configuration, uses default (Anthropic)
  response_1 = graph.invoke({"messages": [input_message]}, context=ContextSchema())["messages"][-1]
  # Or, can set OpenAI
  response_2 = graph.invoke({"messages": [input_message]}, context={"model_provider": "openai"})["messages"][-1]

  print(response_1.response_metadata["model_name"])
  print(response_2.response_metadata["model_name"])
  ```

  ```
  claude-haiku-4-5-20251001
  gpt-5.4-mini
  ```
</Accordion>

<Accordion title="Extended example: specifying model and system message at runtime">
  下面我们演示一个实际示例，其中配置两个参数：运行时使用的 LLM 和系统消息。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from dataclasses import dataclass
  from langchain.chat_models import init_chat_model
  from langchain.messages import SystemMessage
  from langgraph.graph import END, MessagesState, StateGraph, START
  from langgraph.runtime import Runtime
  from typing_extensions import TypedDict

  @dataclass
  class ContextSchema:
      model_provider: str = "anthropic"
      system_message: str | None = None

  MODELS = {
      "anthropic": init_chat_model("claude-haiku-4-5-20251001"),
      "openai": init_chat_model("gpt-5.4-mini"),
  }

  def call_model(state: MessagesState, runtime: Runtime[ContextSchema]):
      model = MODELS[runtime.context.model_provider]
      messages = state["messages"]
      if (system_message := runtime.context.system_message):
          messages = [SystemMessage(system_message)] + messages
      response = model.invoke(messages)
      return {"messages": [response]}

  builder = StateGraph(MessagesState, context_schema=ContextSchema)
  builder.add_node("model", call_model)
  builder.add_edge(START, "model")
  builder.add_edge("model", END)

  graph = builder.compile()

  # Usage
  input_message = {"role": "user", "content": "hi"}
  response = graph.invoke({"messages": [input_message]}, context={"model_provider": "openai", "system_message": "Respond in Italian."})
  for message in response["messages"]:
      message.pretty_print()
  ```

  ```
  ================================ Human Message ================================

  hi
  ================================== Ai Message ==================================

  Ciao! Come posso aiutarti oggi?
  ```
</Accordion>

## 添加重试策略

在许多用例中，您可能希望节点具有自定义重试策略，例如，如果您正在调用 API、查询数据库或调用 LLM 等。LangGraph 允许您向节点添加重试策略。

要配置重试策略，请将`retry_policy`参数传递给[⟦T167⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)。 `retry_policy` 参数接受一个 `RetryPolicy` 命名元组对象。下面我们用默认参数实例化一个`RetryPolicy`对象，并将其与一个节点关联起来：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy

builder.add_node(
    "node_name",
    node_function,
    retry_policy=RetryPolicy(),
)
```

默认情况下，`retry_on`参数使用`default_retry_on`函数，该函数会重试除以下情况之外的任何异常：* `ValueError`
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

此外，对于流行的http请求库（例如`requests`和`httpx`）的异常，它仅重试5xx状态代码。

<Accordion title="Extended example: customizing retry policies">
  考虑一个我们正在从 SQL 数据库读取数据的示例。下面我们向节点传递两种不同的重试策略：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import sqlite3
  from typing_extensions import TypedDict
  from langchain.chat_models import init_chat_model
  from langgraph.graph import END, MessagesState, StateGraph, START
  from langgraph.types import RetryPolicy
  from langchain.messages import AIMessage

  con = sqlite3.connect(":memory:")
  model = init_chat_model("claude-haiku-4-5-20251001")

  def query_database(state: MessagesState):
      cursor = con.cursor()
      cursor.execute("SELECT * FROM Artist LIMIT 10;")
      query_result = str(cursor.fetchall())
      return {"messages": [AIMessage(content=query_result)]}

  def call_model(state: MessagesState):
      response = model.invoke(state["messages"])
      return {"messages": [response]}

  # Define a new graph
  builder = StateGraph(MessagesState)
  builder.add_node(
      "query_database",
      query_database,
      retry_policy=RetryPolicy(retry_on=sqlite3.OperationalError),
  )
  builder.add_node("model", call_model, retry_policy=RetryPolicy(max_attempts=5))
  builder.add_edge(START, "model")
  builder.add_edge("model", "query_database")
  builder.add_edge("query_database", END)
  graph = builder.compile()
  ```
</Accordion>

## 设置节点超时

将 `timeout` 参数与 [⟦T188⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 一起使用来限制单个异步节点调用可以运行的时间。提供以秒为单位的超时或作为 `datetime.timedelta`。

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
builder.add_edge(START, "model")
builder.add_edge("model", END)
graph = builder.compile()

try:
    await graph.ainvoke({"value": "start"})
except NodeTimeoutError:
    print("Node timed out")
```

仅异步节点支持节点超时。如果在同步节点上设置 `timeout`，LangGraph 在编译图时会引发错误，因为无法在进程中安全地取消同步 Python 执行。

当节点超过超时时间时，LangGraph 会引发 `NodeTimeoutError`，它是 Python 内置`TimeoutError` 的子类。如果节点有重试 `TimeoutError` 或 `NodeTimeoutError` 的 `retry_policy`，则会重试超时尝试。超时独立地应用于每次尝试，因此计时器会在每次重试时重置。

超时尝试不会提交其缓冲写入。这可以防止状态更新或子任务调度在超时边界后泄漏。## 配置节点超时

[⟦T197⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 上的 `timeout=` 参数限制了单个异步节点尝试可以运行的时间。传递数字（秒）、`timedelta`或[⟦T199⟧](https://reference.langchain.com/python/langgraph/types/TimeoutPolicy)以更好地控制运行和空闲超时。当超过限制时，LangGraph 会提高 [⟦T200⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError) 并让重试策略决定是否重试。

<Note>
  每个节点超时需要`langgraph>=1.2`。
</Note>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import TimeoutPolicy

builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(run_timeout=120, idle_timeout=30),
)
```

有关完整超时生命周期、空闲超时刷新源和 `runtime.heartbeat()`，请参阅 [Fault tolerance](/oss/python/langgraph/fault-tolerance#timeouts)。

## 处理节点错误

[⟦T204⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)上的`error_handler=`参数注册一个在节点失败且所有重试都用完后运行的函数。处理程序接收当前状态和带有失败上下文的类型化[⟦T205⟧](https://reference.langchain.com/python/langgraph/errors/NodeError)，并且可以通过[⟦T206⟧](https://reference.langchain.com/python/langgraph/types/Command)路由到恢复分支：

<Note>
  节点级错误处理程序需要`langgraph>=1.2`。
</Note>

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

请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance#error-handling)了解补偿模式和`Command`布线。

## 设置图范围节点默认值

<Note>
  需要`langgraph>=1.2`。
</Note>

使用 [⟦T210⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/set_node_defaults) 为图中的每个节点设置 `retry_policy`、`timeout`、`cache_policy` 或 `error_handler` 一次，而不是在每个 [⟦T215⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 调用中重复它们。每个节点的值总是获胜，并且在 [⟦T216⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile) 时间应用默认值：

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
````retry_policy` 和 `timeout` 默认值适用于每个节点，包括错误处理程序节点。 `cache_policy` 和 `error_handler` 默认值仅适用于常规节点 - 处理程序永远不会捕获自己，并且缓存处理程序结果是不安全的。子图不会继承默认值。

有关完整的优先级规则和适用性表，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance#graph-defaults)。

### 访问节点内的执行信息

您可以通过`runtime.execution_info`访问执行身份和重试信息。这会显示线程、运行和检查点标识符以及重试状态，而无需直接从 `config` 读取。|属性|类型 |描述 |
| ---------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `thread_id` | `str \| None` |当前执行的线程 ID。 `None` 没有检查点。                              |
| `run_id` | `str \| None` |当前执行的运行 ID。 `None` 当配置中未提供时。                            |
| `checkpoint_id` | `str` |当前执行的检查点 ID。                                                         |
| `checkpoint_ns` | `str` |当前执行的检查点命名空间。                                                  |
| `task_id` | `str` |当前执行的任务 ID。                                                               |
| `node_attempt` | `int` |当前执行尝试次数（1 索引）。第一次尝试时为`1`，第一次重试时为`2`，等等 || `node_first_attempt_time` | `float \| None` |第一次尝试开始时的 Unix 时间戳（秒）。重试后保持不变。       |

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
    if info.node_attempt > 1:  # [!code highlight]
        # use a fallback on retries
        return {"result": call_fallback_api()}
    return {"result": call_primary_api()}

builder = StateGraph(State)
builder.add_node("my_node", my_node, retry_policy=RetryPolicy(max_attempts=3))
builder.add_edge(START, "my_node")
builder.add_edge("my_node", END)
graph = builder.compile()
```

即使没有重试策略，`execution_info` 也可在 `Runtime` 对象上使用 — `node_attempt` 默认为 `1`，`node_first_attempt_time` 设置为节点开始执行的时间。

### 访问节点内的服务器信息

当您的图形在 LangGraph Server 上运行时，您可以通过 `runtime.server_info` 访问特定于服务器的元数据。这会显示助手 ID、图形 ID 和经过身份验证的用户，而无需直接读取配置元数据或可配置密钥。|属性 |类型 |描述 |
| -------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `assistant_id` | `str` |当前部署的助手 ID。                                    |
| `graph_id` | `str` |当前部署的图形 ID。                                        |
| `user` | `BaseUser \| None` |经过身份验证的用户（如果配置了 [custom auth](/langsmith/custom-auth)）。 |

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

当图未在 LangGraph Server 上运行时（例如，在本地开发或测试期间），`server_info` 为 `None`。

<Note>
  `runtime.execution_info` 和 `runtime.server_info` 需要 `deepagents>=0.5.0`（或 `langgraph>=1.1.5`）。
</Note>

### 访问节点内的耗尽状态

当请求 [graceful shutdown](/oss/python/langgraph/fault-tolerance#graceful-shutdown) 时，`runtime.drain_requested` 为 `True`。在节点内读取此内容以在下一个超级步边界之前跳过昂贵的工作：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import Runtime

def my_node(state: State, runtime: Runtime) -> State:
    if runtime.drain_requested:  # [!code highlight]
        return {"status": "skipped", "reason": runtime.drain_reason}
    return {"status": do_work()}
```|物业 |类型 |描述 |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `drain_requested` | `bool` | `True` 如果本次运行已调用 `RunControl.request_drain()`。                 |
| `drain_reason` | `str \| None` |原因字符串传递给 `request_drain()`，如果未请求排出，则传递给 `None`。 |

<Note>
  需要`langgraph>=1.2`。请参阅 [Graceful shutdown](/oss/python/langgraph/fault-tolerance#graceful-shutdown) 了解完整的 `RunControl` API。
</Note>

## 添加节点缓存

当您想要避免重复操作时，例如在执行昂贵的操作（无论是时间还是成本）时，节点缓存非常有用。 LangGraph 允许您向图表中的节点添加个性化的缓存策略。

要配置缓存策略，请将 `cache_policy` 参数传递给 [⟦T274⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 函数。在以下示例中，实例化了一个 [⟦T275⟧](https://reference.langchain.com/python/langgraph/types/CachePolicy) 对象，其生存时间为 120 秒，并使用默认的 `key_func` 生成器。然后它与一个节点关联：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import CachePolicy

builder.add_node(
    "node_name",
    node_function,
    cache_policy=CachePolicy(ttl=120),
)
```然后，要为图启用节点级缓存，请在编译图时设置 `cache` 参数。下面的示例使用 `InMemoryCache` 设置具有内存缓存的图，但 `SqliteCache` 也可用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.cache.memory import InMemoryCache

graph = builder.compile(cache=InMemoryCache())
```

## 创建一系列步骤

<Info>
  **先决条件**
  本指南假设您熟悉上述 [state](#define-and-update-state) 部分。
</Info>

在这里，我们演示如何构建简单的步骤序列。我们将展示：

1. 如何构建时序图
2. 内置用于构造相似图的速记法。

要添加节点序列，我们使用 [graph](/oss/python/langgraph/graph-api#stategraph) 的 [⟦T280⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 和 [⟦T281⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge) 方法：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import START, StateGraph

builder = StateGraph(State)

# Add nodes
builder.add_node(step_1)
builder.add_node(step_2)
builder.add_node(step_3)

# Add edges
builder.add_edge(START, "step_1")
builder.add_edge("step_1", "step_2")
builder.add_edge("step_2", "step_3")
```

我们还可以使用内置的简写`.add_sequence`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State).add_sequence([step_1, step_2, step_3])
builder.add_edge(START, "step_1")
```

<Accordion title="Why split application steps into a sequence with LangGraph?">
  LangGraph 可以轻松地向您的应用程序添加底层持久层。
  这允许在节点执行之间设置状态检查点，因此您的 LangGraph 节点可以控制：

  * 状态更新是怎样的[checkpointed](/oss/python/langgraph/persistence)
  * 如何在[human-in-the-loop](/oss/python/langgraph/interrupts)工作流程中恢复中断
  * 我们如何使用 LangGraph 的 [time travel](/oss/python/langgraph/use-time-travel) 功能“倒带”和分支执行

  它们还确定执行步骤如何[streamed](/oss/python/langgraph/streaming)，以及如何使用[Studio](/langsmith/studio)可视化和调试应用程序。让我们演示一个端到端的示例。我们将创建一个包含三个步骤的序列：

  1.在state的key中填充一个值
  2.更新相同的值
  3. 填充不同的值

  让我们首先定义我们的[state](/oss/python/langgraph/graph-api#state)。这控制[schema of the graph](/oss/python/langgraph/graph-api#schema)，并且还可以指定如何应用更新。有关更多详细信息，请参阅[Process state updates with reducers](#process-state-updates-with-reducers)。

  在我们的例子中，我们将只跟踪两个值：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing_extensions import TypedDict

  class State(TypedDict):
      value_1: str
      value_2: int
  ```

  我们的 [nodes](/oss/python/langgraph/graph-api#nodes) 只是读取图表状态并对其进行更新的 Python 函数。该函数的第一个参数始终是状态：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def step_1(state: State):
      return {"value_1": "a"}

  def step_2(state: State):
      current_value_1 = state["value_1"]
      return {"value_1": f"{current_value_1} b"}

  def step_3(state: State):
      return {"value_2": 10}
  ```

  <Note>
    请注意，当向状态发出更新时，每个节点只能指定它希望更新的键的值。

    默认情况下，这将**覆盖**相应键的值。您还可以使用 [reducers](/oss/python/langgraph/graph-api#reducers) 来控制更新的处理方式，例如，您可以将连续的更新附加到某个键。有关更多详细信息，请参阅[Process state updates with reducers](#process-state-updates-with-reducers)。
  </Note>

  最后，我们定义图表。我们使用[StateGraph](/oss/python/langgraph/graph-api#stategraph)来定义一个在此状态上运行的图。

  然后，我们将使用 [⟦T283⟧](/oss/python/langgraph/graph-api#messagesstate) 和 [⟦T284⟧](/oss/python/langgraph/graph-api#edges) 来填充我们的图表并定义其控制流。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.graph import START, StateGraph

  builder = StateGraph(State)

  # Add nodes
  builder.add_node(step_1)
  builder.add_node(step_2)
  builder.add_node(step_3)

  # Add edges
  builder.add_edge(START, "step_1")
  builder.add_edge("step_1", "step_2")
  builder.add_edge("step_2", "step_3")
  ```<Tip>
    **指定自定义名称**
    您可以使用 [⟦T285⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 为节点指定自定义名称：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    builder.add_node("my_node", step_1)
    ```
  </Tip>

  请注意：

  * [⟦T286⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge) 采用节点名称，对于函数来说默认为 `node.__name__`。
  * 我们必须指定图表的入口点。为此，我们添加一条带有 [START node](/oss/python/langgraph/graph-api#start-node) 的边。
  * 当没有更多节点要执行时，图表将停止。

  接下来是[compile](/oss/python/langgraph/graph-api#compiling-your-graph)我们的图表。这提供了对图结构的一些基本检查（例如，识别孤立节点）。如果我们通过 [checkpointer](/oss/python/langgraph/persistence) 添加持久性到我们的应用程序中，它也会被传递到这里。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  graph = builder.compile()
  ```

  LangGraph 提供了用于可视化图形的内置实用程序。让我们检查一下我们的序列。有关可视化的详细信息，请参阅[Visualize your graph](#visualize-your-graph)。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from IPython.display import Image, display

  display(Image(graph.get_graph().draw_mermaid_png()))
  ```

  <img alt="Sequence of steps graph" />

  让我们继续一个简单的调用：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  graph.invoke({"value_1": "c"})
  ```

  ```
  {'value_1': 'a b', 'value_2': 10}
  ```

  请注意：

  * 我们通过为单个状态键提供一个值来启动调用。我们必须始终为至少一个键提供一个值。
  * 我们传入的值被第一个节点覆盖了。
  * 第二个节点更新了值。
  * 第三个节点填充了不同的值。<Tip>
    **内置速记**
    `langgraph>=0.2.46` 包含用于添加节点序列的内置速记法 `add_sequence`。您可以按如下方式编译相同的图表：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    builder = StateGraph(State).add_sequence([step_1, step_2, step_3])  # [!code highlight]
    builder.add_edge(START, "step_1")

    graph = builder.compile()

    graph.invoke({"value_1": "c"})
    ```
  </Tip>
</Accordion>

## 创建分支

节点的并行执行对于加速整体图操作至关重要。 LangGraph 提供对节点并行执行的本机支持，这可以显着增强基于图的工作流的性能。这种并行化是通过扇出和扇入机制实现的，同时利用标准边缘和[conditional\_edges](https://langchain-ai.github.io/langgraph/reference/graphs.md#langgraph.graph.MessageGraph.add_conditional_edges)。下面是一些示例，展示了如何添加创建适合您的分支数据流。

### 并行运行图节点

在此示例中，我们从 `Node A` 扇出到 `B and C`，然后扇入到 `D`。对于我们的州，[we specify the reducer add operation](/oss/python/langgraph/graph-api#reducers)。这将组合或累积 State 中特定键的值，而不是简单地覆盖现有值。对于列表，这意味着将新列表与现有列表连接起来。有关使用减速器更新状态的更多详细信息，请参阅上面关于 [state reducers](#process-state-updates-with-reducers) 的部分。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    # The operator.add reducer fn makes this append-only
    aggregate: Annotated[list, operator.add]

def a(state: State):
    print(f'Adding "A" to {state["aggregate"]}')
    return {"aggregate": ["A"]}

def b(state: State):
    print(f'Adding "B" to {state["aggregate"]}')
    return {"aggregate": ["B"]}

def c(state: State):
    print(f'Adding "C" to {state["aggregate"]}')
    return {"aggregate": ["C"]}

def d(state: State):
    print(f'Adding "D" to {state["aggregate"]}')
    return {"aggregate": ["D"]}

builder = StateGraph(State)
builder.add_node(a)
builder.add_node(b)
builder.add_node(c)
builder.add_node(d)
builder.add_edge(START, "a")
builder.add_edge("a", "b")
builder.add_edge("a", "c")
builder.add_edge("b", "d")
builder.add_edge("c", "d")
builder.add_edge("d", END)
graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Parallel execution graph" />

通过reducer，可以看到每个节点添加的值都被累加了。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"aggregate": []}, {"configurable": {"thread_id": "foo"}})
```

```
Adding "A" to []
Adding "B" to ['A']
Adding "C" to ['A']
Adding "D" to ['A', 'B', 'C']
```<Note>
  在上面的例子中，节点`"b"`和`"c"`在同一个[superstep](/oss/python/langgraph/graph-api#graphs)中并发执行。由于它们处于同一步骤，因此节点 `"d"` 在 `"b"` 和 `"c"` 都完成后执行。

  重要的是，来自并行超级步的更新的顺序可能不一致。如果您需要从并行超级步中对更新进行一致的、预定的排序，则应将输出连同用于排序的值一起写入状态中的单独字段。
</Note>

<Accordion title="Exception handling?">
  LangGraph 在[supersteps](/oss/python/langgraph/graph-api#graphs)内执行节点，这意味着虽然并行分支是并行执行的，但整个超级步骤是**事务性的**。如果这些分支中的任何一个引发异常，则不会将任何更新应用于状态（整个超级步骤错误）。

  重要的是，当使用[checkpointer](/oss/python/langgraph/persistence)时，超级步内成功节点的结果将被保存，并且在恢复时不会重复。

  如果您容易出错（也许想要处理不稳定的 API 调用），LangGraph 提供了两种方法来解决这个问题：1. 您可以在节点内编写常规Python代码来捕获和处理异常。
  2. 您可以设置 **[retry\_policy](https://langchain-ai.github.io/langgraph/reference/types/#langgraph.types.RetryPolicy)** 来指示图形重试引发某些类型异常的节点。仅重试失败的分支，因此您不必担心执行多余的工作。

  这些共同使您可以执行并行执行并完全控制异常处理。
</Accordion>

<Tip>
  **设置最大并发数**
  您可以在调用图表时通过设置[configuration](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)中的`max_concurrency`来控制最大并发任务数。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  graph.invoke({"value_1": "c"}, {"configurable": {"max_concurrency": 10}})
  ```
</Tip>

### 推迟节点执行

当您想要延迟节点的执行直到所有其他待处理任务完成时，延迟节点执行非常有用。当分支具有不同长度时，这一点尤其重要，这在映射缩减流等工作流程中很常见。

上面的示例展示了当每条路径只有一步时如何进行扇出和扇入。但如果一个分支有多个步骤怎么办？让我们在 `"b"` 分支中添加一个节点 `"b_2"`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Any
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    # The operator.add reducer fn makes this append-only
    aggregate: Annotated[list, operator.add]

def a(state: State):
    print(f'Adding "A" to {state["aggregate"]}')
    return {"aggregate": ["A"]}

def b(state: State):
    print(f'Adding "B" to {state["aggregate"]}')
    return {"aggregate": ["B"]}

def b_2(state: State):
    print(f'Adding "B_2" to {state["aggregate"]}')
    return {"aggregate": ["B_2"]}

def c(state: State):
    print(f'Adding "C" to {state["aggregate"]}')
    return {"aggregate": ["C"]}

def d(state: State):
    print(f'Adding "D" to {state["aggregate"]}')
    return {"aggregate": ["D"]}

builder = StateGraph(State)
builder.add_node(a)
builder.add_node(b)
builder.add_node(b_2)
builder.add_node(c)
builder.add_node(d, defer=True)  # [!code highlight]
builder.add_edge(START, "a")
builder.add_edge("a", "b")
builder.add_edge("a", "c")
builder.add_edge("b", "b_2")
builder.add_edge("b_2", "d")
builder.add_edge("c", "d")
builder.add_edge("d", END)
graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Deferred execution graph" />

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"aggregate": []})
```

```
Adding "A" to []
Adding "B" to ['A']
Adding "C" to ['A']
Adding "B_2" to ['A', 'B', 'C']
Adding "D" to ['A', 'B', 'C', 'B_2']
```在上面的示例中，节点`"b"`和`"c"`在同一超级步中同时执行。我们在节点 `d` 上设置 `defer=True`，以便在所有挂起的任务完成之前它不会执行。在这种情况下，这意味着 `"d"` 等待执行，直到整个 `"b"` 分支完成。

### 条件分支

如果您的扇出在运行时应根据状态而变化，您可以使用 [⟦T307⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges) 使用图形状态选择一个或多个路径。请参阅下面的示例，其中节点 `a` 生成确定后续节点的状态更新。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Literal, Sequence
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    aggregate: Annotated[list, operator.add]
    # Add a key to the state. We will set this key to determine
    # how we branch.
    which: str

def a(state: State):
    print(f'Adding "A" to {state["aggregate"]}')
    return {"aggregate": ["A"], "which": "c"}  # [!code highlight]

def b(state: State):
    print(f'Adding "B" to {state["aggregate"]}')
    return {"aggregate": ["B"]}

def c(state: State):
    print(f'Adding "C" to {state["aggregate"]}')
    return {"aggregate": ["C"]}

builder = StateGraph(State)
builder.add_node(a)
builder.add_node(b)
builder.add_node(c)
builder.add_edge(START, "a")
builder.add_edge("b", END)
builder.add_edge("c", END)

def conditional_edge(state: State) -> Literal["b", "c"]:
    # Fill in arbitrary logic here that uses the state
    # to determine the next node
    return state["which"]

builder.add_conditional_edges("a", conditional_edge)  # [!code highlight]

graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Conditional branching graph" />

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
result = graph.invoke({"aggregate": []})
print(result)
```

```
Adding "A" to []
Adding "C" to ['A']
{'aggregate': ['A', 'C'], 'which': 'c'}
```

<Tip>
  您的条件边可以路由到多个目标节点。例如：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def route_bc_or_cd(state: State) -> Sequence[str]:
      if state["which"] == "cd":
          return ["c", "d"]
      return ["b", "c"]
  ```
</Tip>

## Map-Reduce 和发送 API

LangGraph 使用发送 API 支持映射缩减和其他高级分支模式。以下是如何使用它的示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START, END
from langgraph.types import Send
from typing_extensions import TypedDict, Annotated
import operator

class OverallState(TypedDict):
    topic: str
    subjects: list[str]
    jokes: Annotated[list[str], operator.add]
    best_selected_joke: str

def generate_topics(state: OverallState):
    return {"subjects": ["lions", "elephants", "penguins"]}

def generate_joke(state: OverallState):
    joke_map = {
        "lions": "Why don't lions like fast food? Because they can't catch it!",
        "elephants": "Why don't elephants use computers? They're afraid of the mouse!",
        "penguins": "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice."
    }
    return {"jokes": [joke_map[state["subject"]]]}

def continue_to_jokes(state: OverallState):
    return [Send("generate_joke", {"subject": s}) for s in state["subjects"]]

def best_joke(state: OverallState):
    return {"best_selected_joke": "penguins"}

builder = StateGraph(OverallState)
builder.add_node("generate_topics", generate_topics)
builder.add_node("generate_joke", generate_joke)
builder.add_node("best_joke", best_joke)
builder.add_edge(START, "generate_topics")
builder.add_conditional_edges("generate_topics", continue_to_jokes, ["generate_joke"])
builder.add_edge("generate_joke", "best_joke")
builder.add_edge("best_joke", END)
graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Map-reduce graph with fanout" />

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Call the graph: here we call it to generate a list of jokes
stream = graph.stream_events({"topic": "animals"}, version="v3")
for message in stream.messages:
    for token in message.text:
        print(token, end="", flush=True)
```

```
{'generate_topics': {'subjects': ['lions', 'elephants', 'penguins']}}
{'generate_joke': {'jokes': ["Why don't lions like fast food? Because they can't catch it!"]}}
{'generate_joke': {'jokes': ["Why don't elephants use computers? They're afraid of the mouse!"]}}
{'generate_joke': {'jokes': ['Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice.']}}
{'best_joke': {'best_selected_joke': 'penguins'}}
```

## 创建和控制循环

当创建带有循环的图时，我们需要一种终止执行的机制。最常见的方法是添加一个 [conditional edge](/oss/python/langgraph/graph-api#conditional-edges) ，一旦达到某些终止条件，该[END](/oss/python/langgraph/graph-api#end-node) 节点就会路由到 [END](/oss/python/langgraph/graph-api#end-node) 节点。您还可以在调用或流式传输图形时设置图形递归限制。递归限制设置了图表在引发错误之前允许执行的 [super-steps](/oss/python/langgraph/graph-api#graphs) 的数量。了解有关 [recursion limit concept](/oss/python/langgraph/graph-api#recursion-limit) 的更多信息。

让我们考虑一个带有循环的简单图，以更好地理解这些机制是如何工作的。

<Tip>
  要返回状态的最后一个值而不是收到递归限制错误，请参阅 [next section](#impose-a-recursion-limit)。
</Tip>

创建循环时，可以包含指定终止条件的条件边：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State)
builder.add_node(a)
builder.add_node(b)

def route(state: State) -> Literal["b", END]:
    if termination_condition(state):
        return END
    else:
        return "b"

builder.add_edge(START, "a")
builder.add_conditional_edges("a", route)
builder.add_edge("b", "a")
graph = builder.compile()
```

要控制递归限制，请在配置中指定`"recursion_limit"`。这将引发一个 `GraphRecursionError`，您可以捕获并处理它：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import GraphRecursionError

try:
    graph.invoke(inputs, {"recursion_limit": 3})
except GraphRecursionError:
    print("Recursion Error")
```

让我们用一个简单的循环来定义一个图。请注意，我们使用条件边来实现终止条件。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    # The operator.add reducer fn makes this append-only
    aggregate: Annotated[list, operator.add]

def a(state: State):
    print(f'Node A sees {state["aggregate"]}')
    return {"aggregate": ["A"]}

def b(state: State):
    print(f'Node B sees {state["aggregate"]}')
    return {"aggregate": ["B"]}

# Define nodes
builder = StateGraph(State)
builder.add_node(a)
builder.add_node(b)

# Define edges
def route(state: State) -> Literal["b", END]:
    if len(state["aggregate"]) < 7:
        return "b"
    else:
        return END

builder.add_edge(START, "a")
builder.add_conditional_edges("a", route)
builder.add_edge("b", "a")
graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Simple loop graph" />

该架构类似于[ReAct agent](/oss/python/langgraph/workflows-agents)，其中节点`"a"`是工具调用模型，节点`"b"`代表工具。

在我们的 `route` 条件边中，我们指定应该在状态中的 `"aggregate"` 列表超过阈值长度后结束。

调用该图，我们看到在达到终止条件后终止之前，我们在节点 `"a"` 和 `"b"` 之间交替。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"aggregate": []})
``````
Node A sees []
Node B sees ['A']
Node A sees ['A', 'B']
Node B sees ['A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B']
Node B sees ['A', 'B', 'A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B', 'A', 'B']
```

### 施加递归限制

在某些应用中，我们可能无法保证会达到给定的终止条件。在这些情况下，我们可以设置图表的[recursion limit](/oss/python/langgraph/graph-api#recursion-limit)。这将在给定数量的 [supersteps](/oss/python/langgraph/graph-api#graphs) 之后引发 `GraphRecursionError`。然后我们可以捕获并处理这个异常：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.errors import GraphRecursionError

try:
    graph.invoke({"aggregate": []}, {"recursion_limit": 4})
except GraphRecursionError:
    print("Recursion Error")
```

```
Node A sees []
Node B sees ['A']
Node C sees ['A', 'B']
Node D sees ['A', 'B']
Node A sees ['A', 'B', 'C', 'D']
Recursion Error
```

<Accordion title="Extended example: return state on hitting recursion limit">
  我们可以引入一个新的状态键来跟踪剩余步骤数，直到达到递归限制，而不是提高`GraphRecursionError`。然后我们可以使用这个键来确定是否应该结束运行。

  LangGraph 实现了一个特殊的 `RemainingSteps` 注释。在底层，它创建了一个 `ManagedValue` 通道——一个状态通道，它将在我们的图形运行期间存在，并且不再存在。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import operator
  from typing import Annotated, Literal
  from typing_extensions import TypedDict
  from langgraph.graph import StateGraph, START, END
  from langgraph.managed.is_last_step import RemainingSteps

  class State(TypedDict):
      aggregate: Annotated[list, operator.add]
      remaining_steps: RemainingSteps

  def a(state: State):
      print(f'Node A sees {state["aggregate"]}')
      return {"aggregate": ["A"]}

  def b(state: State):
      print(f'Node B sees {state["aggregate"]}')
      return {"aggregate": ["B"]}

  # Define nodes
  builder = StateGraph(State)
  builder.add_node(a)
  builder.add_node(b)

  # Define edges
  def route(state: State) -> Literal["b", END]:
      if state["remaining_steps"] <= 2:
          return END
      else:
          return "b"

  builder.add_edge(START, "a")
  builder.add_conditional_edges("a", route)
  builder.add_edge("b", "a")
  graph = builder.compile()

  # Test it out
  result = graph.invoke({"aggregate": []}, {"recursion_limit": 4})
  print(result)
  ```

  ```
  Node A sees []
  Node B sees ['A']
  Node A sees ['A', 'B']
  {'aggregate': ['A', 'B', 'A']}
  ```
</Accordion>

<Accordion title="Extended example: loops with branches">
  为了更好地理解递归限制的工作原理，让我们考虑一个更复杂的示例。下面我们实现一个循环，但一步扇出到两个节点：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import operator
  from typing import Annotated, Literal
  from typing_extensions import TypedDict
  from langgraph.graph import StateGraph, START, END

  class State(TypedDict):
      aggregate: Annotated[list, operator.add]

  def a(state: State):
      print(f'Node A sees {state["aggregate"]}')
      return {"aggregate": ["A"]}

  def b(state: State):
      print(f'Node B sees {state["aggregate"]}')
      return {"aggregate": ["B"]}

  def c(state: State):
      print(f'Node C sees {state["aggregate"]}')
      return {"aggregate": ["C"]}

  def d(state: State):
      print(f'Node D sees {state["aggregate"]}')
      return {"aggregate": ["D"]}

  # Define nodes
  builder = StateGraph(State)
  builder.add_node(a)
  builder.add_node(b)
  builder.add_node(c)
  builder.add_node(d)

  # Define edges
  def route(state: State) -> Literal["b", END]:
      if len(state["aggregate"]) < 7:
          return "b"
      else:
          return END

  builder.add_edge(START, "a")
  builder.add_conditional_edges("a", route)
  builder.add_edge("b", "c")
  builder.add_edge("b", "d")
  builder.add_edge(["c", "d"], "a")
  graph = builder.compile()
  ```

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from IPython.display import Image, display

  display(Image(graph.get_graph().draw_mermaid_png()))
  ```

  <img alt="Complex loop graph with branches" />

  该图看起来很复杂，但可以概念化为[supersteps](/oss/python/langgraph/graph-api#graphs)的循环：

  1. 节点A
  2. 节点B
  3. 节点C和D
  4. 节点A
  5....

  我们有一个包含四个超级步骤的循环，其中节点 C 和 D 是同时执行的。像以前一样调用图表，我们看到在达到终止条件之前我们完成了两个完整的“圈”：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  result = graph.invoke({"aggregate": []})
  ```

  ```
  Node A sees []
  Node B sees ['A']
  Node D sees ['A', 'B']
  Node C sees ['A', 'B']
  Node A sees ['A', 'B', 'C', 'D']
  Node B sees ['A', 'B', 'C', 'D', 'A']
  Node D sees ['A', 'B', 'C', 'D', 'A', 'B']
  Node C sees ['A', 'B', 'C', 'D', 'A', 'B']
  Node A sees ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']
  ```

  然而，如果我们将递归限制设置为四，我们只完成一圈，因为每一圈是四个超级步：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.errors import GraphRecursionError

  try:
      result = graph.invoke({"aggregate": []}, {"recursion_limit": 4})
  except GraphRecursionError:
      print("Recursion Error")
  ```

  ```
  Node A sees []
  Node B sees ['A']
  Node C sees ['A', 'B']
  Node D sees ['A', 'B']
  Node A sees ['A', 'B', 'C', 'D']
  Recursion Error
  ```
</Accordion>

## 异步

并发运行 [IO-bound](https://en.wikipedia.org/wiki/I/O_bound) 代码时（例如，向聊天模型提供者发出并发 API 请求），使用异步编程范例可以显着提高性能。

要将图的 `sync` 实现转换为 `async` 实现，您需要：

1.更新`nodes`使用`async def`代替`def`。
2. 更新里面的代码以正确使用`await`。
3. 根据需要使用 `.ainvoke` 或 `.astream` 调用图表。

由于许多 LangChain 对象实现了 [Runnable Protocol](https://python.langchain.com/docs/expression_language/interface/)，它具有所有 `sync` 方法的 `async` 变体，因此通常可以相当快地将 `sync` 图升级为 `async` 图。

请参阅下面的示例。为了演示底层 LLM 的异步调用，我们将包含一个聊天模型：

<Tabs>
  <Tab title="OpenAI">
    👉 阅读[OpenAI chat model integration docs](/oss/python/integrations/chat/openai/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[openai]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[openai]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["OPENAI_API_KEY"] = "sk-..."

      model = init_chat_model("gpt-5.5")
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_openai import ChatOpenAI

      os.environ["OPENAI_API_KEY"] = "sk-..."

      model = ChatOpenAI(model="gpt-5.5")
      ```
    </CodeGroup>
  </Tab>

  <Tab title="Anthropic">
    👉 阅读[Anthropic chat model integration docs](/oss/python/integrations/chat/anthropic/)<CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[anthropic]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[anthropic]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["ANTHROPIC_API_KEY"] = "sk-..."

      model = init_chat_model("claude-sonnet-4-6")
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_anthropic import ChatAnthropic

      os.environ["ANTHROPIC_API_KEY"] = "sk-..."

      model = ChatAnthropic(model="claude-sonnet-4-6")
      ```
    </CodeGroup>
  </Tab>

  <Tab title="Azure">
    👉 阅读[Azure chat model integration docs](/oss/python/integrations/chat/azure_chat_openai/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[openai]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[openai]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["AZURE_OPENAI_API_KEY"] = "..."
      os.environ["AZURE_OPENAI_ENDPOINT"] = "..."
      os.environ["OPENAI_API_VERSION"] = "2025-03-01-preview"

      model = init_chat_model(
          "azure_openai:gpt-5.5",
          azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"],
      )
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_openai import AzureChatOpenAI

      os.environ["AZURE_OPENAI_API_KEY"] = "..."
      os.environ["AZURE_OPENAI_ENDPOINT"] = "..."
      os.environ["OPENAI_API_VERSION"] = "2025-03-01-preview"

      model = AzureChatOpenAI(
          model="gpt-5.5",
          azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"]
      )
      ```
    </CodeGroup>
  </Tab>

  <Tab title="Google Gemini">
    👉 阅读[Google GenAI chat model integration docs](/oss/python/integrations/chat/google_generative_ai/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[google-genai]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[google-genai]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["GOOGLE_API_KEY"] = "..."

      model = init_chat_model("google_genai:gemini-2.5-flash-lite")
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_google_genai import ChatGoogleGenerativeAI

      os.environ["GOOGLE_API_KEY"] = "..."

      model = ChatGoogleGenerativeAI(model="gemini-2.5-flash-lite")
      ```
    </CodeGroup>
  </Tab>

  <Tab title="AWS Bedrock">
    👉 阅读[AWS Bedrock chat model integration docs](/oss/python/integrations/chat/bedrock/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[aws]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[aws]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      from langchain.chat_models import init_chat_model

      # Follow the steps here to configure your credentials:
      # https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html

      model = init_chat_model(
          "us.anthropic.claude-sonnet-4-6",
          model_provider="bedrock_converse",
      )
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      from langchain_aws import ChatBedrock

      model = ChatBedrock(model="us.anthropic.claude-sonnet-4-6")
      ```
    </CodeGroup>
  </Tab>

  <Tab title="HuggingFace">
    👉 阅读[HuggingFace chat model integration docs](/oss/python/integrations/chat/huggingface/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain[huggingface]"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain[huggingface]"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["HUGGINGFACEHUB_API_TOKEN"] = "hf_..."

      model = init_chat_model(
          "microsoft/Phi-3-mini-4k-instruct",
          model_provider="huggingface",
          temperature=0.7,
          max_tokens=1024,
      )
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

      os.environ["HUGGINGFACEHUB_API_TOKEN"] = "hf_..."

      llm = HuggingFaceEndpoint(
          repo_id="microsoft/Phi-3-mini-4k-instruct",
          temperature=0.7,
          max_length=1024,
      )
      model = ChatHuggingFace(llm=llm)
      ```
    </CodeGroup>
  </Tab>

  <Tab title="OpenRouter">
    👉 阅读[OpenRouter chat model integration docs](/oss/python/integrations/chat/openrouter/)

    <CodeGroup>
      ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      pip install -U "langchain-openrouter"
      ```

      ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      uv add "langchain-openrouter"
      ```
    </CodeGroup>

    <CodeGroup>
      ```python init_chat_model theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain.chat_models import init_chat_model

      os.environ["OPENROUTER_API_KEY"] = "sk-..."

      model = init_chat_model(
          "auto",
          model_provider="openrouter",
      )
      ```

      ```python Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import os
      from langchain_openrouter import ChatOpenRouter

      os.environ["OPENROUTER_API_KEY"] = "sk-..."

      model = ChatOpenRouter(model="auto")
      ```
    </CodeGroup>
  </Tab>
</Tabs>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.chat_models import init_chat_model
from langgraph.graph import MessagesState, StateGraph

async def node(state: MessagesState):  # [!code highlight]
    new_message = await llm.ainvoke(state["messages"])  # [!code highlight]
    return {"messages": [new_message]}

builder = StateGraph(MessagesState).add_node(node).set_entry_point("node")
graph = builder.compile()

input_message = {"role": "user", "content": "Hello"}
result = await graph.ainvoke({"messages": [input_message]})  # [!code highlight]
```

<Tip>
  **异步流**
  有关异步流式传输的示例，请参阅 [streaming guide](/oss/python/langgraph/streaming)。
</Tip>

## 将控制流和状态更新与`Command`结合起来将控制流（边）和状态更新（节点）结合起来非常有用。例如，您可能希望既执行状态更新又决定在同一节点中下一个转到哪个节点。 LangGraph 提供了一种方法，通过从节点函数返回 [Command](https://langchain-ai.github.io/langgraph/reference/types/#langgraph.types.Command) 对象来实现此目的：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    return Command(
        # state update
        update={"foo": "bar"},
        # control flow
        goto="my_other_node"
    )
```

我们在下面展示了一个端到端的示例。让我们创建一个包含 3 个节点的简单图：A、B 和 C。我们将首先执行节点 A，然后根据节点 A 的输出决定接下来是转到节点 B 还是节点 C。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import random
from typing_extensions import TypedDict, Literal
from langgraph.graph import StateGraph, START
from langgraph.types import Command

# Define graph state
class State(TypedDict):
    foo: str

# Define the nodes

def node_a(state: State) -> Command[Literal["node_b", "node_c"]]:
    print("Called A")
    value = random.choice(["b", "c"])
    # this is a replacement for a conditional edge function
    if value == "b":
        goto = "node_b"
    else:
        goto = "node_c"

    # note how Command allows you to BOTH update the graph state AND route to the next node
    return Command(
        # this is the state update
        update={"foo": value},
        # this is a replacement for an edge
        goto=goto,
    )

def node_b(state: State):
    print("Called B")
    return {"foo": state["foo"] + "b"}

def node_c(state: State):
    print("Called C")
    return {"foo": state["foo"] + "c"}
```

我们现在可以使用上述节点创建[⟦T334⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)。请注意，该图没有用于路由的[conditional edges](/oss/python/langgraph/graph-api#conditional-edges)！这是因为控制流是用`node_a`内部的[⟦T335⟧](https://reference.langchain.com/python/langgraph/types/Command)定义的。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State)
builder.add_edge(START, "node_a")
builder.add_node(node_a)
builder.add_node(node_b)
builder.add_node(node_c)
# NOTE: there are no edges between nodes A, B and C!

graph = builder.compile()
```

<Warning>
  您可能已经注意到，我们使用 [⟦T337⟧](https://reference.langchain.com/python/langgraph/types/Command) 作为返回类型注释，例如`Command[Literal["node_b", "node_c"]]`。这对于图形渲染是必要的，并告诉 LangGraph `node_a` 可以导航到 `node_b` 和 `node_c`。
</Warning>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import display, Image

display(Image(graph.get_graph().draw_mermaid_png()))
```

<img alt="Command-based graph navigation" />

如果我们多次运行该图，我们会看到它根据节点 A 中的随机选择采取不同的路径（A -> B 或 A -> C）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"foo": ""})
```

```
Called A
Called C
```

### 导航到父图中的节点如果您使用[subgraphs](/oss/python/langgraph/use-subgraphs)，您可能希望从子图中的节点导航到不同的子图（即父图中的不同节点）。为此，您可以在 `Command` 中指定 `graph=Command.PARENT`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["other_subgraph"]]:
    return Command(
        update={"foo": "bar"},
        goto="other_subgraph",  # where `other_subgraph` is a node in the parent graph
        graph=Command.PARENT
    )
```

让我们用上面的例子来演示这一点。为此，我们将上面示例中的 `nodeA` 更改为单节点图，并将其作为子图添加到父图。

<Warning>
  **状态更新为`Command.PARENT`**
  当您将父图和子图[state schemas](/oss/python/langgraph/graph-api#schema)共享的键的更新从子图节点发送到父图节点时，您**必须**为要在父图状态下更新的键定义一个[reducer](/oss/python/langgraph/graph-api#reducers)。请参阅下面的示例。
</Warning>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing_extensions import Annotated

class State(TypedDict):
    # NOTE: we define a reducer here
    foo: Annotated[str, operator.add]  # [!code highlight]

def node_a(state: State):
    print("Called A")
    value = random.choice(["a", "b"])
    # this is a replacement for a conditional edge function
    if value == "a":
        goto = "node_b"
    else:
        goto = "node_c"

    # note how Command allows you to BOTH update the graph state AND route to the next node
    return Command(
        update={"foo": value},
        goto=goto,
        # this tells LangGraph to navigate to node_b or node_c in the parent graph
        # NOTE: this will navigate to the closest parent graph relative to the subgraph
        graph=Command.PARENT,  # [!code highlight]
    )

subgraph = StateGraph(State).add_node(node_a).add_edge(START, "node_a").compile()

def node_b(state: State):
    print("Called B")
    # NOTE: since we've defined a reducer, we don't need to manually append
    # new characters to existing 'foo' value. instead, reducer will append these
    # automatically (via operator.add)
    return {"foo": "b"}  # [!code highlight]

def node_c(state: State):
    print("Called C")
    return {"foo": "c"}  # [!code highlight]

builder = StateGraph(State)
builder.add_edge(START, "subgraph")
builder.add_node("subgraph", subgraph)
builder.add_node(node_b)
builder.add_node(node_c)

graph = builder.compile()
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"foo": ""})
```

```
Called A
Called C
```

### 使用内部工具

一个常见的用例是从工具内部更新图形状态。例如，在客户支持应用程序中，您可能希望根据对话开始时的帐号或 ID 查找客户信息。要从工具更新图形状态，您可以从工具返回 `Command(update={"my_custom_key": "foo", "messages": [...]})`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.tools import ToolRuntime

@tool
def lookup_user_info(runtime: ToolRuntime):
    """Use this to look up user information to better assist them with their questions."""
    user_info = get_user_info(runtime.server_info.user.identity)  # [!code highlight]
    return Command(
        update={
            # update the state keys
            "user_info": user_info,
            # update the message history
            "messages": [ToolMessage("Successfully looked up user information", tool_call_id=runtime.tool_call_id)]
        }
    )
```<Warning>
  当从工具返回[⟦T349⟧](https://reference.langchain.com/python/langgraph/types/Command)时，您必须在`Command.update`中包含`messages`（或用于消息历史记录的任何状态键），并且`messages`中的消息列表必须包含`ToolMessage`。这对于生成的消息历史记录有效是必要的（LLM 提供商要求带有工具调用的 AI 消息后跟工具结果消息）。
</Warning>

如果您使用通过 [⟦T352⟧](https://reference.langchain.com/python/langgraph/types/Command) 更新状态的工具，我们建议使用预构建的 [⟦T353⟧](https://reference.langchain.com/python/langgraph/agents/#langgraph.prebuilt.tool_node.ToolNode) ，它会自动处理返回 [⟦T354⟧](https://reference.langchain.com/python/langgraph/types/Command) 对象的工具并将它们传播到图形状态。如果您正在编写调用工具的自定义节点，则需要手动传播工具返回的 [⟦T355⟧](https://reference.langchain.com/python/langgraph/types/Command) 对象作为节点的更新。

## 可视化你的图表

在这里，我们演示如何可视化您创建的图表。

您可以可视化任意任意[Graph](https://langchain-ai.github.io/langgraph/reference/graphs/)，包括[StateGraph](https://langchain-ai.github.io/langgraph/reference/graphs/#langgraph.graph.state.StateGraph)。

让我们通过绘制分形来享受一些乐趣:)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import random
from typing import Annotated, Literal
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

class State(TypedDict):
    messages: Annotated[list, add_messages]

class MyNode:
    def __init__(self, name: str):
        self.name = name
    def __call__(self, state: State):
        return {"messages": [("assistant", f"Called node {self.name}")]}

def route(state) -> Literal["entry_node", END]:
    if len(state["messages"]) > 10:
        return END
    return "entry_node"

def add_fractal_nodes(builder, current_node, level, max_level):
    if level > max_level:
        return
    # Number of nodes to create at this level
    num_nodes = random.randint(1, 3)  # Adjust randomness as needed
    for i in range(num_nodes):
        nm = ["A", "B", "C"][i]
        node_name = f"node_{current_node}_{nm}"
        builder.add_node(node_name, MyNode(node_name))
        builder.add_edge(current_node, node_name)
        # Recursively add more nodes
        r = random.random()
        if r > 0.2 and level + 1 < max_level:
            add_fractal_nodes(builder, node_name, level + 1, max_level)
        elif r > 0.05:
            builder.add_conditional_edges(node_name, route, node_name)
        else:
            # End
            builder.add_edge(node_name, END)

def build_fractal_graph(max_level: int):
    builder = StateGraph(State)
    entry_point = "entry_node"
    builder.add_node(entry_point, MyNode(entry_point))
    builder.add_edge(START, entry_point)
    add_fractal_nodes(builder, entry_point, 1, max_level)
    # Optional: set a finish point if required
    builder.add_edge(entry_point, END)  # or any specific node
    return builder.compile()

app = build_fractal_graph(3)
```

### 美人鱼

我们还可以将图类转换为 Mermaid 语法。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
print(app.get_graph().draw_mermaid())
```

```
%%{init: {'flowchart': {'curve': 'linear'}}}%%
graph TD;
    tart__([<p>__start__</p>]):::first
    ry_node(entry_node)
    e_entry_node_A(node_entry_node_A)
    e_entry_node_B(node_entry_node_B)
    e_node_entry_node_B_A(node_node_entry_node_B_A)
    e_node_entry_node_B_B(node_node_entry_node_B_B)
    e_node_entry_node_B_C(node_node_entry_node_B_C)
    nd__([<p>__end__</p>]):::last
    tart__ --> entry_node;
    ry_node --> __end__;
    ry_node --> node_entry_node_A;
    ry_node --> node_entry_node_B;
    e_entry_node_B --> node_node_entry_node_B_A;
    e_entry_node_B --> node_node_entry_node_B_B;
    e_entry_node_B --> node_node_entry_node_B_C;
    e_entry_node_A -.-> entry_node;
    e_entry_node_A -.-> __end__;
    e_node_entry_node_B_A -.-> entry_node;
    e_node_entry_node_B_A -.-> __end__;
    e_node_entry_node_B_B -.-> entry_node;
    e_node_entry_node_B_B -.-> __end__;
    e_node_entry_node_B_C -.-> entry_node;
    e_node_entry_node_B_C -.-> __end__;
    ssDef default fill:#f2f0ff,line-height:1.2
    ssDef first fill-opacity:0
    ssDef last fill:#bfb6fc
```

### PNG

如果愿意，我们可以将图形渲染为`.png`。这里我们可以使用三个选项：* 使用Mermaid.ink API（不需要额外的包）
* 使用 Mermaid + Pyppeteer (需要 `pip install pyppeteer`)
* 使用graphviz（需要`pip install graphviz`）

**使用 Mermaid.Ink**

默认情况下，`draw_mermaid_png()`使用Mermaid.Ink的API来生成图表。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display
from langchain_core.runnables.graph import CurveStyle, MermaidDrawMethod, NodeStyles

display(Image(app.get_graph().draw_mermaid_png()))
```

<img alt="Fractal graph visualization" />

**使用 Mermaid + Pyppeteer**

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import nest_asyncio

nest_asyncio.apply()  # Required for Jupyter Notebook to run async functions

display(
    Image(
        app.get_graph().draw_mermaid_png(
            curve_style=CurveStyle.LINEAR,
            node_colors=NodeStyles(first="#ffdfba", last="#baffc9", default="#fad7de"),
            wrap_label_n_words=9,
            output_file_path=None,
            draw_method=MermaidDrawMethod.PYPPETEER,
            background_color="white",
            padding=10,
        )
    )
)
```

**使用Graphviz**

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
try:
    display(Image(app.get_graph().draw_png()))
except ImportError:
    print(
        "You likely need to install dependencies for pygraphviz, see more here https://github.com/pygraphviz/pygraphviz/blob/main/INSTALL.txt"
    )
```

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>