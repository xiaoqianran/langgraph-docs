<!-- langgraph-docs: Build sequences, branches, and loops | https://docs.langchain.com/oss/javascript/langgraph/graph-api-control-flow -->

# Build sequences, branches, and loops

Compose sequences, parallel branches, conditional edges, and loops with the LangGraph Graph API.

Compose [sequences](#create-a-sequence-of-steps), [parallel branches](#create-branches), [conditional edges](#conditional-branching), and [loops](#create-and-control-loops) with the Graph API. For map-reduce fan-out and returning edges from nodes, see [Use Send and Command](/oss/javascript/langgraph/graph-api-send-command). For node-level retries, timeouts, and caching, see [Configure nodes](/oss/javascript/langgraph/graph-api-nodes).

## Create a sequence of steps

> [!NOTE]
>
> **Prerequisites**
> This guide assumes familiarity with [Define and update state](/oss/javascript/langgraph/graph-api-state).

This section shows how to build a sequential graph. Python also has an `add_sequence` shorthand for the same pattern.

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

Add a sequence of nodes with `.addNode` and `.addEdge` on a [StateGraph](/oss/javascript/langgraph/graph-api#stategraph):

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START, StateGraph } from "@langchain/langgraph";

const builder = new StateGraph(State)
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addNode("step3", step3)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", "step3");
```

> [accordion] Why split application steps into a sequence with LangGraph?
>
> LangGraph can add a persistence layer under the graph. State is checkpointed between nodes, so those nodes govern:
>
> * How state updates are [checkpointed](/oss/javascript/langgraph/persistence)
> * How interruptions resume in [human-in-the-loop](/oss/javascript/langgraph/interrupts) workflows
> * How to rewind and branch executions with [time travel](/oss/javascript/langgraph/use-time-travel)
>
> They also shape how steps are [streamed](/oss/javascript/langgraph/streaming), and how the app is visualized and debugged in [Studio](/langsmith/studio).

The following end-to-end example builds a sequence of three steps:

1. Populate a value in a key of the state
2. Update the same value
3. Populate a different value

First define the [state](/oss/javascript/langgraph/graph-api#state). For how updates merge, see [Process state updates with reducers](/oss/javascript/langgraph/graph-api-state#process-state-updates-with-reducers).

This example tracks two values:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, GraphNode } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  value1: z.string(),
  value2: z.number(),
});
```

[Nodes](/oss/javascript/langgraph/graph-api#nodes) are TypeScript functions that read graph state and return updates. The first argument is always the state:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const step1: GraphNode<typeof State> = (state) => {
  return { value1: "a" };
};

const step2: GraphNode<typeof State> = (state) => {
  const currentValue1 = state.value1;
  return { value1: `${currentValue1} b` };
};

const step3: GraphNode<typeof State> = (state) => {
  return { value2: 10 };
};
```

> [!NOTE]
>
> Each node update can name only the keys it changes.
>
> By default, that **overwrites** the previous value for those keys. Use [reducers](/oss/javascript/langgraph/graph-api#reducers) when updates should append or combine instead. See [Process state updates with reducers](/oss/javascript/langgraph/graph-api-state#process-state-updates-with-reducers).

Next, define a [StateGraph](/oss/javascript/langgraph/graph-api#stategraph) on that state and wire the nodes.

Use [addNode](/oss/javascript/langgraph/graph-api#nodes) and [addEdge](/oss/javascript/langgraph/graph-api#edges) to populate the graph and define its control flow.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START, StateGraph } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .addNode("step1", step1)
  .addNode("step2", step2)
  .addNode("step3", step3)
  .addEdge(START, "step1")
  .addEdge("step1", "step2")
  .addEdge("step2", "step3")
  .compile();
```

> [!TIP]
>
> **Specifying custom names**
> Pass the node name as the first argument to `.addNode`:
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> const graph = new StateGraph(State)
>   .addNode("myNode", step1)
>   .addEdge(START, "myNode")
>   .compile();
> ```

Note that:

* `.addEdge` takes the node names you passed to `.addNode`.
* The graph needs an entry point: add an edge from the [START node](/oss/javascript/langgraph/graph-api#start-node).
* The graph halts when there are no more nodes to execute.

Then [compile](/oss/javascript/langgraph/graph-api#compiling-your-graph) the graph. Compile runs basic structure checks (for example, orphaned nodes). Pass a [checkpointer](/oss/javascript/langgraph/persistence) here when the app needs persistence.

Invoke the graph:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ value1: "c" });
console.log(result);
```

```
{ value1: 'a b', value2: 10 }
```

Note that:

* This invoke passes a value for one state key. Nodes can also write keys that were not in the input.
* The first node overwrites the value that was passed in.
* The second node updates that value.
* The third node populates a different key.

## Create branches

Parallel node execution speeds up graph runs. LangGraph fans out and fans in with standard edges and [conditional\_edges](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addConditionalEdges). The following examples build branching dataflows. For map-reduce fan-out to dynamic targets, see [Use Send and Command](/oss/javascript/langgraph/graph-api-send-command).

### Run graph nodes in parallel

This example fans out from `Node A` to `B` and `C`, then fans in to `D`. The state uses a [reducer](/oss/javascript/langgraph/graph-api#reducers) so values accumulate for that key instead of overwriting. For lists, that means concatenating the new list onto the existing list. See [Process state updates with reducers](/oss/javascript/langgraph/graph-api-state#process-state-updates-with-reducers).

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

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, ReducedValue, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  // The reducer makes this append-only
  aggregate: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
});

