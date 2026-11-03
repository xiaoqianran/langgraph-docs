<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Visualize your graph | https://docs.langchain.com/oss/python/langgraph/graph-api-visualize -->

# 可视化你的图表

将 LangGraph 图形渲染为 Mermaid 图或 PNG 图像以进行调试和记录。

将编译后的图形渲染为 Mermaid 文本或 PNG 图像，以检查拓扑和调试路由。对于交互式 UI，请将 [LangSmith Studio](/langsmith/studio) 与 [local server](/oss/python/langgraph/local-server) 结合使用。

您可以可视化公开 `get_graph()` 的任何编译图，包括 [⟦T7⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)。请参阅[Graph](https://reference.langchain.com/python/langgraph/graphs/)参考。

下面的示例在两种语言中使用相同的小图：两个节点、来自 `node1` 的条件边以及来自 `node2` 的循环。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    value: int


def node1(state: State):
    return {"value": state["value"] + 1}


def node2(state: State):
    return {"value": state["value"] * 2}


def router(state: State) -> Literal["node2", "__end__"]:
    if state["value"] < 10:
        return "node2"
    return END


app = (
    StateGraph(State)
    .add_node("node1", node1)
    .add_node("node2", node2)
    .add_edge(START, "node1")
    .add_conditional_edges("node1", router)
    .add_edge("node2", "node1")
    .compile()
)
```

## 美人鱼

在可绘制图上调用 `draw_mermaid()` 以获得 Mermaid 语法。将字符串粘贴到任何 Mermaid 渲染器中，或将其保留在文档和 PR 中。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
print(app.get_graph().draw_mermaid())
```

```
---
config:
  flowchart:
    curve: linear
---
graph TD;
	__start__([<p>__start__</p>]):::first
	node1(node1)
	node2(node2)
	__end__([<p>__end__</p>]):::last
	__start__ --> node1;
	node1 -.-> __end__;
	node1 -.-> node2;
	node2 --> node1;
	classDef default fill:#f2f0ff,line-height:1.2
	classDef first fill-opacity:0
	classDef last fill:#bfb6fc
```

## PNG

使用以下三种方法之一渲染与 `.png` 相同的图形：

* Mermaid.ink API（默认；没有额外的包）
* 美人鱼 + Pyppeteer (`pip install pyppeteer`)
* Graphviz（`pip install pygraphviz`，加上系统[Graphviz](https://graphviz.org/download/)二进制）

**使用 Mermaid.ink**

默认情况下，`draw_mermaid_png()` 使用 Mermaid.ink API 生成图表。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(app.get_graph().draw_mermaid_png()))
```

![Simple graph visualization](https://mintcdn.com/langchain-5e9cc07a/AYevcpCoSD_dyIjm/oss/images/graph_api_image_10.png?fit=max\&auto=format\&n=AYevcpCoSD_dyIjm\&q=85\&s=c980c58f22863551d738293283e64e65)

**使用 Mermaid + Pyppeteer**

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import nest_asyncio
from IPython.display import Image, display
from langchain_core.runnables.graph import CurveStyle, MermaidDrawMethod, NodeStyles

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
from IPython.display import Image, display

try:
    display(Image(app.get_graph().draw_png()))
except ImportError:
    print(
        "Install pygraphviz to draw graphs with Graphviz: `pip install pygraphviz`. "
        "You also need the Graphviz system binary: https://graphviz.org/download/"
    )
```

## 另请参阅

* [Graph API overview](/oss/python/langgraph/graph-api)
* [Use the Graph API](/oss/python/langgraph/use-graph-api)
* [LangSmith Studio](/langsmith/studio)
* [Run a local server](/oss/python/langgraph/local-server)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-visualize.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。