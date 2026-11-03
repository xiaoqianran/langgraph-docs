<!-- langgraph-docs: Use Send and Command | https://docs.langchain.com/oss/javascript/langgraph/graph-api-send-command -->

# Use Send and Command

Build map-reduce workflows with Send and combine state updates with routing using Command in LangGraph.

[`Send`](https://reference.langchain.com/javascript/langchain-langgraph/index/Send) runs the same node once per item with a custom input when the item count is known only at runtime (map-reduce). [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) updates state and chooses the next node in one return. For ordinary sequences, branches, and loops, see [Control flow](/oss/javascript/langgraph/graph-api-control-flow). For concepts, see [Send](/oss/javascript/langgraph/graph-api#send) and [Command](/oss/javascript/langgraph/graph-api#command) on the Graph API overview.

## Use Send for map-reduce

Return one or more `Send` objects from a [conditional edge](/oss/javascript/langgraph/graph-api#conditional-edges). Each `Send` names a target node and passes that invocation's input. LangGraph runs those invocations in parallel. When workers write the same state key, use a [reducer](/oss/javascript/langgraph/graph-api#reducers) so updates merge (for example, concatenating lists).

The worker below does not receive the full graph state. `Send` passes `{ "subject": ... }` as that run's input, so the worker schema includes `subject` even though the overall state does not.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  ConditionalEdgeRouter,
  START,
  END,
  Send,
} from "@langchain/langgraph";
import * as z from "zod";

const OverallState = new StateSchema({
  topic: z.string(),
  subjects: z.array(z.string()),
  jokes: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (x, y) => x.concat(y),
  }),
  bestSelectedJoke: z.string(),
});

const generateTopics: GraphNode<typeof OverallState> = (state) => {
  return { subjects: ["lions", "elephants", "penguins"] };
};

// Send passes { subject } as this invocation's input (not full OverallState)
const generateJoke = (state: { subject: string }) => {
  const jokeMap: Record<string, string> = {
    lions: "Why don't lions like fast food? Because they can't catch it!",
    elephants:
      "Why don't elephants use computers? They're afraid of the mouse!",
    penguins:
      "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice.",
  };
  return { jokes: [jokeMap[state.subject]] };
};

const continueToJokes: ConditionalEdgeRouter<{
  InputSchema: typeof OverallState;
  Nodes: "generateJoke";
}> = (state) => {
  return state.subjects.map(
    (subject) => new Send("generateJoke", { subject })
  );
};

const bestJoke: GraphNode<typeof OverallState> = (state) => {
  return { bestSelectedJoke: "penguins" };
};

const graph = new StateGraph(OverallState)
  .addNode("generateTopics", generateTopics)
  .addNode("generateJoke", generateJoke)
  .addNode("bestJoke", bestJoke)
  .addEdge(START, "generateTopics")
  .addConditionalEdges("generateTopics", continueToJokes)
  .addEdge("generateJoke", "bestJoke")
  .addEdge("bestJoke", END)
  .compile();
```

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await graph.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
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

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const stream = await graph.stream(
  { topic: "animals" },
  { streamMode: "updates" }
);
for await (const chunk of stream) {
  console.log(chunk);
}
```

```
{ generateTopics: { subjects: [ 'lions', 'elephants', 'penguins' ] } }
{ generateJoke: { jokes: [ "Why don't lions like fast food? Because they can't catch it!" ] } }
{ generateJoke: { jokes: [ "Why don't elephants use computers? They're afraid of the mouse!" ] } }
{ generateJoke: { jokes: [ "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice." ] } }
{ bestJoke: { bestSelectedJoke: 'penguins' } }
```

## Combine control flow and state updates with Command

