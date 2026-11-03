<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Build sequences, branches, and loops | https://docs.langchain.com/oss/python/langgraph/graph-api-control-flow -->

# 构建序列、分支和循环

使用 LangGraph Graph API 编写序列、并行分支、条件边和循环。

使用 Graph API 编写 [sequences](#create-a-sequence-of-steps)、[parallel branches](#create-branches)、[conditional edges](#conditional-branching) 和 [loops](#create-and-control-loops)。对于map-reduce扇出和从节点返回边，请参阅[Use Send and Command](/oss/python/langgraph/graph-api-send-command)。有关节点级重试、超时和缓存，请参阅[Configure nodes](/oss/python/langgraph/graph-api-nodes)。

## 创建一系列步骤

> [!注意]
>
> **先决条件**
> 本指南假设您熟悉[Define and update state](/oss/python/langgraph/graph-api-state)。

本节展示如何构建顺序图。 Python 也有相同模式的 `add_sequence` 简写。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> s1[step_1]
    s1 --> s2[step_2]
    s2 --> s3[step_3]

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class s1,s2,s3 process
    class startNode terminal
```

在 [StateGraph](/oss/python/langgraph/graph-api#stategraph) 上添加一系列带有 [⟦T43⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node) 和 [⟦T44⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge) 的节点：

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

或者使用内置简写`.add_sequence`：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State).add_sequence([step_1, step_2, step_3])
builder.add_edge(START, "step_1")
```

> [accordion] 为什么使用 LangGraph 将应用程序步骤拆分为序列？
>
> LangGraph可以在图下添加持久层。状态在节点之间设置检查点，因此这些节点管理：
>
> * 状态更新是怎样的[checkpointed](/oss/python/langgraph/persistence)
> * [human-in-the-loop](/oss/python/langgraph/interrupts) 工作流程中的中断如何恢复
> * 如何使用 [time travel](/oss/python/langgraph/use-time-travel) 倒带和分支执行
>
> 它们还决定了[streamed](/oss/python/langgraph/streaming)的步骤，以及应用程序在[Studio](/langsmith/studio)中的可视化和调试方式。

以下端到端示例构建了三个步骤的序列：1.在state的key中填充一个值
2.更新相同的值
3. 填充不同的值

首先定义[state](/oss/python/langgraph/graph-api#state)。有关更新如何合并的信息，请参阅[Process state updates with reducers](/oss/python/langgraph/graph-api-state#process-state-updates-with-reducers)。

此示例跟踪两个值：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing_extensions import TypedDict


class State(TypedDict):
    value_1: str
    value_2: int
```

[Nodes](/oss/python/langgraph/graph-api#nodes) 是读取图形状态并返回更新的 Python 函数。第一个参数始终是状态：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def step_1(state: State):
    return {"value_1": "a"}


def step_2(state: State):
    current_value_1 = state["value_1"]
    return {"value_1": f"{current_value_1} b"}


def step_3(state: State):
    return {"value_2": 10}
```

> [!注意]
>
> 每个节点更新只能命名其更改的键。
>
> 默认情况下，**覆盖**这些键的先前值。当更新应该附加或合并时，请使用[reducers](/oss/python/langgraph/graph-api#reducers)。参见[Process state updates with reducers](/oss/python/langgraph/graph-api-state#process-state-updates-with-reducers)。

接下来，在该状态上定义 [StateGraph](/oss/python/langgraph/graph-api#stategraph) 并连接节点。

使用 [⟦T46⟧](/oss/python/langgraph/graph-api#nodes) 和 [⟦T47⟧](/oss/python/langgraph/graph-api#edges) 填充图形并定义其控制流。

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

> [!提示]
>
> **指定自定义名称**
> 将显式名称作为第一个参数传递给 [⟦T48⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> builder.add_node("my_node", step_1)
> ```

请注意：

* [⟦T49⟧](https://reference.langchain.com/python/langgraph/pregel/_draw/add_edge) 采用节点名称。对于裸函数，默认名称为`node.__name__`。
* 该图需要一个入口点：从[START node](/oss/python/langgraph/graph-api#start-node)添加一条边。
* 当没有更多节点要执行时，图表将停止。

然后[compile](/oss/python/langgraph/graph-api#compiling-your-graph)图表。编译运行基本结构检查（例如，孤立节点）。当应用程序需要持久性时，在此处传递 [checkpointer](/oss/python/langgraph/persistence)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph = builder.compile()
```

调用图表：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"value_1": "c"})
```

```
{'value_1': 'a b', 'value_2': 10}
```

请注意：* 此调用传递一个状态键的值。节点还可以写入不在输入中的键。
* 第一个节点覆盖传入的值。
* 第二个节点更新该值。
* 第三个节点填充不同的键。

> [!提示]
>
> **内置速记**
> `langgraph>=0.2.46` 包含用于添加节点序列的内置速记法 `add_sequence`。您可以按如下方式编译相同的图表：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> builder = StateGraph(State).add_sequence([step_1, step_2, step_3])  # [!code highlight]
> builder.add_edge(START, "step_1")
>
> graph = builder.compile()
>
> graph.invoke({"value_1": "c"})
> ```

## 创建分支

并行节点执行可加快图形运行速度。 LangGraph 以标准边缘和 [conditional\_edges](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges) 扇出和扇入。以下示例构建分支数据流。有关动态目标的映射减少扇出，请参阅[Use Send and Command](/oss/python/langgraph/graph-api-send-command)。

### 并行运行图节点

此示例从 `Node A` 扇出到 `B` 和 `C`，然后扇入到 `D`。该状态使用[reducer](/oss/python/langgraph/graph-api#reducers)，因此该键的值会累积而不是覆盖。对于列表，这意味着将新列表连接到现有列表上。参见[Process state updates with reducers](/oss/python/langgraph/graph-api-state#process-state-updates-with-reducers)。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[a]
    a --> b[b]
    a --> c[c]
    b --> d[d]
    c --> d
    d --> endNode([END])

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,c,d process
    class startNode,endNode terminal
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


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

通过reducer，可以看到每个节点添加的值都被累加了。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"aggregate": []}, {"configurable": {"thread_id": "foo"}})
```

```
Adding "A" to []
Adding "B" to ['A']
Adding "C" to ['A']
Adding "D" to ['A', 'B', 'C']
```> [!注意]
>
> 在上面的例子中，节点`"b"`和`"c"`在同一个[superstep](/oss/python/langgraph/graph-api#super-steps)中并发执行。由于它们处于同一步骤，因此节点 `"d"` 在 `"b"` 和 `"c"` 都完成后执行。
>
> 重要的是，来自并行超级步的更新的顺序可能不一致。如果您需要从并行超级步中对更新进行一致的、预定的排序，则应将输出连同用于排序的值一起写入状态中的单独字段。> [手风琴] 异常处理
>
> LangGraph 运行[supersteps](/oss/python/langgraph/graph-api#super-steps) 中的节点。超级步中的并行分支同时运行，但超级步是**事务性的**：如果任何分支引发，该超级步的更新**不会**应用于状态。
>
> 使用[checkpointer](/oss/python/langgraph/persistence)，已完成的超级步中成功节点的结果将被保存，并且在运行恢复时不会重复。
>
> 对于不稳定的工作，例如不可靠的 API 调用，请使用：
>
> 1. 节点内的普通`try` / `except`（或等效）。
> 2. 节点上的 **[⟦T64⟧](https://reference.langchain.com/python/langgraph/types/#langgraph.types.RetryPolicy)**，因此 LangGraph 重试选定的异常。只有失败的分支才会重试，因此成功的同级分支不会重新运行。
>
> 这些共同保持并行执行，同时您可以控制故障的处理方式。如需完整指南，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance)。

> [!提示]
>
> **设置最大并发数**
> 调用图表时将 `max_concurrency` 作为顶级配置键（不在 `configurable` 下）传递。参见[RunnableConfig](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> graph.invoke({"value_1": "c"}, {"max_concurrency": 10})
> ```

### 推迟节点执行

推迟节点执行会延迟节点，直到所有其他挂起的任务完成。当分支具有不同长度时（这在映射缩减工作流程中很常见），这一点很重要。当每条路径都是一步时，上面的并行示例会扇出和扇入。在 `"b"` 分支上添加节点 `"b_2"`，使路径长度不等。节点 `d` 使用 `defer` 因此它等待更长的分支：

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[a]
    a --> b[b]
    a --> c[c]
    b --> b2[b_2]
    b2 --> d[d]
    c --> d
    d --> endNode([END])

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,b2,c,d process
    class startNode,endNode terminal
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


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
graph.invoke({"aggregate": []})
```

```
Adding "A" to []
Adding "B" to ['A']
Adding "C" to ['A']
Adding "B_2" to ['A', 'B', 'C']
Adding "D" to ['A', 'B', 'C', 'B_2']
```

节点 `"b"` 和 `"c"` 在同一超级步中同时运行。节点 `d` 上的`defer=True` 会阻止其运行，直到所有挂起的任务完成，因此 `"d"` 等待完整的 `"b"` 分支。

当每个分支始终运行时，您可以使用列表形式的边缘而不是`defer=True`等待​​。 `add_edge` 还接受起始节点列表。这不是单独的 `add_edge` 调用的简写；这两种形式的行为不同：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.add_edge(["b_2", "c"], "d")  # d runs once, after both b_2 and c complete
```* **起始节点列表** 在所有列出的节点完成后运行 `d` 一次。如果其中之一从不运行（例如，条件边不选择其分支），则 `d` 永远不会运行，并且不会引发错误。已完成的分支的状态更新仍保留在图状态中，但 `d` 不会消耗它们。
* **单独的边** 在每个超级步骤中运行 `d` 一次，其中任何传入分支都完成。如果分支长度相等，则为单行；对于不同长度的分支，`d`运行不止一次。
* **使用`defer=True`**（上例中的模式）的单独边在每个选定分支完成后运行`d`一次，无论扇出选择了所有分支还是仅选择了其中一些分支。

`defer=True` 推迟节点，直到图中任何地方都没有待处理的任务，而不仅仅是在为其提供数据的分支中。寻址到该节点的[⟦T88⟧](/oss/python/langgraph/graph-api-send-command)仍然单独调用它。

### 条件分支

在运行时从状态路由到不同的节点。节点`a`更新状态，然后条件边选择`b`或`c`：

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[a]
    a -.-> b[b]
    a -.-> c[c]
    b --> endNode([END])
    c --> endNode

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,c process
    class startNode,endNode terminal
```

虚线边是条件路线。如果您的扇出在运行时应根据状态而变化，您可以使用 [⟦T92⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges) 使用图形状态选择一个或多个路径。请参阅以下示例，其中节点 `a` 生成确定下一个节点的状态更新。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Literal, Sequence

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    aggregate: Annotated[list, operator.add]
    # Branching key set by node a
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
result = graph.invoke({"aggregate": []})
print(result)
```

```
Adding "A" to []
Adding "C" to ['A']
{'aggregate': ['A', 'C'], 'which': 'c'}
```

> [!提示]
>
> 您的条件边可以路由到多个目标节点。例如：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> def route_bc_or_cd(state: State) -> Sequence[str]:
>     if state["which"] == "cd":
>         return ["c", "d"]
>     return ["b", "c"]
> ```

## 创建和控制循环

循环需要一种停止的方法。通常的模式是 [conditional edge](/oss/python/langgraph/graph-api#conditional-edges)，当满足终止条件时路由到 [END](/oss/python/langgraph/graph-api#end-node)。

您还可以在调用或流式传输时设置递归限制。该限制是在 LangGraph 引发错误之前允许的 [super-steps](/oss/python/langgraph/graph-api#super-steps) 数量。请参阅[recursion limit concept](/oss/python/langgraph/graph-api#recursion-limit)。

以下示例使用简单的循环图。节点`a`要么继续到`b`（返回到`a`），要么退出：

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[a]
    a -.-> b[b]
    a -.-> endNode([END])
    b --> a

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b process
    class startNode,endNode terminal
```

虚线边是条件路线。

> [!提示]
>
> 要在达到限制后赶上`GraphRecursionError`，请参阅[Impose a recursion limit](#impose-a-recursion-limit)。要在限制之前路由到完成路径，请参阅[Handle recursion with RemainingSteps](#handle-recursion-with-remainingsteps)。

添加对终止条件进行编码的条件边：

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
```用一个简单的循环定义一个图。条件边沿实现终止条件。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Literal

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


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

该架构类似于[ReAct agent](/oss/python/langgraph/workflows-agents)，其中节点`"a"`是工具调用模型，节点`"b"`代表工具。

在 `"aggregate"` 列表超过阈值长度后，`route` 条件边结束运行。

当您调用该图时，它会在节点 `"a"` 和 `"b"` 之间交替，直到满足该条件。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"aggregate": []})
```

```
Node A sees []
Node B sees ['A']
Node A sees ['A', 'B']
Node B sees ['A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B']
Node B sees ['A', 'B', 'A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B', 'A', 'B']
```

### 施加递归限制

当不能保证终止条件时，设置图形的[recursion limit](/oss/python/langgraph/graph-api#recursion-limit)。 LangGraph 在多次 [supersteps](/oss/python/langgraph/graph-api#super-steps) 之后加注 `GraphRecursionError`。捕获并处理异常：

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
Node A sees ['A', 'B']
Node B sees ['A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B']
Recursion Error
```> [accordion] 扩展示例：带分支的循环
>
> 更复杂的循环将一步扇出到两个节点：
>
> ```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> %%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
> flowchart LR
>     startNode([START]) --> a[a]
>     a -.-> b[b]
>     a -.-> endNode([END])
>     b --> c[c]
>     b --> d[d]
>     c --> a
>     d --> a
>
>     classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
>     classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
>     class a,b,c,d process
>     class startNode,endNode terminal
> ```
>
> 虚线边是从 `a` 出发的条件路线。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import operator
> from typing import Annotated, Literal
>
> from typing_extensions import TypedDict
>
> from langgraph.graph import END, START, StateGraph
>
>
> class State(TypedDict):
>     aggregate: Annotated[list, operator.add]
>
>
> def a(state: State):
>     print(f'Node A sees {state["aggregate"]}')
>     return {"aggregate": ["A"]}
>
>
> def b(state: State):
>     print(f'Node B sees {state["aggregate"]}')
>     return {"aggregate": ["B"]}
>
>
> def c(state: State):
>     print(f'Node C sees {state["aggregate"]}')
>     return {"aggregate": ["C"]}
>
>
> def d(state: State):
>     print(f'Node D sees {state["aggregate"]}')
>     return {"aggregate": ["D"]}
>
>
> builder = StateGraph(State)
> builder.add_node(a)
> builder.add_node(b)
> builder.add_node(c)
> builder.add_node(d)
>
>
> def route(state: State) -> Literal["b", END]:
>     if len(state["aggregate"]) < 7:
>         return "b"
>     else:
>         return END
>
>
> builder.add_edge(START, "a")
> builder.add_conditional_edges("a", route)
> builder.add_edge("b", "c")
> builder.add_edge("b", "d")
> builder.add_edge(["c", "d"], "a")
> graph = builder.compile()
> ```
>
> 该图是[supersteps](/oss/python/langgraph/graph-api#super-steps)的循环：节点A，然后B，然后C和D并发，然后返回A。列表形式的边等待`"c"`和`"d"`，然后返回`"a"`。有关列表形式的边与进入同一节点的单独边有何不同，请参阅[Defer node execution](#defer-node-execution)。
>
> 没有递归限制的调用会在终止条件之前完成两整圈：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> result = graph.invoke({"aggregate": []})
> ```
>
> ```
> Node A sees []
> Node B sees ['A']
> Node D sees ['A', 'B']
> Node C sees ['A', 'B']
> Node A sees ['A', 'B', 'C', 'D']
> Node B sees ['A', 'B', 'C', 'D', 'A']
> Node D sees ['A', 'B', 'C', 'D', 'A', 'B']
> Node C sees ['A', 'B', 'C', 'D', 'A', 'B']
> Node A sees ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D']
> ```
>
> 将递归限制设置为四时，仅完成一圈，因为每一圈是四个超级步骤：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.errors import GraphRecursionError
>
> try:
>     result = graph.invoke({"aggregate": []}, {"recursion_limit": 4})
> except GraphRecursionError:
>     print("Recursion Error")
> ```
>
> ```
> Node A sees []
> Node B sees ['A']
> Node C sees ['A', 'B']
> Node D sees ['A', 'B']
> Node A sees ['A', 'B', 'C', 'D']
> Recursion Error
> ```

### 访问并处理递归计数器

节点可以从运行元数据中读取当前步骤。在达到极限之前用它来做出反应。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.runnables import RunnableConfig


def my_node(state: dict, config: RunnableConfig) -> dict:
    current_step = config["metadata"]["langgraph_step"]
    print(f"Currently on step: {current_step}")
    return state
```

#### 使用 RemainingSteps 处理递归

`RemainingSteps` 是一个仅限 Python 的托管值，用于表示在递归限制之前剩余多少步。使用它在 LangGraph 引发 `GraphRecursionError` 之前路由到完成路径：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from typing import Annotated, Literal

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.managed.is_last_step import RemainingSteps


class State(TypedDict):
    messages: Annotated[list, operator.add]
    remaining_steps: RemainingSteps


def reasoning_node(state: State) -> dict:
    remaining = state["remaining_steps"]
    if remaining <= 2:
        return {"messages": ["Approaching limit, wrapping up..."]}
    return {"messages": ["thinking..."]}


def route_decision(state: State) -> Literal["reasoning_node", "fallback_node"]:
    if state["remaining_steps"] <= 2:
        return "fallback_node"
    return "reasoning_node"


def fallback_node(state: State) -> dict:
    return {"messages": ["Reached complexity limit, providing best effort answer"]}


builder = StateGraph(State)
builder.add_node("reasoning_node", reasoning_node)
builder.add_node("fallback_node", fallback_node)
builder.add_edge(START, "reasoning_node")
builder.add_conditional_edges("reasoning_node", route_decision)
builder.add_edge("fallback_node", END)
graph = builder.compile()

result = graph.invoke({"messages": []}, {"recursion_limit": 10})
```

用`RemainingSteps`处理图内的极限，或者在图外捕获`GraphRecursionError`：|方法|检测|处理|控制流程|
| - | - | - | - |
|积极主动 (`RemainingSteps`) |极限前|通过条件路由在图表内部 |图继续完成路径 |
|反应式 (`GraphRecursionError`) |极限后| `try` / `except` 图外 |图形执行停止 |

相关元数据键包括`langgraph_node`、`langgraph_triggers`、`langgraph_path`和`langgraph_checkpoint_ns`。

## 异步

当 [IO-bound](https://en.wikipedia.org/wiki/I/O_bound) 工作可以同时运行时，异步会有所帮助。要将同步图转换为异步图：

1. 使用`async def`而不是`def`定义节点。
2. 使用 `await` 进行这些节点内的异步调用。
3. 使用`.ainvoke`或`.astream`调用。

许多 LangChain 对象实现 [Runnable](https://reference.langchain.com/python/langchain-core/runnables/base/Runnable) 协议，该协议具有同步方法的异步变体。请参阅 [streaming guide](/oss/python/langgraph/streaming) 了解异步流示例。

## 另请参阅

* [Graph API overview](/oss/python/langgraph/graph-api)
* [Use Send and Command](/oss/python/langgraph/graph-api-send-command)
* [Configure nodes](/oss/python/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/python/langgraph/graph-api-visualize)
* [Streaming](/oss/python/langgraph/streaming)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-control-flow.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。