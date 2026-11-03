<!-- langgraph-docs: Use Send and Command | https://docs.langchain.com/oss/python/langgraph/graph-api-send-command -->

# Use Send and Command

Build map-reduce workflows with Send and combine state updates with routing using Command in LangGraph.

[`Send`](https://reference.langchain.com/python/langgraph/types/Send) runs the same node once per item with a custom input when the item count is known only at runtime (map-reduce). [`Command`](https://reference.langchain.com/python/langgraph/types/Command) updates state and chooses the next node in one return. For ordinary sequences, branches, and loops, see [Control flow](/oss/python/langgraph/graph-api-control-flow). For concepts, see [Send](/oss/python/langgraph/graph-api#send) and [Command](/oss/python/langgraph/graph-api#command) on the Graph API overview.

## Use Send for map-reduce

Return one or more `Send` objects from a [conditional edge](/oss/python/langgraph/graph-api#conditional-edges). Each `Send` names a target node and passes that invocation's input. LangGraph runs those invocations in parallel. When workers write the same state key, use a [reducer](/oss/python/langgraph/graph-api#reducers) so updates merge (for example, concatenating lists).

The worker below does not receive the full graph state. `Send` passes `{ "subject": ... }` as that run's input, so the worker schema includes `subject` even though the overall state does not.

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

Dashed edges are `Send` fan-out: one `generate_joke` invocation per subject.

Stream node updates (this example has no chat model, so there are no message tokens to iterate):

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

## Combine control flow and state updates with Command

Return a [Command](https://reference.langchain.com/python/langgraph/types/Command) from a node when that step must both update state and choose what runs next. For routing alone, prefer [conditional edges](/oss/python/langgraph/graph-api#conditional-edges).

Shape of a `Command` return (full graph below):

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["my_other_node"]]:
    return Command(
        # state update
        update={"foo": "bar"},
        # control flow
        goto="my_other_node",
    )
```

The end-to-end example uses three nodes: A, then B or C. Node A updates state and picks the next node with `Command`, so the graph has no conditional edges between A, B, and C.

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

Build the [`StateGraph`](https://reference.langchain.com/python/langgraph/graph/state/StateGraph). Control flow lives in `node_a`, so there are no [conditional edges](/oss/python/langgraph/graph-api#conditional-edges) between A, B, and C.

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder = StateGraph(State)
builder.add_edge(START, "node_a")
builder.add_node(node_a)
builder.add_node(node_b)
builder.add_node(node_c)
# No edges between nodes A, B, and C

graph = builder.compile()
```

> [!WARNING]
>
> Annotate the return type as [`Command`](https://reference.langchain.com/python/langgraph/types/Command) with the possible destinations, for example `Command[Literal["node_b", "node_c"]]`. That declaration is required for graph rendering and tells LangGraph that `node_a` can navigate to `node_b` and `node_c`.

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

Dashed edges are `Command` routes from `node_a`. Repeated invokes take different paths (A → B or A → C) based on the random choice in node A.

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.invoke({"foo": ""})
```

```
Called A
Called C
```

### Navigate to a node in a parent graph

From a node inside a [subgraph](/oss/python/langgraph/use-subgraphs), route to a node in the parent graph with `graph=Command.PARENT`:

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def my_node(state: State) -> Command[Literal["other_subgraph"]]:
    return Command(
        update={"foo": "bar"},
        goto="other_subgraph",  # node in the parent graph
        graph=Command.PARENT,
    )
```

The example below turns node A into a single-node subgraph and adds it to a parent graph that still contains B and C.

> [!WARNING]
>
> **State updates with `Command.PARENT`**
> When a subgraph node updates a key that exists in both the parent and subgraph [state schemas](/oss/python/langgraph/graph-api#schema), define a [reducer](/oss/python/langgraph/graph-api#reducers) for that key on the parent. See the example below.

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

### Use inside tools

Return `Command(update=...)` from a tool to write graph state (for example, customer lookup results) during a turn. The fragment below assumes `get_user_info` / `getUserInfo` and a message history key named `messages`. Complete the imports and helpers in your app.

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

> [!WARNING]
>
> When returning [`Command`](https://reference.langchain.com/python/langgraph/types/Command) from a tool, include `messages` (or whichever state key holds the message history) in `Command.update`, and that list must contain a `ToolMessage`. LLM providers require an AI message with tool calls to be followed by tool result messages.

For tools that return [`Command`](https://reference.langchain.com/python/langgraph/types/Command), prefer the prebuilt [`ToolNode`](https://reference.langchain.com/python/langgraph/agents/#langgraph.prebuilt.tool_node.ToolNode), which propagates those objects into graph state. In a custom tool-calling node, propagate [`Command`](https://reference.langchain.com/python/langgraph/types/Command) returns from tools yourself.

## Resume after an interrupt

Use `Command` as input to `invoke` / `stream` only to resume after an [interrupt](/oss/python/langgraph/interrupts) (`resume=...`, optionally with `update` while resuming). Do not pass `Command(update=...)` alone to continue a conversation: any `Command` as input resumes from the latest checkpoint, not from `START`. Pass a plain state update to start a new turn.

For the full anti-pattern example, see [Input to invoke or stream](/oss/python/langgraph/graph-api#input-to-invoke-or-stream). For interrupt patterns, see [Interrupts](/oss/python/langgraph/interrupts).

## See also

* [Send](/oss/python/langgraph/graph-api#send) and [Command](/oss/python/langgraph/graph-api#command) on the Graph API overview
* [Interrupts](/oss/python/langgraph/interrupts)
* [Control flow](/oss/python/langgraph/graph-api-control-flow)
* [Use subgraphs](/oss/python/langgraph/use-subgraphs)
* [Configure nodes](/oss/python/langgraph/graph-api-nodes)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-send-command.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).