const nodeA: GraphNode<typeof State> = (state) => {
  console.log(`Adding "A" to ${state.aggregate}`);
  return { aggregate: ["A"] };
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log(`Adding "B" to ${state.aggregate}`);
  return { aggregate: ["B"] };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log(`Adding "C" to ${state.aggregate}`);
  return { aggregate: ["C"] };
};

const nodeD: GraphNode<typeof State> = (state) => {
  console.log(`Adding "D" to ${state.aggregate}`);
  return { aggregate: ["D"] };
};

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addNode("c", nodeC)
  .addNode("d", nodeD)
  .addEdge(START, "a")
  .addEdge("a", "b")
  .addEdge("a", "c")
  .addEdge("b", "d")
  .addEdge("c", "d")
  .addEdge("d", END)
  .compile();
```

With the reducer, you can see that the values added in each node are accumulated.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({
  aggregate: [],
});
console.log(result);
```

```
Adding "A" to []
Adding "B" to ['A']
Adding "C" to ['A']
Adding "D" to ['A', 'B', 'C']
{ aggregate: ['A', 'B', 'C', 'D'] }
```

> [!NOTE]
>
> In the above example, nodes `"b"` and `"c"` are executed concurrently in the same [superstep](/oss/javascript/langgraph/graph-api#super-steps). Because they are in the same step, node `"d"` executes after both `"b"` and `"c"` are finished.
>
> Importantly, updates from a parallel superstep may not be ordered consistently. If you need a consistent, predetermined ordering of updates from a parallel superstep, you should write the outputs to a separate field in the state together with a value with which to order them.

> [accordion] Exception handling
>
> LangGraph runs nodes in [supersteps](/oss/javascript/langgraph/graph-api#super-steps). Parallel branches in a superstep run concurrently, but the superstep is **transactional**: if any branch raises, **none** of that superstep's updates apply to state.
>
> With a [checkpointer](/oss/javascript/langgraph/persistence), results from successful nodes in a completed superstep are saved and do not repeat when the run resumes.
>
> For flaky work such as unreliable API calls, use either:
>
> 1. Ordinary `try` / `catch` (or equivalent) inside the node.
> 2. A **[`RetryPolicy`](https://reference.langchain.com/javascript/types/_langchain_langgraph.index.RetryPolicy.html)** on the node so LangGraph retries selected exceptions. Only failing branches retry, so successful siblings are not re-run.
>
> Together, these keep parallel execution while you control how failures are handled. For a full guide, see [Fault tolerance](/oss/javascript/langgraph/fault-tolerance).

> [!TIP]
>
> **Set max concurrency**
> Pass `maxConcurrency` as a top-level config key (not under `configurable`) when invoking the graph. See [LangGraphRunnableConfig](https://reference.langchain.com/javascript/interfaces/_langchain_langgraph.index.LangGraphRunnableConfig.html).
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> const result = await graph.invoke({ value1: "c" }, { maxConcurrency: 10 });
> ```

### Defer node execution

Deferring node execution delays a node until all other pending tasks are completed. This matters when branches have different lengths, which is common in map-reduce workflows.

The parallel example above fans out and fans in when each path is one step. Add a node `"b_2"` on the `"b"` branch so the paths have unequal length. Node `d` uses `defer` so it waits for the longer branch:

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

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  START,
  END,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  aggregate: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (x, y) => x.concat(y),
  }),
});

const nodeA: GraphNode<typeof State> = (state) => {
  console.log(`Adding "A" to ${state.aggregate}`);
  return { aggregate: ["A"] };
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log(`Adding "B" to ${state.aggregate}`);
  return { aggregate: ["B"] };
};

const nodeB2: GraphNode<typeof State> = (state) => {
  console.log(`Adding "B_2" to ${state.aggregate}`);
  return { aggregate: ["B_2"] };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log(`Adding "C" to ${state.aggregate}`);
  return { aggregate: ["C"] };
};

const nodeD: GraphNode<typeof State> = (state) => {
  console.log(`Adding "D" to ${state.aggregate}`);
  return { aggregate: ["D"] };
};

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addNode("b_2", nodeB2)
  .addNode("c", nodeC)
  .addNode("d", nodeD, { defer: true }) // [!code highlight]
  .addEdge(START, "a")
  .addEdge("a", "b")
  .addEdge("a", "c")
  .addEdge("b", "b_2")
  .addEdge("b_2", "d")
  .addEdge("c", "d")
  .addEdge("d", END)
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ aggregate: [] });
console.log(result);
```

```
Adding "A" to []
Adding "B" to []
Adding "C" to []
Adding "B_2" to [ 'A', 'B', 'C' ]
Adding "D" to [ 'A', 'B', 'C', 'B_2' ]
{ aggregate: [ 'A', 'B', 'C', 'B_2', 'D' ] }
```

Nodes `"b"` and `"c"` run concurrently in the same superstep. `{ defer: true }` on node `"d"` keeps it from running until all pending tasks finish, so `"d"` waits for the full `"b"` branch.

When every branch always runs, you can wait with a list-form edge instead of `{ defer: true }`. `addEdge` also accepts a list of start nodes. This is not shorthand for separate `addEdge` calls; the two forms behave differently:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
.addEdge(["b_2", "c"], "d") // d runs once, after both b_2 and c complete
```

* **A list of start nodes** runs `d` once, after all of the listed nodes have completed. If one of them never runs (for example, a conditional edge does not select its branch), `d` never runs and no error is raised. State updates from branches that did complete remain in the graph state, but `d` does not consume them.
* **Separate edges** run `d` once per superstep in which any incoming branch completes. With branches of equal length, that is a single run; with branches of different lengths, `d` runs more than once.
* **Separate edges with `{ defer: true }`** (the pattern in the example above) run `d` once, after every selected branch has completed, whether the fan-out selected all of the branches or only some of them.

`{ defer: true }` postpones the node until no tasks are pending anywhere in the graph, not only in the branches that feed it. A [`Send`](/oss/javascript/langgraph/graph-api-send-command) addressed to the node still invokes it separately.

### Conditional branching

Route to different nodes at runtime from state. Node `a` updates state, then a conditional edge chooses `b` or `c`:

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

Dashed edges are conditional routes.

If your fan-out should vary at runtime based on the state, you can use [`addConditionalEdges`](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#addconditionaledges) to select one or more paths using the graph state. See the following example, where node `a` generates a state update that determines the next node.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, ReducedValue, GraphNode, ConditionalEdgeRouter, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  aggregate: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
  // Branching key set by node a
  which: z.string(),  // [!code highlight]
});

const nodeA: GraphNode<typeof State> = (state) => {
  console.log(`Adding "A" to ${state.aggregate}`);
  return { aggregate: ["A"], which: "c" };
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log(`Adding "B" to ${state.aggregate}`);
  return { aggregate: ["B"] };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log(`Adding "C" to ${state.aggregate}`);
  return { aggregate: ["C"] };  // [!code highlight]
};

const conditionalEdge: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "b" | "c" }> = (state) => {
  // Fill in arbitrary logic here that uses the state
  // to determine the next node
  return state.which as "b" | "c";
};

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addNode("c", nodeC)
  .addEdge(START, "a")
  .addEdge("b", END)
  .addEdge("c", END)
  .addConditionalEdges("a", conditionalEdge)
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ aggregate: [] });
console.log(result);
```

```
Adding "A" to []
Adding "C" to ['A']
{ aggregate: ['A', 'C'], which: 'c' }
```

> [!TIP]
>
> Your conditional edges can route to multiple destination nodes. For example:
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> const routeBcOrCd: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "b" | "c" | "d" }> = (state) => {
>   if (state.which === "cd") {
>     return ["c", "d"];
>   }
>   return ["b", "c"];
> };
> ```

## Create and control loops

A loop needs a way to stop. The usual pattern is a [conditional edge](/oss/javascript/langgraph/graph-api#conditional-edges) that routes to [END](/oss/javascript/langgraph/graph-api#end-node) when a termination condition is met.

You can also set a recursion limit when invoking or streaming. The limit is the number of [super-steps](/oss/javascript/langgraph/graph-api#super-steps) allowed before LangGraph raises an error. See the [recursion limit concept](/oss/javascript/langgraph/graph-api#recursion-limit).

The following examples use a simple looping graph. Node `a` either continues to `b` (which returns to `a`) or exits:

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

Dashed edges are conditional routes.

> [!TIP]
>
> To catch `GraphRecursionError` after the limit is hit, see [Impose a recursion limit](#impose-a-recursion-limit).

Add a conditional edge that encodes the termination condition:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const route: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "b" }> = (state) => {
  if (terminationCondition(state)) {
    return END;
  } else {
    return "b";
  }
};

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addEdge(START, "a")
  .addConditionalEdges("a", route)
  .addEdge("b", "a")
  .compile();
```

To control the recursion limit, specify `"recursionLimit"` in the config. This will raise a `GraphRecursionError`, which you can catch and handle:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { GraphRecursionError } from "@langchain/langgraph";

try {
  await graph.invoke(inputs, { recursionLimit: 3 });
} catch (error) {
  if (error instanceof GraphRecursionError) {
    console.log("Recursion Error");
  }
}
```

Define a graph with a simple loop. A conditional edge implements the termination condition.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, ReducedValue, GraphNode, ConditionalEdgeRouter, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  // The reducer makes this append-only
  aggregate: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
});

const nodeA: GraphNode<typeof State> = (state) => {
  console.log(`Node A sees ${state.aggregate}`);
  return { aggregate: ["A"] };
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log(`Node B sees ${state.aggregate}`);
  return { aggregate: ["B"] };
};

// Define edges
const route: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "b" }> = (state) => {
  if (state.aggregate.length < 7) {
    return "b";
  } else {
    return END;
  }
};

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addEdge(START, "a")
  .addConditionalEdges("a", route)
  .addEdge("b", "a")
  .compile();
```

This architecture is similar to a [ReAct agent](/oss/javascript/langgraph/workflows-agents) in which node `"a"` is a tool-calling model, and node `"b"` represents the tools.

The `route` conditional edge ends the run after the `"aggregate"` list passes a threshold length.

When you invoke the graph, it alternates between nodes `"a"` and `"b"` until that condition is met.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ aggregate: [] });
console.log(result);
```

```
Node A sees []
Node B sees ['A']
Node A sees ['A', 'B']
Node B sees ['A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B']
Node B sees ['A', 'B', 'A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B', 'A', 'B']
{ aggregate: ['A', 'B', 'A', 'B', 'A', 'B', 'A'] }
```

### Impose a recursion limit

When a termination condition is not guaranteed, set the graph's [recursion limit](/oss/javascript/langgraph/graph-api#recursion-limit). LangGraph raises `GraphRecursionError` after that many [supersteps](/oss/javascript/langgraph/graph-api#super-steps). Catch and handle the exception:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { GraphRecursionError } from "@langchain/langgraph";

try {
  await graph.invoke({ aggregate: [] }, { recursionLimit: 4 });
} catch (error) {
  if (error instanceof GraphRecursionError) {
    console.log("Recursion Error");
  }
}
```

```
Node A sees []
Node B sees ['A']
Node A sees ['A', 'B']
Node B sees ['A', 'B', 'A']
Node A sees ['A', 'B', 'A', 'B']
Recursion Error
```

> [accordion] Extended example: loops with branches
>
> A more complex loop fans out one step into two nodes:
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
> Dashed edges are conditional routes from `a`.
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import {
>   StateGraph,
>   StateSchema,
>   ReducedValue,
>   GraphNode,
>   ConditionalEdgeRouter,
>   START,
>   END,
>   GraphRecursionError,
> } from "@langchain/langgraph";
> import * as z from "zod";
>
> const State = new StateSchema({
>   aggregate: new ReducedValue(z.array(z.string()).default(() => []), {
>     reducer: (x, y) => x.concat(y),
>   }),
> });
>
> const nodeA: GraphNode<typeof State> = (state) => {
>   console.log(`Node A sees ${state.aggregate}`);
>   return { aggregate: ["A"] };
> };
>
> const nodeB: GraphNode<typeof State> = (state) => {
>   console.log(`Node B sees ${state.aggregate}`);
>   return { aggregate: ["B"] };
> };
>
> const nodeC: GraphNode<typeof State> = (state) => {
>   console.log(`Node C sees ${state.aggregate}`);
>   return { aggregate: ["C"] };
> };
>
> const nodeD: GraphNode<typeof State> = (state) => {
>   console.log(`Node D sees ${state.aggregate}`);
>   return { aggregate: ["D"] };
> };
>
> const route: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "b" }> = (
>   state
> ) => {
>   if (state.aggregate.length < 7) {
>     return "b";
>   }
>   return END;
> };
>
> const graph = new StateGraph(State)
>   .addNode("a", nodeA)
>   .addNode("b", nodeB)
>   .addNode("c", nodeC)
>   .addNode("d", nodeD)
>   .addEdge(START, "a")
>   .addConditionalEdges("a", route)
>   .addEdge("b", "c")
>   .addEdge("b", "d")
>   .addEdge(["c", "d"], "a")
>   .compile();
> ```
>
> This graph is a loop of [supersteps](/oss/javascript/langgraph/graph-api#super-steps): Node A, then B, then C and D concurrent, then back to A. The list-form edge waits for both `"c"` and `"d"` before returning to `"a"`. For how list-form edges differ from separate edges into the same node, see [Defer node execution](#defer-node-execution).
>
> Invoking without a recursion limit completes two full laps before the termination condition:
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> const result = await graph.invoke({ aggregate: [] });
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
> With the recursion limit set to four, only one lap completes because each lap is four supersteps:
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> try {
>   await graph.invoke({ aggregate: [] }, { recursionLimit: 4 });
> } catch (error) {
>   if (error instanceof GraphRecursionError) {
>     console.log("Recursion Error");
>   }
> }
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

### Access and handle the recursion counter

Nodes can read the current step from run metadata. Use that to react before the limit is hit.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const myNode = (
  state: Record<string, unknown>,
  config: LangGraphRunnableConfig
) => {
  const currentStep = config.metadata?.langgraph_step;
  console.log(`Currently on step: ${currentStep}`);
  return state;
};
```

Related metadata keys include `langgraph_node`, `langgraph_triggers`, `langgraph_path`, and `langgraph_checkpoint_ns`. Prefer explicit termination conditions in the graph. Catching `GraphRecursionError` outside the graph is a safety net. There is no TypeScript equivalent of Python `RemainingSteps`.

## Async

TypeScript graph nodes and `graph.invoke` / `graph.stream` are already async. Use `await` at the call site; there is no separate `.ainvoke` API.

## See also

* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Use Send and Command](/oss/javascript/langgraph/graph-api-send-command)
* [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/javascript/langgraph/graph-api-visualize)
* [Streaming](/oss/javascript/langgraph/streaming)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-control-flow.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).