<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Test | https://docs.langchain.com/oss/python/langgraph/test -->

# 测试

在对 LangGraph 代理进行原型设计后，下一步自然是添加测试。本指南涵盖了编写单元测试时可以使用的一些有用模式。

请注意，本指南是特定于 LangGraph 的，涵盖了具有自定义结构的图周围的场景 - 如果您刚刚开始，请查看使用 LangChain 内置 [⟦T4⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 的[Test](/oss/python/langchain/test/)。

## 先决条件

首先，确保您已安装[⟦T5⟧](https://docs.pytest.org/)：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
$ pip install -U pytest
```

## 开始使用

由于许多 LangGraph 代理依赖于状态，因此一种有用的模式是在使用图形的每个测试之前创建图形，然后在测试中使用新的检查点实例对其进行编译。

下面的示例展示了这是如何使用一个简单的线性图来实现的，该图通过`node1`和`node2`进行。每个节点更新单个状态密钥`my_key`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import pytest

from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

def create_graph() -> StateGraph:
    class MyState(TypedDict):
        my_key: str

    graph = StateGraph(MyState)
    graph.add_node("node1", lambda state: {"my_key": "hello from node1"})
    graph.add_node("node2", lambda state: {"my_key": "hello from node2"})
    graph.add_edge(START, "node1")
    graph.add_edge("node1", "node2")
    graph.add_edge("node2", END)
    return graph

def test_basic_agent_execution() -> None:
    checkpointer = MemorySaver()
    graph = create_graph()
    compiled_graph = graph.compile(checkpointer=checkpointer)
    result = compiled_graph.invoke(
        {"my_key": "initial_value"},
        config={"configurable": {"thread_id": "1"}}
    )
    assert result["my_key"] == "hello from node2"
```

## 测试各个节点和边

编译后的 LangGraph 代理将以 `graph.nodes` 的形式公开对每个单独节点的引用。您可以利用它来测试代理中的各个节点。请注意，这将绕过编译图表时传递的任何检查指针：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import pytest

from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

def create_graph() -> StateGraph:
    class MyState(TypedDict):
        my_key: str

    graph = StateGraph(MyState)
    graph.add_node("node1", lambda state: {"my_key": "hello from node1"})
    graph.add_node("node2", lambda state: {"my_key": "hello from node2"})
    graph.add_edge(START, "node1")
    graph.add_edge("node1", "node2")
    graph.add_edge("node2", END)
    return graph

def test_individual_node_execution() -> None:
    # Will be ignored in this example
    checkpointer = MemorySaver()
    graph = create_graph()
    compiled_graph = graph.compile(checkpointer=checkpointer)
    # Only invoke node 1
    result = compiled_graph.nodes["node1"].invoke(
        {"my_key": "initial_value"},
    )
    assert result["my_key"] == "hello from node1"
```

## 部分执行对于由较大图组成的代理，您可能希望测试代理内的部分执行路径，而不是端到端的整个流程。在某些情况下，它可能对 [restructure these sections as subgraphs](/oss/python/langgraph/use-subgraphs) 具有语义意义，您可以像平常一样单独调用它。

但是，如果您不想更改代理图的整体结构，则可以使用 LangGraph 的持久性机制来模拟代理在所需部分开始之前暂停的状态，并在所需部分结束时再次暂停。步骤如下：

1. 使用检查点编译您的代理（内存中检查点[⟦T10⟧](https://reference.langchain.com/python/langgraph/checkpoints/#langgraph.checkpoint.memory.InMemorySaver)足以进行测试）。
2. 调用代理的 [⟦T11⟧](/oss/python/langgraph/use-time-travel) 方法，并将 [⟦T12⟧](/oss/python/langgraph/use-time-travel#from-a-specific-node) 参数设置为要开始测试的节点*之前*的节点名称。
3. 使用用于更新状态的相同 `thread_id` 和设置为要停止的节点名称的 `interrupt_after` 参数来调用代理。

以下是仅执行线性图中的第二个和第三个节点的示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import pytest

from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver

def create_graph() -> StateGraph:
    class MyState(TypedDict):
        my_key: str

    graph = StateGraph(MyState)
    graph.add_node("node1", lambda state: {"my_key": "hello from node1"})
    graph.add_node("node2", lambda state: {"my_key": "hello from node2"})
    graph.add_node("node3", lambda state: {"my_key": "hello from node3"})
    graph.add_node("node4", lambda state: {"my_key": "hello from node4"})
    graph.add_edge(START, "node1")
    graph.add_edge("node1", "node2")
    graph.add_edge("node2", "node3")
    graph.add_edge("node3", "node4")
    graph.add_edge("node4", END)
    return graph

def test_partial_execution_from_node2_to_node3() -> None:
    checkpointer = MemorySaver()
    graph = create_graph()
    compiled_graph = graph.compile(checkpointer=checkpointer)
    compiled_graph.update_state(
        config={
          "configurable": {
            "thread_id": "1"
          }
        },
        # The state passed into node 2 - simulating the state at
        # the end of node 1
        values={"my_key": "initial_value"},
        # Update saved state as if it came from node 1
        # Execution will resume at node 2
        as_node="node1",
    )
    result = compiled_graph.invoke(
        # Resume execution by passing None
        None,
        config={"configurable": {"thread_id": "1"}},
        # Stop after node 3 so that node 4 doesn't run
        interrupt_after="node3",
    )
    assert result["my_key"] == "hello from node3"
```

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/test.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>