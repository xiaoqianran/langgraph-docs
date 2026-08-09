<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use time-travel | https://docs.langchain.com/oss/python/langgraph/use-time-travel -->

# 使用时间旅行

> 重放过去的执行并分叉以探索 LangGraph 中的替代路径

## 概述

LangGraph 支持通过 [checkpoints](/oss/python/langgraph/checkpointers#checkpoints) 进行时间旅行：

* **[Replay](#replay)**：从之前的检查点重试。
* **[Fork](#fork)**：从具有修改状态的先前检查点分支以探索替代路径。

两者都通过从先前的检查点恢复来工作。检查点之前的节点不会重新执行（结果已保存）。检查点之后的节点重新执行，包括任何LLM调用、API请求和[interrupts](/oss/python/langgraph/interrupts)（可能会产生不同的结果）。

## 重播

使用先前检查点的配置调用图表以从该点重放。

<Warning>
  重播重新执行节点——它不仅仅是从缓存中读取。 LLM 调用、API 请求和 [interrupts](/oss/python/langgraph/interrupts) 再次触发，可能会返回不同的结果。从最终检查点（无`next`节点）重放是无操作的。
</Warning>

<img src="https://mintcdn.com/langchain-5e9cc07a/dL5Sn6Cmy9pwtY0V/oss/images/re_play.png?fit=max&auto=format&n=dL5Sn6Cmy9pwtY0V&q=85&s=d7b34b85c106e55d181ae1f4afb50251" alt="Replay" width="2276" height="986" data-path="oss/images/re_play.png" />

使用 [⟦T8⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.get_state_history) 找到要重放的检查点，然后使用该检查点的配置调用 [⟦T9⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.invoke)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, START
from langgraph.checkpoint.memory import InMemorySaver
from typing_extensions import TypedDict, NotRequired
from langchain_core.utils.uuid import uuid7

class State(TypedDict):
    topic: NotRequired[str]
    joke: NotRequired[str]


def generate_topic(state: State):
    return {"topic": "socks in the dryer"}


def write_joke(state: State):
    return {"joke": f"Why do {state['topic']} disappear? They elope!"}


checkpointer = InMemorySaver()
graph = (
    StateGraph(State)
    .add_node("generate_topic", generate_topic)
    .add_node("write_joke", write_joke)
    .add_edge(START, "generate_topic")
    .add_edge("generate_topic", "write_joke")
    .compile(checkpointer=checkpointer)
)

# Step 1: Run the graph
config = {"configurable": {"thread_id": str(uuid7())}}
result = graph.invoke({}, config)

# Step 2: Find a checkpoint to replay from
history = list(graph.get_state_history(config))
# History is in reverse chronological order
for state in history:
    print(f"next={state.next}, checkpoint_id={state.config['configurable']['checkpoint_id']}")

# Step 3: Replay from a specific checkpoint
# Find the checkpoint before write_joke
before_joke = next(s for s in history if s.next == ("write_joke",))
replay_result = graph.invoke(None, before_joke.config)
# write_joke re-executes (runs again), generate_topic does not
```

## 叉子

Fork 从过去的检查点创建一个具有修改状态的新分支。在先前的检查点上调用 [⟦T10⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.update_state) 创建分叉，然后使用 [⟦T11⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.invoke) 和 `None` 继续执行。

<img src="https://mintcdn.com/langchain-5e9cc07a/-_xGPoyjhyiDWTPJ/oss/images/checkpoints_full_story.jpg?fit=max&auto=format&n=-_xGPoyjhyiDWTPJ&q=85&s=a52016b2c44b57bd395d6e1eac47aa36" alt="Fork" width="3705" height="2598" data-path="oss/images/checkpoints_full_story.jpg" /><Warning>
  `update_state` **不**回滚线程。它创建一个从指定点分支的新检查点。原始的执行历史保持不变。
</Warning>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Find checkpoint before write_joke
history = list(graph.get_state_history(config))
before_joke = next(s for s in history if s.next == ("write_joke",))

# Fork: update state to change the topic
fork_config = graph.update_state(
    before_joke.config,
    values={"topic": "chickens"},
)

# Resume from the fork — write_joke re-executes with the new topic
fork_result = graph.invoke(None, fork_config)
print(fork_result["joke"])  # A joke about chickens, not socks
```

### 来自特定节点

当您调用[⟦T14⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.update_state)时，将使用指定节点的编写器（包括[reducers](/oss/python/langgraph/graph-api#reducers)）应用值。检查点将该节点记录为已生成更新，并从该节点的后继节点恢复执行。

默认情况下，LangGraph 从检查点的版本历史记录中推断 `as_node`。当从特定检查点分叉时，这个推论几乎总是正确的。

在以下情况下明确指定 `as_node`：

* **并行分支**：多个节点在同一步骤中更新状态，LangGraph 无法确定哪个是最后一个（`InvalidUpdateError`）。
* **没有执行历史**：在新线程上设置状态（常见于[testing](/oss/python/langgraph/test)）。
* **跳过节点**：将`as_node`设置为较晚的节点，使图认为该节点已经运行。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# graph: generate_topic -> write_joke

# Treat this update as if generate_topic produced it.
# Execution resumes at write_joke (the successor of generate_topic).
fork_config = graph.update_state(
    before_joke.config,
    values={"topic": "chickens"},
    as_node="generate_topic",
)
```

## 中断

如果您的图表将 [⟦T19⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 用于 [human-in-the-loop](/oss/python/langgraph/interrupts) 工作流程，则在时间旅行期间始终会重新触发中断。包含中断的节点重新执行，并且`interrupt()`暂停以等待新的`Command(resume=...)`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import interrupt, Command

class State(TypedDict):
    value: list[str]

def ask_human(state: State):
    answer = interrupt("What is your name?")
    return {"value": [f"Hello, {answer}!"]}

def final_step(state: State):
    return {"value": ["Done"]}

graph = (
    StateGraph(State)
    .add_node("ask_human", ask_human)
    .add_node("final_step", final_step)
    .add_edge(START, "ask_human")
    .add_edge("ask_human", "final_step")
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "1"}}

# First run: hits interrupt
graph.invoke({"value": []}, config)
# Resume with answer
graph.invoke(Command(resume="Alice"), config)

# Replay from before ask_human
history = list(graph.get_state_history(config))
before_ask = [s for s in history if s.next == ("ask_human",)][-1]

replay_result = graph.invoke(None, before_ask.config)
# Pauses at interrupt — waiting for new Command(resume=...)

# Fork from before ask_human
fork_config = graph.update_state(before_ask.config, {"value": ["forked"]})
fork_result = graph.invoke(None, fork_config)
# Pauses at interrupt — waiting for new Command(resume=...)

# Resume the forked interrupt with a different answer
graph.invoke(Command(resume="Bob"), fork_config)
# Result: {"value": ["forked", "Hello, Bob!", "Done"]}
```

### 多个中断如果您的图表在多个点收集输入（例如，多步骤表单），您可以在中断之间进行分叉以更改稍后的答案，而无需重新询问之前的问题。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def ask_name(state):
    name = interrupt("What is your name?")
    return {"value": [f"name:{name}"]}

def ask_age(state):
    age = interrupt("How old are you?")
    return {"value": [f"age:{age}"]}

# Graph: ask_name -> ask_age -> final
# After completing both interrupts:

# Fork from BETWEEN the two interrupts (after ask_name, before ask_age)
history = list(graph.get_state_history(config))
between = [s for s in history if s.next == ("ask_age",)][-1]

fork_config = graph.update_state(between.config, {"value": ["modified"]})
result = graph.invoke(None, fork_config)
# ask_name result preserved ("name:Alice")
# ask_age pauses at interrupt — waiting for new answer
```

## 子图

[subgraphs](/oss/python/langgraph/use-subgraphs) 的时间旅行取决于子图是否有自己的检查点。这决定了您可以进行时间旅行的检查点的粒度。

<Tabs>
  <Tab title="Inherited checkpointer (default)">
    默认情况下，子图继承父图的检查点。父级将整个子图视为**单个超级步骤** - 整个子图执行只有一个父级检查点。从子图重新执行之前开始的时间旅行。

    您无法时间旅行到默认子图中*节点之间的点 - 您只能从父级开始时间旅行。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    # Subgraph without its own checkpointer (default)
    subgraph = (
        StateGraph(State)
        .add_node("step_a", step_a)       # Has interrupt()
        .add_node("step_b", step_b)       # Has interrupt()
        .add_edge(START, "step_a")
        .add_edge("step_a", "step_b")
        .compile()  # No checkpointer — inherits from parent
    )

    graph = (
        StateGraph(State)
        .add_node("subgraph_node", subgraph)
        .add_edge(START, "subgraph_node")
        .compile(checkpointer=InMemorySaver())
    )

    config = {"configurable": {"thread_id": "1"}}

    # Complete both interrupts
    graph.invoke({"value": []}, config)            # Hits step_a interrupt
    graph.invoke(Command(resume="Alice"), config)  # Hits step_b interrupt
    graph.invoke(Command(resume="30"), config)     # Completes

    # Time travel from before the subgraph
    history = list(graph.get_state_history(config))
    before_sub = [s for s in history if s.next == ("subgraph_node",)][-1]

    fork_config = graph.update_state(before_sub.config, {"value": ["forked"]})
    result = graph.invoke(None, fork_config)
    # The entire subgraph re-executes from scratch
    # You cannot time travel to a point between step_a and step_b
    ```
  </Tab>

  <Tab title="Subgraph checkpointer">
    在子图上设置 `checkpointer=True` 以赋予其自己的检查点历史记录。这会在子图**内**的每个步骤创建检查点，允许您从子图中的特定点进行时间旅行 - 例如，在两个中断之间。

    使用 [⟦T23⟧](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.CompiledStateGraph.get_state) 和 `subgraphs=True` 访问子图自己的检查点配置，然后从中分叉：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    # Subgraph with its own checkpointer
    subgraph = (
        StateGraph(State)
        .add_node("step_a", step_a)       # Has interrupt()
        .add_node("step_b", step_b)       # Has interrupt()
        .add_edge(START, "step_a")
        .add_edge("step_a", "step_b")
        .compile(checkpointer=True)  # Own checkpoint history
    )

    graph = (
        StateGraph(State)
        .add_node("subgraph_node", subgraph)
        .add_edge(START, "subgraph_node")
        .compile(checkpointer=InMemorySaver())
    )

    config = {"configurable": {"thread_id": "1"}}

    # Run until step_a interrupt
    graph.invoke({"value": []}, config)

    # Resume step_a -> hits step_b interrupt
    graph.invoke(Command(resume="Alice"), config)

    # Get the subgraph's own checkpoint (between step_a and step_b)
    parent_state = graph.get_state(config, subgraphs=True)
    sub_config = parent_state.tasks[0].state.config

    # Fork from the subgraph checkpoint
    fork_config = graph.update_state(sub_config, {"value": ["forked"]})
    result = graph.invoke(None, fork_config)
    # step_b re-executes, step_a's result is preserved
    ```
  </Tab>
</Tabs>有关配置子图检查点的更多信息，请参阅[subgraph persistence](/oss/python/langgraph/use-subgraphs#subgraph-persistence)。

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-time-travel.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>