Return a [Command](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) from a node when that step must both update state and choose what runs next. For routing alone, prefer [conditional edges](/oss/javascript/langgraph/graph-api#conditional-edges).

Shape of a `Command` return (full graph below):

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

const myNode = (state: typeof State.State) => {
  return new Command({
    // state update
    update: { foo: "bar" },
    // control flow
    goto: "myOtherNode",
  });
};
```

The end-to-end example uses three nodes: A, then B or C. Node A updates state and picks the next node with `Command`, so the graph has no conditional edges between A, B, and C.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, Command, START } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.string(),
});

const nodeA: GraphNode<{
  InputSchema: typeof State;
  Nodes: "nodeB" | "nodeC";
}> = (state) => {
  console.log("Called A");
  const value = Math.random() > 0.5 ? "b" : "c";
  const goto = value === "b" ? "nodeB" : "nodeC";

  return new Command({
    update: { foo: value },
    goto,
  });
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log("Called B");
  return { foo: state.foo + "b" };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log("Called C");
  return { foo: state.foo + "c" };
};
```

Build the `StateGraph`. Control flow lives in `nodeA`, so there are no [conditional edges](/oss/javascript/langgraph/graph-api#conditional-edges) between A, B, and C.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const graph = new StateGraph(State)
  .addNode("nodeA", nodeA, {
    ends: ["nodeB", "nodeC"],
  })
  .addNode("nodeB", nodeB)
  .addNode("nodeC", nodeC)
  .addEdge(START, "nodeA")
  .compile();
```

> [!WARNING]
>
> Pass `ends` on `addNode` to list which nodes `nodeA` can navigate to. That declaration is required for graph rendering and tells LangGraph that `nodeA` can navigate to `nodeB` and `nodeC`.

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await graph.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
```

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> a[nodeA]
    a -.-> b[nodeB]
    a -.-> c[nodeC]
    b --> endNode([END])
    c --> endNode

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,c process
    class startNode,endNode terminal
```

Dashed edges are `Command` routes from `nodeA`. Repeated invokes take different paths (A → B or A → C) based on the random choice in node A.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ foo: "" });
console.log(result);
```

```
Called A
Called C
{ foo: 'cc' }
```

### Navigate to a node in a parent graph

From a node inside a [subgraph](/oss/javascript/langgraph/use-subgraphs), route to a node in the parent graph with `graph=Command.PARENT`:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const myNode = (state: { foo: string }) => {
  return new Command({
    update: { foo: "bar" },
    goto: "otherSubgraph", // node in the parent graph
    graph: Command.PARENT,
  });
};
```

The example below turns node A into a single-node subgraph and adds it to a parent graph that still contains B and C.

> [!WARNING]
>
> **State updates with `Command.PARENT`**
> When a subgraph node updates a key that exists in both the parent and subgraph [state schemas](/oss/javascript/langgraph/graph-api#schema), define a [reducer](/oss/javascript/langgraph/graph-api#reducers) for that key on the parent. See the example below.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  Command,
  START,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: new ReducedValue(  // [!code highlight]
    z.string().default(""),
    { reducer: (x, y) => x + y }
  ),
});

const nodeA: GraphNode<{
  InputSchema: typeof State;
  Nodes: "nodeB" | "nodeC";
}> = (state) => {
  console.log("Called A");
  const value = Math.random() > 0.5 ? "a" : "b";
  const goto = value === "a" ? "nodeB" : "nodeC";

  return new Command({
    update: { foo: value },  // [!code highlight]
    goto,
    // Closest parent graph relative to this subgraph
    graph: Command.PARENT,
  });
};

const subgraph = new StateGraph(State)
  .addNode("nodeA", nodeA)
  .addEdge(START, "nodeA")
  .compile();

const nodeB: GraphNode<typeof State> = (state) => {
  console.log("Called B");
  // Reducer appends; do not manually concatenate onto state.foo
  return { foo: "b" };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log("Called C");
  return { foo: "c" };
};

const graph = new StateGraph(State)
  .addNode("subgraph", subgraph, { ends: ["nodeB", "nodeC"] })
  .addNode("nodeB", nodeB)
  .addNode("nodeC", nodeC)
  .addEdge(START, "subgraph")
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ foo: "" });
console.log(result);
```

```
Called A
Called C
{ foo: 'bc' }
```

### Use inside tools

Return `Command(update=...)` from a tool to write graph state (for example, customer lookup results) during a turn. The fragment below assumes `get_user_info` / `getUserInfo` and a message history key named `messages`. Complete the imports and helpers in your app.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { tool } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import * as z from "zod";

const lookupUserInfo = tool(
  async (_input, runtime) => {
    const userId = runtime.serverInfo?.user?.identity as string | undefined;  // [!code highlight]
    const userInfo = getUserInfo(userId);
    return new Command({
      update: {
        userInfo,
        messages: [
          {
            role: "tool",
            content: "Successfully looked up user information",
            tool_call_id: runtime.toolCall.id,
          },
        ],
      },
    });
  },
  {
    name: "lookupUserInfo",
    description:
      "Look up user information to better assist with questions.",
    schema: z.object({}),
  }
);
```

> [!WARNING]
>
> When returning [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) from a tool, include `messages` (or whichever state key holds the message history) in `Command.update`, and that list must contain a `ToolMessage`. LLM providers require an AI message with tool calls to be followed by tool result messages.

For tools that return [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command), prefer the prebuilt [`ToolNode`](https://reference.langchain.com/javascript/langchain-langgraph/prebuilt/ToolNode), which propagates those objects into graph state. In a custom tool-calling node, propagate [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) returns from tools yourself.

## Resume after an interrupt

Use `Command` as input to `invoke` / `stream` only to resume after an [interrupt](/oss/javascript/langgraph/interrupts) (`resume=...`, optionally with `update` while resuming). Do not pass `Command(update=...)` alone to continue a conversation: any `Command` as input resumes from the latest checkpoint, not from `START`. Pass a plain state update to start a new turn.

For the full anti-pattern example, see [Input to invoke or stream](/oss/javascript/langgraph/graph-api#input-to-invoke-or-stream). For interrupt patterns, see [Interrupts](/oss/javascript/langgraph/interrupts).

## See also

* [Send](/oss/javascript/langgraph/graph-api#send) and [Command](/oss/javascript/langgraph/graph-api#command) on the Graph API overview
* [Interrupts](/oss/javascript/langgraph/interrupts)
* [Control flow](/oss/javascript/langgraph/graph-api-control-flow)
* [Use subgraphs](/oss/javascript/langgraph/use-subgraphs)
* [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-send-command.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).