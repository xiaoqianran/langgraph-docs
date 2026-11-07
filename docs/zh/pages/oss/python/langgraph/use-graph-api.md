<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Build checklist for the Graph API | https://docs.langchain.com/oss/python/langgraph/use-graph-api -->

# 为 Graph API 构建清单

使用 Graph API 构建时决定状态、控制流、发送、命令和节点选项。

本指南将逐步介绍您在构建图表时做出的决策。有关安装和端到端代理示例，请参阅 [LangGraph quickstart](/oss/python/langgraph/quickstart)。有关设计演练，请参阅[Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)。有关概念，请参阅[Graph API overview](/oss/python/langgraph/graph-api)。

## 构建你的图表

按顺序完成这些决定。每个步骤都包含一个简短的示例以及指向完整食谱的操作方法的链接。

**1.定义共享状态**

决定数据节点共享哪些数据以及更新如何合并。

* 选择一个模式（`TypedDict`、数据类或 TypeScript 中的`StateSchema`）。
* 为多个节点写入的任何键添加[reducer](/oss/python/langgraph/graph-api#reducers)（例如，附加消息）。
* 当图表应向调用者隐藏内部通道时，使用私有或输入/输出模式。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated

from typing_extensions import TypedDict


class State(TypedDict):
    foo: int
    bar: Annotated[list[str], operator.add]
```

这里`foo`覆盖。 `bar` 附加`operator.add`。

对于 schema、reducer、消息和私有状态，请参阅 [Define and update state](/oss/python/langgraph/graph-api-state)。

**2.选择控制流**

决定工作如何在节点之间移动。* **顺序**：按顺序固定步骤。
* **分支**：条件边从状态中选择下一个节点。
* **并行**：扇出到多个节点，然后扇入（通常使用减速器）。
* **循环**：循环直到出现终止条件，或使用 [recursion limit](/oss/python/langgraph/graph-api#recursion-limit) 运行上限。

此序列检查数字是否为偶数，然后格式化消息：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    number: int
    is_even: bool
    message: str


def check_even(state: State):
    return {"is_even": state["number"] % 2 == 0}


def format_message(state: State):
    return {
        "message": (
            "The number is even." if state["is_even"] else "The number is odd."
        )
    }


workflow = StateGraph(State)
workflow.add_node("check_even", check_even)
workflow.add_node("format_message", format_message)
workflow.add_edge(START, "check_even")
workflow.add_edge("check_even", "format_message")
workflow.add_edge("format_message", END)
graph = workflow.compile()

graph.invoke({"number": 7})
```

对于分支、并行路径和循环，请参阅[Build sequences, branches, and loops](/oss/python/langgraph/graph-api-control-flow)。

**3.决定您是否需要发送或命令**

大多数图只需要节点、边和条件边。除非遇到以下情况之一，否则请保持在边缘布线。有关模式和示例，请参阅[Use Send and Command](/oss/python/langgraph/graph-api-send-command)。

当默认模型不够时，可以使用额外的功能：

* 当您必须为每个项目运行一次相同的节点，每个项目都有自己的输入，并且项目计数仅在运行时（map-reduce / Orchestrator-worker）时才知道时，请使用[⟦T10⟧](https://reference.langchain.com/python/langgraph/types/Send)。
* 当一个步骤必须既更新状态又选择下一个节点、在 [interrupt](/oss/python/langgraph/interrupts) 之后恢复或从工具更新状态时，请使用[⟦T11⟧](https://reference.langchain.com/python/langgraph/types/Command)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal

from langgraph.types import Command, Send


# Send: fan out one worker per item
def continue_to_jokes(state: OverallState):
    return [Send("generate_joke", {"subject": s}) for s in state["subjects"]]


# Command: update state and route in one return
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    return Command(
        update={"foo": "bar"},
        goto="my_other_node",
    )
```

**4.根据需要配置节点**

当可靠性或成本很重要时添加运行时选项：* 不稳定或缓慢步骤的重试和超时
* 错误处理程序和图范围节点默认值
* 缓存昂贵的重复工作
* 不属于状态的依赖项的运行时上下文或配置

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy

builder.add_node(
    "node_name",
    node_function,
    retry_policy=RetryPolicy(),
)
```

参见[Configure nodes](/oss/python/langgraph/graph-api-nodes)。

**5.可视化图表**

渲染 Mermaid 或 PNG 图以检查拓扑并调试路由。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
print(graph.get_graph().draw_mermaid())
```

参见[Visualize your graph](/oss/python/langgraph/graph-api-visualize)。

## 后续步骤

* [Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)：使用电子邮件代理进行设计演练
* [Graph API overview](/oss/python/langgraph/graph-api)：状态、节点、边、`Send`和`Command`的概念
* [Define and update state](/oss/python/langgraph/graph-api-state)
* [Build sequences, branches, and loops](/oss/python/langgraph/graph-api-control-flow)
* [Use Send and Command](/oss/python/langgraph/graph-api-send-command)
* [Configure nodes](/oss/python/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/python/langgraph/graph-api-visualize)
* [LangGraph quickstart](/oss/python/langgraph/quickstart)：端到端计算器代理

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。