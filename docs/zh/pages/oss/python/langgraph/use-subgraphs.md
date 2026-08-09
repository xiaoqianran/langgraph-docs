<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Subgraphs | https://docs.langchain.com/oss/python/langgraph/use-subgraphs -->

# 子图

本指南解释了使用子图的机制。子图是在另一个图中用作 [node](/oss/python/langgraph/graph-api#nodes) 的 [graph](/oss/python/langgraph/graph-api#graphs)。

子图可用于：

* 大楼[multi-agent systems](/oss/python/langchain/multi-agent)
* 在多个图中重用一组节点
* 分布式开发：当您希望不同的团队独立处理图的不同部分时，您可以将每个部分定义为子图，只要尊重子图接口（输入和输出模式），就可以在不知道子图的任何细节的情况下构建父图

## 设置

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph
  ```
</CodeGroup>

<Tip>
  **设置 LangSmith 进行 LangGraph 开发**
  注册 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-use-subgraphs) 可以快速发现问题并提高 LangGraph 项目的性能。 LangSmith 允许您使用跟踪数据来调试、测试和监控使用 LangGraph 构建的 LLM 应用程序 - 了解有关 [how to get started with LangSmith](https://docs.smith.langchain.com) 的更多信息。
</Tip>

## 定义子图通信

添加子图时，需要定义父图和子图如何通信：|图案|何时使用 |状态模式 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [Call a subgraph inside a node](#call-a-subgraph-inside-a-node) |父图和子图具有**不同的状态模式**（没有共享密钥），或者您需要在它们之间转换状态 |您编写一个包装函数，将父状态映射到子图输入，并将子图输出映射回父状态 |
| [Add a subgraph as a node](#add-a-subgraph-as-a-node) |父图和子图**共享状态键**——子图与父图读取和写入相同的通道 |您将编译后的子图直接传递给`add_node`——无需包装函数 |

<a />

### 调用节点内的子图当父图和子图具有**不同的状态模式**（无共享键）时，在节点函数内调用子图。当您想要为 [multi-agent](/oss/python/langchain/multi-agent) 系统中的每个代理保留私人消息历史记录时，这种情况很常见。

节点函数在调用子图之前将父状态转换为子图状态，并在返回之前将结果转换回父状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict
from langgraph.graph.state import StateGraph, START

class SubgraphState(TypedDict):
    bar: str

# Subgraph

def subgraph_node_1(state: SubgraphState):
    return {"bar": "hi! " + state["bar"]}

subgraph_builder = StateGraph(SubgraphState)
subgraph_builder.add_node(subgraph_node_1)
subgraph_builder.add_edge(START, "subgraph_node_1")
subgraph = subgraph_builder.compile()

# Parent graph

class State(TypedDict):
    foo: str

def call_subgraph(state: State):
    # Transform the state to the subgraph state
    subgraph_output = subgraph.invoke({"bar": state["foo"]})  # [!code highlight]
    # Transform response back to the parent state
    return {"foo": subgraph_output["bar"]}

builder = StateGraph(State)
builder.add_node("node_1", call_subgraph)
builder.add_edge(START, "node_1")
graph = builder.compile()
```

<Accordion title="Full example: different state schemas">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing_extensions import TypedDict
  from langgraph.graph.state import StateGraph, START

  # Define subgraph
  class SubgraphState(TypedDict):
      # note that none of these keys are shared with the parent graph state
      bar: str
      baz: str

  def subgraph_node_1(state: SubgraphState):
      return {"baz": "baz"}

  def subgraph_node_2(state: SubgraphState):
      return {"bar": state["bar"] + state["baz"]}

  subgraph_builder = StateGraph(SubgraphState)
  subgraph_builder.add_node(subgraph_node_1)
  subgraph_builder.add_node(subgraph_node_2)
  subgraph_builder.add_edge(START, "subgraph_node_1")
  subgraph_builder.add_edge("subgraph_node_1", "subgraph_node_2")
  subgraph = subgraph_builder.compile()

  # Define parent graph
  class ParentState(TypedDict):
      foo: str

  def node_1(state: ParentState):
      return {"foo": "hi! " + state["foo"]}

  def node_2(state: ParentState):
      # Transform the state to the subgraph state
      response = subgraph.invoke({"bar": state["foo"]})
      # Transform response back to the parent state
      return {"foo": response["bar"]}


  builder = StateGraph(ParentState)
  builder.add_node("node_1", node_1)
  builder.add_node("node_2", node_2)
  builder.add_edge(START, "node_1")
  builder.add_edge("node_1", "node_2")
  graph = builder.compile()

  stream = graph.stream_events({"foo": "foo"}, version="v3")
  for event in stream:
      if event["method"] == "updates":
          print(event["params"]["namespace"], event["params"]["data"])
  ```

  ```
  [] {'node_1': {'foo': 'hi! foo'}}
  ['node_2:577b710b-64ae-31fb-9455-6a4d4cc2b0b9'] {'subgraph_node_1': {'baz': 'baz'}}
  ['node_2:577b710b-64ae-31fb-9455-6a4d4cc2b0b9'] {'subgraph_node_2': {'bar': 'hi! foobaz'}}
  [] {'node_2': {'foo': 'hi! foobaz'}}
  ```
</Accordion>

<Accordion title="Full example: different state schemas (two levels of subgraphs)">
  这是一个具有两级子图的示例：父级 -> 子级 -> 孙级。

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Grandchild graph
  from typing_extensions import TypedDict
  from langgraph.graph.state import StateGraph, START, END

  class GrandChildState(TypedDict):
      my_grandchild_key: str

  def grandchild_1(state: GrandChildState) -> GrandChildState:
      # NOTE: child or parent keys will not be accessible here
      return {"my_grandchild_key": state["my_grandchild_key"] + ", how are you"}


  grandchild = StateGraph(GrandChildState)
  grandchild.add_node("grandchild_1", grandchild_1)

  grandchild.add_edge(START, "grandchild_1")
  grandchild.add_edge("grandchild_1", END)

  grandchild_graph = grandchild.compile()

  # Child graph
  class ChildState(TypedDict):
      my_child_key: str

  def call_grandchild_graph(state: ChildState) -> ChildState:
      # NOTE: parent or grandchild keys won't be accessible here
      grandchild_graph_input = {"my_grandchild_key": state["my_child_key"]}
      grandchild_graph_output = grandchild_graph.invoke(grandchild_graph_input)
      return {"my_child_key": grandchild_graph_output["my_grandchild_key"] + " today?"}

  child = StateGraph(ChildState)
  # We're passing a function here instead of just compiled graph (`grandchild_graph`)
  child.add_node("child_1", call_grandchild_graph)
  child.add_edge(START, "child_1")
  child.add_edge("child_1", END)
  child_graph = child.compile()

  # Parent graph
  class ParentState(TypedDict):
      my_key: str

  def parent_1(state: ParentState) -> ParentState:
      # NOTE: child or grandchild keys won't be accessible here
      return {"my_key": "hi " + state["my_key"]}

  def parent_2(state: ParentState) -> ParentState:
      return {"my_key": state["my_key"] + " bye!"}

  def call_child_graph(state: ParentState) -> ParentState:
      child_graph_input = {"my_child_key": state["my_key"]}
      child_graph_output = child_graph.invoke(child_graph_input)
      return {"my_key": child_graph_output["my_child_key"]}

  parent = StateGraph(ParentState)
  parent.add_node("parent_1", parent_1)
  # We're passing a function here instead of just a compiled graph (`child_graph`)
  parent.add_node("child", call_child_graph)
  parent.add_node("parent_2", parent_2)

  parent.add_edge(START, "parent_1")
  parent.add_edge("parent_1", "child")
  parent.add_edge("child", "parent_2")
  parent.add_edge("parent_2", END)

  parent_graph = parent.compile()

  stream = parent_graph.stream_events({"my_key": "Bob"}, version="v3")
  for event in stream:
      if event["method"] == "updates":
          print(event["params"]["namespace"], event["params"]["data"])
  ```

  ```
  [] {'parent_1': {'my_key': 'hi Bob'}}
  ['child:2e26e9ce-602f-862c-aa66-1ea5a4655e3b', 'child_1:781bb3b1-3971-84ce-810b-acf819a03f9c'] {'grandchild_1': {'my_grandchild_key': 'hi Bob, how are you'}}
  ['child:2e26e9ce-602f-862c-aa66-1ea5a4655e3b'] {'child_1': {'my_child_key': 'hi Bob, how are you today?'}}
  [] {'child': {'my_key': 'hi Bob, how are you today?'}}
  [] {'parent_2': {'my_key': 'hi Bob, how are you today? bye!'}}
  ```
</Accordion>

<a />

### 添加子图作为节点

当父图和子图**共享状态键**时，您可以将编译后的子图直接传递给`add_node`。不需要包装函数——子图自动读取和写入父级的状态通道。例如，在[multi-agent](/oss/python/langchain/multi-agent)系统中，代理通常通过共享的[messages](/oss/python/langgraph/graph-api#why-use-messages)密钥进行通信。

<img alt="SQL agent graph" />

如果您的子图与父图共享状态键，您可以按照以下步骤将其添加到您的图中：

1.定义子图工作流程（下例中的`subgraph_builder`）并编译
2.定义父图工作流程时将编译后的子图传递给[⟦T31⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)方法

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict
from langgraph.graph.state import StateGraph, START

class State(TypedDict):
    foo: str

# Subgraph

def subgraph_node_1(state: State):
    return {"foo": "hi! " + state["foo"]}

subgraph_builder = StateGraph(State)
subgraph_builder.add_node(subgraph_node_1)
subgraph_builder.add_edge(START, "subgraph_node_1")
subgraph = subgraph_builder.compile()

# Parent graph

builder = StateGraph(State)
builder.add_node("node_1", subgraph)  # [!code highlight]
builder.add_edge(START, "node_1")
graph = builder.compile()
```

<Accordion title="Full example: shared state schemas">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing_extensions import TypedDict
  from langgraph.graph.state import StateGraph, START

  # Define subgraph
  class SubgraphState(TypedDict):
      foo: str  # shared with parent graph state
      bar: str  # private to SubgraphState

  def subgraph_node_1(state: SubgraphState):
      return {"bar": "bar"}

  def subgraph_node_2(state: SubgraphState):
      # note that this node is using a state key ('bar') that is only available in the subgraph
      # and is sending update on the shared state key ('foo')
      return {"foo": state["foo"] + state["bar"]}

  subgraph_builder = StateGraph(SubgraphState)
  subgraph_builder.add_node(subgraph_node_1)
  subgraph_builder.add_node(subgraph_node_2)
  subgraph_builder.add_edge(START, "subgraph_node_1")
  subgraph_builder.add_edge("subgraph_node_1", "subgraph_node_2")
  subgraph = subgraph_builder.compile()

  # Define parent graph
  class ParentState(TypedDict):
      foo: str

  def node_1(state: ParentState):
      return {"foo": "hi! " + state["foo"]}

  builder = StateGraph(ParentState)
  builder.add_node("node_1", node_1)
  builder.add_node("node_2", subgraph)
  builder.add_edge(START, "node_1")
  builder.add_edge("node_1", "node_2")
  graph = builder.compile()

  stream = graph.stream_events({"foo": "foo"}, version="v3")
  for event in stream:
      if event["method"] == "updates" and not event["params"]["namespace"]:
          print(event["params"]["data"])
  ``````
  {'node_1': {'foo': 'hi! foo'}}
  {'node_2': {'foo': 'hi! foobar'}}
  ```
</Accordion>

## 子图持久化

当您使用子图时，您需要决定调用之间其内部数据会发生什么。考虑一个委托给专业子代理的客户支持机器人：“计费专家”子代理应该记住客户之前的问题，还是每次被呼叫时都重新开始？

`.compile()`上的`checkpointer`参数控制子图持久化：

|模式| `checkpointer=` |行为 |
| ---------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Per-invocation](#per-invocation-default) | `None`（默认）|每个调用都会重新开始，并继承父级的检查指针，以在单个调用中支持 [interrupts](/oss/python/langgraph/interrupts) 和 [durable execution](/oss/python/langgraph/persistence)。 || [Per-thread](#per-thread) | `True` |状态在同一线程上的调用之间累积。每个呼叫都会从上一个呼叫中断的地方接续。                                                                                                       |
| [Stateless](#stateless) | `False` |根本没有检查点——像普通函数调用一样运行。无中断或持久执行。                                                                                                             |

对于大多数应用程序来说，每次调用是正确的选择，包括子代理处理独立请求的[multi-agent](/oss/python/langchain/multi-agent)系统。当子代理需要多轮对话记忆时（例如，通过多次交换构建上下文的研究助理），请使用每线程。

<Note>
  父图必须使用检查指针进行编译，子图持久性功能（中断、状态检查、每线程内存）才能正常工作。参见[persistence](/oss/python/langgraph/persistence)。
</Note><Info>
  下面的例子使用了LangChain的[⟦T38⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)，这是构建代理的常用方式。 `create_agent` 在底层生成[LangGraph graph](/oss/python/langgraph/graph-api)，因此所有子图持久性概念都直接适用。如果您使用原始 LangGraph `StateGraph` 进行构建，则适用相同的模式和配置选项 - 有关详细信息，请参阅 [Graph API](/oss/python/langgraph/graph-api)。
</Info>

### 有状态

有状态子图继承父图的检查指针，从而启用 [interrupts](/oss/python/langgraph/interrupts)、[persistence](/oss/python/langgraph/persistence) 和状态检查。这两种有状态模式的不同之处在于状态保留的时间。

#### 每次调用（默认）

<Tip>
  这是大多数应用程序的推荐模式，包括将子代理作为工具调用的[multi-agent](/oss/python/langchain/multi-agent)系统。它支持[interrupts](/oss/python/langgraph/interrupts)、[persistence](/oss/python/langgraph/persistence)和并行调用，同时保持每个调用的隔离。
</Tip>

当对子图的每次调用都是独立的并且子代理不需要记住之前调用的任何内容时，请使用每次调用持久性。这是最常见的模式，特别是对于 [multi-agent](/oss/python/langchain/multi-agent) 系统，其中子代理处理一次性请求，例如“查找该客户的订单”或“总结此文档”。省略 `checkpointer` 或将其设置为 `None`。每个调用都是全新开始的，但在单个调用中，子图继承父级的检查点，并且可以使用 `interrupt()` 暂停和恢复。

以下示例使用两个子代理（水果专家、蔬菜专家）作为外部代理的工具进行包装：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, interrupt

@tool
def fruit_info(fruit_name: str) -> str:
    """Look up fruit info."""
    return f"Info about {fruit_name}"

@tool
def veggie_info(veggie_name: str) -> str:
    """Look up veggie info."""
    return f"Info about {veggie_name}"

# Subagents - no checkpointer setting (inherits parent)
fruit_agent = create_agent(
    model="gpt-5.4-mini",
    tools=[fruit_info],
    prompt="You are a fruit expert. Use the fruit_info tool. Respond in one sentence.",
)

veggie_agent = create_agent(
    model="gpt-5.4-mini",
    tools=[veggie_info],
    prompt="You are a veggie expert. Use the veggie_info tool. Respond in one sentence.",
)

# Wrap subagents as tools for the outer agent
@tool
def ask_fruit_expert(question: str) -> str:
    """Ask the fruit expert. Use for ALL fruit questions."""
    response = fruit_agent.invoke(
        {"messages": [{"role": "user", "content": question}]},
    )
    return response["messages"][-1].content

@tool
def ask_veggie_expert(question: str) -> str:
    """Ask the veggie expert. Use for ALL veggie questions."""
    response = veggie_agent.invoke(
        {"messages": [{"role": "user", "content": question}]},
    )
    return response["messages"][-1].content

# Outer agent with checkpointer
agent = create_agent(
    model="gpt-5.4-mini",
    tools=[ask_fruit_expert, ask_veggie_expert],
    prompt=(
        "You have two experts: ask_fruit_expert and ask_veggie_expert. "
        "ALWAYS delegate questions to the appropriate expert."
    ),
    checkpointer=MemorySaver(),
)
```

<Tabs>
  <Tab title="Interrupts">
    每次调用都可以使用`interrupt()`来暂停和恢复。将 `interrupt()` 添加到工具函数中，以在继续之前需要用户批准：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @tool
    def fruit_info(fruit_name: str) -> str:
        """Look up fruit info."""
        interrupt("continue?")  # [!code highlight]
        return f"Info about {fruit_name}"
    ```

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {"configurable": {"thread_id": "1"}}

    # Stream events - the subagent's tool calls interrupt()
    stream = agent.stream_events(
        {"messages": [{"role": "user", "content": "Tell me about apples"}]},
        config=config,
        version="v3",
    )
    output = stream.output  # drive the stream to completion
    # stream.interrupts contains pending interrupts (and stream.interrupted is True)

    # Resume - approve the interrupt
    resumed = agent.stream_events(Command(resume=True), config=config, version="v3")
    final = resumed.output
    ```
  </Tab>

  <Tab title="Multi-turn">
    每次调用都以新的子代理状态开始。子代理不记得以前的调用：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {"configurable": {"thread_id": "1"}}

    # First call
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Tell me about apples"}]},
        config=config,
    )
    # Subagent message count: 4

    # Second call - subagent starts fresh, no memory of apples
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Now tell me about bananas"}]},
        config=config,
    )
    # Subagent message count: 4 (still fresh!)
    ```
  </Tab>

  <Tab title="Multiple subgraph calls">
    对同一子图的多次调用不会发生冲突，因为每次调用都有自己的检查点名称空间：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {"configurable": {"thread_id": "1"}}

    # LLM calls ask_fruit_expert for both apples and bananas
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Tell me about apples and bananas"}]},
        config=config,
    )
    # Subagent message count: 4 (apples - fresh)
    # Subagent message count: 4 (bananas - fresh)
    ```
  </Tab>
</Tabs>

#### 每线程

当子代理需要记住以前的交互时，请使用每线程持久性。例如，研究助理通过多次交换建立上下文，或者编码助理跟踪其已编辑的文件。子代理的对话历史记录和数据在同一线程上的调用之间累积。每个呼叫都会从上一个呼叫中断的地方接续。

使用 `checkpointer=True` 编译以启用此行为。<Warning>
  每线程子图不支持并行工具调用。当 LLM 可以访问每线程子代理作为工具时，它可能会尝试并行多次调用该工具（例如，同时向水果专家询问有关苹果和香蕉的信息）。这会导致检查点冲突，因为两个调用都写入同一名称空间。

  下面的例子使用LangChain的`ToolCallLimitMiddleware`来防止这种情况。如果您使用纯 LangGraph `StateGraph` 进行构建，则需要自行防止并行工具调用，例如，通过配置模型以禁用并行工具调用或添加逻辑以确保不会多次并行调用同一子图。
</Warning>

以下示例使用使用`checkpointer=True`编译的水果专家子代理：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command, interrupt

@tool
def fruit_info(fruit_name: str) -> str:
    """Look up fruit info."""
    return f"Info about {fruit_name}"

# Subagent with checkpointer=True for persistent state
fruit_agent = create_agent(
    model="gpt-5.4-mini",
    tools=[fruit_info],
    prompt="You are a fruit expert. Use the fruit_info tool. Respond in one sentence.",
    checkpointer=True,  # [!code highlight]
)

# Wrap subagent as a tool for the outer agent
@tool
def ask_fruit_expert(question: str) -> str:
    """Ask the fruit expert. Use for ALL fruit questions."""
    response = fruit_agent.invoke(
        {"messages": [{"role": "user", "content": question}]},
    )
    return response["messages"][-1].content

# Outer agent with checkpointer
# Use ToolCallLimitMiddleware to prevent parallel calls to per-thread subagents,
# which would cause checkpoint conflicts.
agent = create_agent(
    model="gpt-5.4-mini",
    tools=[ask_fruit_expert],
    prompt="You have a fruit expert. ALWAYS delegate fruit questions to ask_fruit_expert.",
    middleware=[  # [!code highlight]
        ToolCallLimitMiddleware(tool_name="ask_fruit_expert", run_limit=1),  # [!code highlight]
    ],  # [!code highlight]
    checkpointer=MemorySaver(),
)
```

<Tabs>
  <Tab title="Interrupts">
    每线程子代理支持 `interrupt()` 就像每次调用一样。将`interrupt()`添加到工具功能中以要求用户批准：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @tool
    def fruit_info(fruit_name: str) -> str:
        """Look up fruit info."""
        interrupt("continue?")  # [!code highlight]
        return f"Info about {fruit_name}"
    ```

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.types import Command

    config = {"configurable": {"thread_id": "1"}}

    # Stream events - the subagent's tool calls interrupt()
    stream = agent.stream_events(
        {"messages": [{"role": "user", "content": "Tell me about apples"}]},
        config=config,
        version="v3",
    )
    output = stream.output  # drive the stream to completion
    # stream.interrupts contains pending interrupts (and stream.interrupted is True)

    # Resume - approve the interrupt
    resumed = agent.stream_events(Command(resume=True), config=config, version="v3")
    final = resumed.output
    ```
  </Tab>

  <Tab title="Multi-turn">
    状态在调用中累积——子代理会记住过去的对话：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {"configurable": {"thread_id": "1"}}

    # First call
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Tell me about apples"}]},
        config=config,
    )
    # Subagent message count: 4

    # Second call - subagent REMEMBERS apples conversation
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Now tell me about bananas"}]},
        config=config,
    )
    # Subagent message count: 8 (accumulated!)
    ```
  </Tab><Tab title="Multiple subgraph calls">
    当您有多个**不同的**每线程子图（例如，水果专家和蔬菜专家）时，每个子图都需要自己的存储空间，以便它们的检查点不会相互覆盖。这称为**命名空间隔离**。

    如果您[call subgraphs inside a node](#call-a-subgraph-inside-a-node)，LangGraph 会根据调用顺序（第一次调用、第二次调用等）分配命名空间。这意味着重新排序您的调用可能会混淆哪个子图加载哪个状态。为了避免这种情况，请使用唯一的节点名称将每个子代理包装在自己的 `StateGraph` 中 - 这为每个子图提供了稳定、唯一的命名空间：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.graph import MessagesState, StateGraph

    def create_sub_agent(model, *, name, **kwargs):
        """Wrap an agent with a unique node name for namespace isolation."""
        agent = create_agent(model=model, name=name, **kwargs)
        return (
            StateGraph(MessagesState)
            .add_node(name, agent)  # unique name → stable namespace  # [!code highlight]
            .add_edge("__start__", name)
            .compile()
        )

    fruit_agent = create_sub_agent(
        "gpt-5.4-mini", name="fruit_agent",
        tools=[fruit_info], prompt="...", checkpointer=True,
    )
    veggie_agent = create_sub_agent(
        "gpt-5.4-mini", name="veggie_agent",
        tools=[veggie_info], prompt="...", checkpointer=True,
    )

    config = {"configurable": {"thread_id": "1"}}

    # First call - LLM calls both fruit and veggie experts
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Tell me about cherries and broccoli"}]},
        config=config,
    )
    # Fruit subagent message count: 4
    # Veggie subagent message count: 4

    # Second call - both agents accumulate independently
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Now tell me about oranges and carrots"}]},
        config=config,
    )
    # Fruit subagent message count: 8 (remembers cherries!)
    # Veggie subagent message count: 8 (remembers broccoli!)
    ```

    子图[added as nodes](#add-a-subgraph-as-a-node)已经自动获取基于名称的命名空间，因此它们不需要这个包装器。
  </Tab>
</Tabs>

### 无状态

当您想要像普通函数调用一样运行子代理而没有检查点开销时，请使用此选项。子图无法暂停/恢复，并且无法从 [durable execution](/oss/python/langgraph/persistence) 中受益。使用`checkpointer=False`编译。

<Warning>
  如果没有检查点，子图就没有持久执行。如果进程在运行中崩溃，则子图无法恢复，必须从头开始重新运行。
</Warning>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
subgraph_builder = StateGraph(...)
subgraph = subgraph_builder.compile(checkpointer=False)  # [!code highlight]
```

### 检查指针参考

使用`.compile()`上的`checkpointer`参数控制子图持久性：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
subgraph = builder.compile(checkpointer=False)  # or True / None
```|特色|每次调用（默认）|每线程 |无国籍|
| ------------------------------------------------ | ------------------------ | -------------------- | ---------|
| `checkpointer=` | `None` | `True` | `False` |
|中断（HITL）| ✅ | ✅ | ❌ |
|多圈记忆| ❌ | ✅ | ❌ |
|多次调用（不同子图）| ✅ | <Tooltip>⚠️</Tooltip> | ✅ |
|多次调用（同一子图）| ✅ | ❌ | ✅ |
|国家检验| <Tooltip>⚠️</Tooltip> | ✅ | ❌ |* **中断（HITL）**：子图可以使用[interrupt()](/oss/python/langgraph/interrupts)暂停执行并等待用户输入，然后从中断处恢复。
* **多轮记忆**：子图在同一[thread](/oss/python/langgraph/checkpointers#threads)内的多次调用中保留其状态。每次调用都会从上一个调用的地方继续，而不是重新开始。
* **多次调用（不同的子图）**：可以在单个节点内调用多个不同的子图实例，而不会发生检查点命名空间冲突。
* **多次调用（同一子图）**：同一子图实例可以在单个节点内多次调用。通过有状态持久性，这些调用会写入相同的检查点命名空间并发生冲突 - 请改用每次调用持久性。
* **状态检查**：子图的状态可通过`get_state(config, subgraphs=True)`进行调试和监控。

## 查看子图状态

当您启用[persistence](/oss/python/langgraph/persistence)时，您可以使用子图选项检查子图状态。使用[stateless](#stateless)检查点（`checkpointer=False`），不会保存子图检查点，因此子图状态不可用。<Note>
  查看子图状态要求 LangGraph 可以**静态地发现**子图，即它是 [added as a node](#add-a-subgraph-as-a-node) 或 [called inside a node](#call-a-subgraph-inside-a-node)。当在 [tool](/oss/python/langchain/tools) 函数或其他间接（例如 [subagents](/oss/python/langchain/multi-agent/subagents) 模式）内调用子图时，它不起作用。无论嵌套如何，中断仍然会传播到顶层图。
</Note>

<Tabs>
  <Tab title="Per-invocation">
    仅返回**当前调用**的子图状态。每次调用都是全新的。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.graph import START, StateGraph
    from langgraph.checkpoint.memory import MemorySaver
    from langgraph.types import interrupt, Command
    from typing_extensions import TypedDict

    class State(TypedDict):
        foo: str

    # Subgraph
    def subgraph_node_1(state: State):
        value = interrupt("Provide value:")
        return {"foo": state["foo"] + value}

    subgraph_builder = StateGraph(State)
    subgraph_builder.add_node(subgraph_node_1)
    subgraph_builder.add_edge(START, "subgraph_node_1")
    subgraph = subgraph_builder.compile()  # inherits parent checkpointer

    # Parent graph
    builder = StateGraph(State)
    builder.add_node("node_1", subgraph)
    builder.add_edge(START, "node_1")

    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "1"}}

    graph.invoke({"foo": ""}, config)

    # View subgraph state for the current invocation
    subgraph_state = graph.get_state(config, subgraphs=True).tasks[0].state  # [!code highlight]

    # Resume the subgraph
    graph.invoke(Command(resume="bar"), config)
    ```
  </Tab>

  <Tab title="Per-thread">
    返回此线程上所有调用的**累积**子图状态。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.graph import START, StateGraph, MessagesState
    from langgraph.checkpoint.memory import MemorySaver

    # Subgraph with its own persistent state
    subgraph_builder = StateGraph(MessagesState)
    # ... add nodes and edges
    subgraph = subgraph_builder.compile(checkpointer=True)  # [!code highlight]

    # Parent graph
    builder = StateGraph(MessagesState)
    builder.add_node("agent", subgraph)
    builder.add_edge(START, "agent")

    checkpointer = MemorySaver()
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "1"}}

    graph.invoke({"messages": [{"role": "user", "content": "hi"}]}, config)
    graph.invoke({"messages": [{"role": "user", "content": "what did I say?"}]}, config)

    # View accumulated subgraph state (includes messages from both invocations)
    subgraph_state = graph.get_state(config, subgraphs=True).tasks[0].state  # [!code highlight]
    ```
  </Tab>
</Tabs>

## 流子图输出

要观察嵌套图执行，我们建议使用 [event streaming](/oss/python/langgraph/event-streaming)：`stream.subgraphs` 投影会发现每个嵌套运行并公开其 `path`、`messages` 和 `values`，而无需解析命名空间字符串。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events({"foo": "foo"}, version="v3")  # [!code highlight]

for subgraph in stream.subgraphs:
    print(subgraph.graph_name, subgraph.path)

    for snapshot in subgraph.values:
        print(subgraph.path, snapshot)
```

如果您需要原始协议事件，请直接迭代流并过滤`event["method"]`和`event["params"]["namespace"]`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events({"foo": "foo"}, version="v3")
for event in stream:
    if event["method"] == "updates":
        print(event["params"]["namespace"], event["params"]["data"])
```

<Accordion title="Stream from subgraphs">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing_extensions import TypedDict
  from langgraph.graph.state import StateGraph, START

  # Define subgraph
  class SubgraphState(TypedDict):
      foo: str
      bar: str

  def subgraph_node_1(state: SubgraphState):
      return {"bar": "bar"}

  def subgraph_node_2(state: SubgraphState):
      # note that this node is using a state key ('bar') that is only available in the subgraph
      # and is sending update on the shared state key ('foo')
      return {"foo": state["foo"] + state["bar"]}

  subgraph_builder = StateGraph(SubgraphState)
  subgraph_builder.add_node(subgraph_node_1)
  subgraph_builder.add_node(subgraph_node_2)
  subgraph_builder.add_edge(START, "subgraph_node_1")
  subgraph_builder.add_edge("subgraph_node_1", "subgraph_node_2")
  subgraph = subgraph_builder.compile()

  # Define parent graph
  class ParentState(TypedDict):
      foo: str

  def node_1(state: ParentState):
      return {"foo": "hi! " + state["foo"]}

  builder = StateGraph(ParentState)
  builder.add_node("node_1", node_1)
  builder.add_node("node_2", subgraph)
  builder.add_edge(START, "node_1")
  builder.add_edge("node_1", "node_2")
  graph = builder.compile()

  stream = graph.stream_events({"foo": "foo"}, version="v3")  # [!code highlight]
  for event in stream:
      if event["method"] == "updates":
          print(event["params"]["namespace"], event["params"]["data"])
  ```

  ```
  [] {'node_1': {'foo': 'hi! foo'}}
  ['node_2:e58e5673-a661-ebb0-70d4-e298a7fc28b7'] {'subgraph_node_1': {'bar': 'bar'}}
  ['node_2:e58e5673-a661-ebb0-70d4-e298a7fc28b7'] {'subgraph_node_2': {'foo': 'hi! foobar'}}
  [] {'node_2': {'foo': 'hi! foobar'}}
  ```
</Accordion>

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-subgraphs.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>