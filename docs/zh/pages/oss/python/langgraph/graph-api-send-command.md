<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use Send and Command | https://docs.langchain.com/oss/python/langgraph/graph-api-send-command -->

# 使用发送和命令

使用 Send 构建映射缩减工作流程，并使用 LangGraph 中的命令将状态更新与路由结合起来。

当项目计数仅在运行时已知时（映射减少），[⟦T17⟧](https://reference.langchain.com/python/langgraph/types/Send) 使用自定义输入为每个项目运行一次相同的节点。 [⟦T18⟧](https://reference.langchain.com/python/langgraph/types/Command) 在一次返回中更新状态并选择下一个节点。对于普通序列、分支和循环，请参见[Control flow](/oss/python/langgraph/graph-api-control-flow)。有关概念，请参阅 Graph API 概述中的 [Send](/oss/python/langgraph/graph-api#send) 和 [Command](/oss/python/langgraph/graph-api#command)。

## 使用 Send 进行映射缩减

从 [conditional edge](/oss/python/langgraph/graph-api#conditional-edges) 返回一个或多个 `Send` 对象。每个`Send`命名一个目标节点并传递该调用的输入。 LangGraph 并行运行这些调用。当工作人员写入相同的状态键时，请使用 [reducer](/oss/python/langgraph/graph-api#reducers) 以便更新合并（例如，串联列表）。

下面的工作人员没有收到完整的图状态。 `Send` 将 `{ "subject": ... }` 作为该运行的输入传递，因此工作器模式包含 `subject`，即使整体状态不包含。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing_extensions import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send


class OverallState(TypedDict):
    topic: str
    subjects: list[str]
    jokes: Annotated[list[str], operator.add]
    best_selected_joke: str


class JokeState(TypedDict):
    subject: str


def generate_topics(state: OverallState):
    return {"subjects": ["lions", "elephants", "penguins"]}


def generate_joke(state: JokeState):
    joke_map = {
        "lions": "Why don't lions like fast food? Because they can't catch it!",
        "elephants": "Why don't elephants use computers? They're afraid of the mouse!",
        "penguins": "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice.",
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

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> topics[generate_topics]
    topics -.-> joke1[generate_joke]
    topics -.-> joke2[generate_joke]
    topics -.-> joke3[generate_joke]
    joke1 --> best[best_joke]
    joke2 --> best
    joke3 --> best
    best --> endNode([END])

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class topics,joke1,joke2,joke3,best process
    class startNode,endNode terminal
```

虚线边缘是`Send`扇出：每个主题一次`generate_joke`调用。

流节点更新（此示例没有聊天模型，因此没有要迭代的消息令牌）：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for chunk in graph.stream({"topic": "animals"}, stream_mode="updates"):
    print(chunk)
```

```
{'generate_topics': {'subjects': ['lions', 'elephants', 'penguins']}}
{'generate_joke': {'jokes': ["Why don't lions like fast food? Because they can't catch it!"]}}
{'generate_joke': {'jokes': ["Why don't elephants use computers? They're afraid of the mouse!"]}}
{'generate_joke': {'jokes': ["Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice."]}}
{'best_joke': {'best_selected_joke': 'penguins'}}
```

## 将控制流和状态更新与 Command 结合起来当该步骤必须更新状态并选择下一步运行的内容时，从节点返回[Command](https://reference.langchain.com/python/langgraph/types/Command)。对于单独的路由，首选[conditional edges](/oss/python/langgraph/graph-api#conditional-edges)。

`Command` 返回的形状（完整图表如下）：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    return Command(
        # state update
        update={"foo": "bar"},
        # control flow
        goto="my_other_node",
    )
```

端到端示例使用三个节点：A、B 或 C。节点 A 更新状态并使用 `Command` 选择下一个节点，因此该图在 A、B 和 C 之间没有条件边。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import random
from typing_extensions import Literal, TypedDict

from langgraph.graph import START, StateGraph
from langgraph.types import Command


class State(TypedDict):
    foo: str


def node_a(state: State) -> Command[Literal["node_b", "node_c"]]:
    print("Called A")
    value = random.choice(["b", "c"])
    goto = "node_b" if value == "b" else "node_c"

    return Command(
        update={"foo": value},
        goto=goto,
    )


def node_b(state: State):
    print("Called B")
    return {"foo": state["foo"] + "b"}


def node_c(state: State):
    print("Called C")
    return {"foo": state["foo"] + "c"}
```

构建[⟦T28⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)。控制流存在于`node_a`中，因此A、B和C之间不存在[conditional edges](/oss/python/langgraph/graph-api#conditional-edges)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State)
builder.add_edge(START, "node_a")
builder.add_node(node_a)
builder.add_node(node_b)
builder.add_node(node_c)
# No edges between nodes A, B, and C

graph = builder.compile()
```

> [!警告]
>
> 将返回类型注释为 [⟦T30⟧](https://reference.langchain.com/python/langgraph/types/Command) 以及可能的目的地，例如 `Command[Literal["node_b", "node_c"]]`。该声明是图形渲染所必需的，并告诉 LangGraph `node_a` 可以导航到 `node_b` 和 `node_c`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from IPython.display import Image, display

display(Image(graph.get_graph().draw_mermaid_png()))
```

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[node_a]
    a -.-> b[node_b]
    a -.-> c[node_c]
    b --> endNode([END])
    c --> endNode

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,c process
    class startNode,endNode terminal
```

虚线边是从 `node_a` 出发的 `Command` 路线。根据节点 A 中的随机选择，重复调用采用不同的路径（A → B 或 A → C）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"foo": ""})
```

```
Called A
Called C
```

### 导航到父图中的节点

从[subgraph](/oss/python/langgraph/use-subgraphs)内的节点，路由到父图中具有`graph=Command.PARENT`的节点：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["other_subgraph"]]:
    return Command(
        update={"foo": "bar"},
        goto="other_subgraph",  # node in the parent graph
        graph=Command.PARENT,
    )
```

下面的示例将节点 A 转换为单节点子图，并将其添加到仍包含 B 和 C 的父图。> [!警告]
>
> **使用 `Command.PARENT`** 进行状态更新
> 当子图节点更新父图和子图[state schemas](/oss/python/langgraph/graph-api#schema)中都存在的键时，请在父图上为该键定义一个[reducer](/oss/python/langgraph/graph-api#reducers)。请参阅下面的示例。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
import random
from typing_extensions import Annotated, TypedDict

from langgraph.graph import START, StateGraph
from langgraph.types import Command


class State(TypedDict):
    foo: Annotated[str, operator.add]  # [!code highlight]


def node_a(state: State) -> Command:
    print("Called A")
    value = random.choice(["a", "b"])
    goto = "node_b" if value == "a" else "node_c"

    return Command(
        update={"foo": value},
        goto=goto,
        # Closest parent graph relative to this subgraph
        graph=Command.PARENT,  # [!code highlight]
    )


subgraph = StateGraph(State).add_node(node_a).add_edge(START, "node_a").compile()


def node_b(state: State):
    print("Called B")
    # Reducer appends; do not manually concatenate onto state["foo"]
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

从工具返回`Command(update=...)`，以在回合期间写入图形状态（例如，客户查找结果）。下面的片段假设 `get_user_info` / `getUserInfo` 和名为 `messages` 的消息历史记录键。完成应用程序中的导入和助手。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import ToolMessage
from langchain.tools import tool, ToolRuntime
from langgraph.types import Command


@tool
def lookup_user_info(runtime: ToolRuntime):
    """Look up user information to better assist with questions."""
    user = runtime.server_info.user if runtime.server_info else None
    user_info = get_user_info(user.identity if user is not None else None)  # [!code highlight]
    return Command(
        update={
            "user_info": user_info,
            "messages": [
                ToolMessage(
                    "Successfully looked up user information",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )
```

> [!警告]
>
> 从工具返回[⟦T43⟧](https://reference.langchain.com/python/langgraph/types/Command)时，在`Command.update`中包含`messages`（或保存消息历史记录的任何状态键），并且该列表必须包含`ToolMessage`。 LLM 提供商需要包含工具调用的 AI 消息，后跟工具结果消息。

对于返回 [⟦T47⟧](https://reference.langchain.com/python/langgraph/types/Command) 的工具，更喜欢预构建的 [⟦T48⟧](https://reference.langchain.com/python/langgraph/agents/#langgraph.prebuilt.tool_node.ToolNode)，它将这些对象传播到图状态中。在自定义工具调用节点中，自行传播工具返回的[⟦T49⟧](https://reference.langchain.com/python/langgraph/types/Command)。

## 中断后恢复使用 `Command` 作为 `invoke` / `stream` 的输入，仅在 [interrupt](/oss/python/langgraph/interrupts) 之后恢复（`resume=...`，恢复时可选择使用 `update`）。不要单独通过`Command(update=...)`继续对话：任何`Command`作为输入从最新的检查点恢复，而不是从`START`。通过简单的状态更新来开始新的回合。

有关完整的反模式示例，请参阅[Input to invoke or stream](/oss/python/langgraph/graph-api#input-to-invoke-or-stream)。有关中断模式，请参阅[Interrupts](/oss/python/langgraph/interrupts)。

## 另请参阅

* Graph API 概述中的[Send](/oss/python/langgraph/graph-api#send) 和 [Command](/oss/python/langgraph/graph-api#command)
* [Interrupts](/oss/python/langgraph/interrupts)
* [Control flow](/oss/python/langgraph/graph-api-control-flow)
* [Use subgraphs](/oss/python/langgraph/use-subgraphs)
* [Configure nodes](/oss/python/langgraph/graph-api-nodes)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-send-command.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。