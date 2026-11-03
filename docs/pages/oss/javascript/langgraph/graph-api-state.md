<!-- langgraph-docs: Define and update state | https://docs.langchain.com/oss/javascript/langgraph/graph-api-state -->

# Define and update state

Define graph state schemas, reducers, messages, and private state in the LangGraph Graph API.

[State](/oss/javascript/langgraph/graph-api#state) is the shared schema that nodes read and write. [Reducers](/oss/javascript/langgraph/graph-api#reducers) control how each update merges into the current value. This page covers:

1. How to use state to define a graph's [schema](/oss/javascript/langgraph/graph-api#schema)
2. How to use reducers to control how state updates are processed

## Define state

[State](/oss/javascript/langgraph/graph-api#state) in LangGraph is defined with the `StateSchema` class. It accepts [standard schemas](https://standardschema.dev/) (such as [Zod](https://zod.dev/)) for individual fields, plus value types like `ReducedValue`, `MessagesValue`, and `UntrackedValue`. Prefer `StateSchema` over the [legacy alternatives](#alternative-state-definitions).

By default, a graph uses the same schema for input and output, and the state determines that schema. See [Define input and output schemas](#define-input-and-output-schemas) for distinct input and output schemas.

Start with a [messages](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state) field. That shape fits many LLM applications. For more detail, see [Working with messages in graph state](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state).

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: MessagesValue,
  extraField: z.number(),
});
```

This state tracks a list of [message](/oss/javascript/langchain/messages) objects and an extra integer field. `MessagesValue` includes a built-in reducer, so a node can return only the new messages to append.

## Update state

Build a graph with a single [node](/oss/javascript/langgraph/graph-api#nodes). The node is a TypeScript function that reads graph state and returns updates. The first argument is always the state:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { AIMessage } from "@langchain/core/messages";
import { GraphNode } from "@langchain/langgraph";

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 };
};
```

This node returns only the new message. The `MessagesValue` reducer appends it to the existing list and sets `extraField`.

> [!WARNING]
>
> Nodes should return updates to the state directly, instead of mutating the state.

Define a simple graph with this node. Use [`StateGraph`](/oss/javascript/langgraph/graph-api#stategraph) for a graph that operates on this state, then [`addNode`](/oss/javascript/langgraph/graph-api#nodes) to populate the graph:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge("__start__", "node")
  .compile();
```

LangGraph provides built-in utilities for visualizing a graph. See [Visualize your graph](/oss/javascript/langgraph/graph-api-visualize) for detail.

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
    startNode([START]) --> n[node]

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class n process
    class startNode terminal
```

This graph executes a single node. Invoke it:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { HumanMessage } from "@langchain/core/messages";

const result = await graph.invoke({
  messages: [new HumanMessage("Hi")],
  extraField: 0,
});
console.log(result);
```

```
{ messages: [HumanMessage { content: 'Hi' }, AIMessage { content: 'Hello!' }], extraField: 10 }
```

Note that:

* Invocation started by updating a single key of the state.
* The invocation result includes the entire state.

Inspect [message](/oss/javascript/langchain/messages) content by logging:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

## Process state updates with reducers

Each key in the state can have its own [reducer](/oss/javascript/langgraph/graph-api#reducers) function, which controls how updates from nodes are applied. If no reducer is specified, updates to that key replace the previous value.

The earlier example already used `MessagesValue`, which includes a built-in reducer. For custom fields, use `ReducedValue` to define how updates are applied.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

// MessagesValue already has a built-in reducer
const State = new StateSchema({
  messages: MessagesValue, // [!code highlight]
  extraField: z.number(),
});
```

The node returns only the new message; the reducer appends it:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { GraphNode } from "@langchain/langgraph";

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 }; // [!code highlight]
};
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge(START, "node")
  .compile();

const result = await graph.invoke({ messages: [new HumanMessage("Hi")] });

for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

### MessagesValue

In practice, lists of messages need more than plain concatenation:

* Update an existing message in the state by ID.
* Accept shorthand [message formats](/oss/javascript/langgraph/graph-api#serialization), such as `{ role: "user", content: "..." }`.

`MessagesValue` is a field helper with a message-aware reducer that handles these cases:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, StateGraph, MessagesValue, GraphNode, START } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({ // [!code highlight]
  messages: MessagesValue,
  extraField: z.number(),
});

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 };
};

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge(START, "node")
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const inputMessage = { role: "user", content: "Hi" }; // [!code highlight]

const result = await graph.invoke({ messages: [inputMessage] });

for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

This shape fits applications that use [chat models](/oss/javascript/langchain/models). Unlike Python's `MessagesState` class, TypeScript has no separate prebuilt state type: put `MessagesValue` on the `messages` field of a `StateSchema`, as in the example above.

## Resetting a reducer field

A common source of confusion with reducers is that with a merging reducer, returning an empty value does not clear the field. The reducer merges the right argument into the left one, so an empty update is merged in and previously accumulated values are kept.

This pattern matters for error buffers or retry counters that must be cleared between retry attempts:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (state: string[], update: string[]) => state.concat(update) },
  ),
});

// node A returns { errors: ["bad sql"] }
// node B returns { errors: [] }
// state.errors is still ["bad sql"]; the empty array is merged in, not cleared
```

> [card] [View example trace](https://smith.langchain.com/public/4eafb2c7-d0bc-431c-9616-3efc73a43a46/r)
>
> Open a public LangSmith run for this example.

To let a node reset (clear) the field, define a custom reducer that replaces the accumulated value instead of merging it:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (_state: string[], update: string[]) => update }
  ),
});

// node can now clear the field with { errors: [] }
```

> [card] [View example trace](https://smith.langchain.com/public/9a3650c7-8f46-4cb6-b05c-120ca7009ca7/r)
>
> Open a public LangSmith run for this example.

Alternatively, wrap the update with `Overwrite` to bypass the reducer for a single update, while keeping the field's normal merging behavior for every other update:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Overwrite, ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (state: string[], update: string[]) => state.concat(update) },
  ),
});

const clearErrors = (_state: typeof State.State) => {
  return { errors: new Overwrite([]) };
};

// node can clear the field with { errors: new Overwrite([]) }
// while a normal node can still append with { errors: ["new error"] }
```

For more information, see [Bypass reducers with Overwrite](#bypass-reducers-with-overwrite).

## Bypass reducers with `Overwrite`

In some cases, you may want to bypass a reducer and directly overwrite a state value. When a node returns a value wrapped with `Overwrite`, the reducer is bypassed and the channel is set directly to that value.

This is useful when you want to reset or replace accumulated state rather than merge it with existing values.

LangGraph provides the `Overwrite` type for this purpose.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  END,
  Overwrite,
  ReducedValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      reducer: (current: string[], update: string[]) => current.concat(update),
    },
  ),
});

const addMessage = () => {
  return { messages: ["first message"] };
};

const replaceMessages = () => {
  // Bypass the reducer and replace the entire messages list
  return { messages: new Overwrite(["replacement message"]) };
};

const graph = new StateGraph(State)
  .addNode("add_message", addMessage)
  .addNode("replace_messages", replaceMessages)
  .addEdge(START, "add_message")
  .addEdge("add_message", "replace_messages")
  .addEdge("replace_messages", END)
  .compile();

const result = await graph.invoke({ messages: ["initial"] });
console.log(result.messages);
```

```
["replacement message"]
```

You can also use JSON format with the special key `"__overwrite__"`:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const replaceMessages = () => {
  return { messages: { __overwrite__: ["replacement message"] } };
};
```

> [!WARNING]
>
> When nodes execute in parallel, only one node can use `Overwrite` on the same state key in a given super-step. If multiple nodes attempt to overwrite the same key in the same super-step, an `InvalidUpdateError` is raised.

## Define input and output schemas

By default, `StateGraph` operates with a single schema, and all nodes communicate using that schema. You can also define distinct input and output schemas.

When distinct schemas are specified, an internal schema is still used for communication between nodes. The input schema validates the provided input. The output schema filters the internal data so `invoke` returns only the fields in the output schema.

Define distinct input and output schemas:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

// Define the schema for the input
const InputState = new StateSchema({
  question: z.string(),
});

// Define the schema for the output
const OutputState = new StateSchema({
  answer: z.string(),
});

// Define the overall schema, combining both input and output
const OverallState = new StateSchema({
  question: z.string(),
  answer: z.string(),
});

// Define the node that processes the input
const answerNode: GraphNode<typeof OverallState> = (state) => {
  // Example answer and an extra key
  return { answer: "bye", question: state.question };
};

// Build the graph with input and output schemas specified
const graph = new StateGraph({
  input: InputState,
  output: OutputState,
  state: OverallState,
})
  .addNode("answerNode", answerNode)
  .addEdge(START, "answerNode")
  .addEdge("answerNode", END)
  .compile();

// Invoke the graph with an input and print the result
console.log(await graph.invoke({ question: "hi" }));
```

```
{ answer: 'bye' }
```

Notice that the output of invoke only includes the output schema.

## Pass private state between nodes

Nodes sometimes need intermediate data that should not appear in the graph's main input or output schema. Keep that data private so only the nodes that need it can read it.

The following sequential graph has three nodes. Private data passes between the first two steps. The third step only sees the public overall state.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

// The overall state of the graph (this is the public state shared across nodes)
const OverallState = new StateSchema({
  a: z.string(),
});

// Output from node1 contains private data that is not part of the overall state
const Node1Output = new StateSchema({
  privateData: z.string(),
});

// Node 2 input only requests the private data available after node1
const Node2Input = new StateSchema({
  privateData: z.string(),
});

// The private data is only shared between node1 and node2
const node1: GraphNode<typeof OverallState> = (state) => {
  const output = { privateData: "set by node1" };
  console.log(`Entered node 'node1':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

const node2: GraphNode<typeof Node2Input> = (state) => {
  const output = { a: "set by node2" };
  console.log(`Entered node 'node2':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

// Node 3 only has access to the overall state (no access to private data from node1)
const node3: GraphNode<typeof OverallState> = (state) => {
  const output = { a: "set by node3" };
  console.log(`Entered node 'node3':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

// Connect nodes in a sequence
// node2 accepts private data from node1, whereas
// node3 does not see the private data.
const graph = new StateGraph(OverallState)
  .addNode("node1", node1)
  .addNode("node2", node2, { input: Node2Input })
  .addNode("node3", node3)
  .addEdge(START, "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .addEdge("node3", END)
  .compile();

// Invoke the graph with the initial state
const response = await graph.invoke({ a: "set at start" });

console.log(`\nOutput of graph invocation: ${JSON.stringify(response)}`);
```

```
Entered node 'node1':
	Input: {"a":"set at start"}.
	Returned: {"privateData":"set by node1"}
Entered node 'node2':
	Input: {"privateData":"set by node1"}.
	Returned: {"a":"set by node2"}
Entered node 'node3':
	Input: {"a":"set by node2"}.
	Returned: {"a":"set by node3"}

Output of graph invocation: {"a":"set by node3"}
```

## Private channels and streaming

Input, output, and private schemas constrain what each node reads and what `invoke` returns. They do **not** hide channels from [streaming](/oss/javascript/langgraph/streaming).

Values streaming emits **all** state channels by default, including private ones. That applies to the values projection from [event streaming](/oss/javascript/langgraph/event-streaming) (`stream.values` on `stream_events` / `streamEvents` with `version="v3"`), and to `graph.stream` with `stream_mode="values"` / `streamMode: "values"`. Values streaming uses the full state, not the output schema. A private channel can be missing from `invoke` output but visible in the stream.

This example uses distinct input, output, overall, and private schemas. `invoke` returns only the output schema:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const InputState = new StateSchema({
  userInput: z.string(),
});

const OutputState = new StateSchema({
  graphOutput: z.string(),
});

const OverallState = new StateSchema({
  foo: z.string(),
  userInput: z.string(),
  graphOutput: z.string(),
});

const PrivateState = new StateSchema({
  bar: z.string(),
});

const graph = new StateGraph({
  state: OverallState,
  input: InputState,
  output: OutputState,
})
  .addNode("node1", (state) => {
    // Write to OverallState
    return { foo: state.userInput + " name" };
  })
  .addNode("node2", (state) => {
    // Read from OverallState, write to the private bar channel
    return { bar: state.foo + " is" };
  })
  .addNode(
    "node3",
    (state) => {
      // Read from the private bar channel, write to OutputState
      return { graphOutput: state.bar + " Lance" };
    },
    // This input schema declares what node3 reads and registers bar as a graph channel.
    { input: PrivateState },
  )
  .addEdge(START, "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .addEdge("node3", END)
  .compile();

await graph.invoke({ userInput: "My" });
// { graphOutput: 'My name is Lance' }
```

> [card] [View example trace](https://smith.langchain.com/public/9e51e055-c781-40e7-9c11-ab0529e5a028/r)
>
> Open a public LangSmith run for this example.

Streaming with the values projection still includes the private `bar` channel:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const InputState = new StateSchema({
  userInput: z.string(),
});

const OutputState = new StateSchema({
  graphOutput: z.string(),
});

const OverallState = new StateSchema({
  foo: z.string(),
  userInput: z.string(),
  graphOutput: z.string(),
});

const PrivateState = new StateSchema({
  bar: z.string(),
});

const graph = new StateGraph({
  state: OverallState,
  input: InputState,
  output: OutputState,
})
  .addNode("node1", (state) => {
    return { foo: state.userInput + " name" };
  })
  .addNode("node2", (state) => {
    return { bar: state.foo + " is" };
  })
  .addNode(
    "node3",
    (state) => {
      return { graphOutput: state.bar + " Lance" };
    },
    { input: PrivateState },
  )
  .addEdge(START, "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .addEdge("node3", END)
  .compile();

const stream = await graph.streamEvents({ userInput: "My" }, { version: "v3" });
for await (const snapshot of stream.values) {
  console.log(snapshot);
}
// { userInput: 'My' }
// { foo: 'My name', userInput: 'My' }
// { foo: 'My name', userInput: 'My', bar: 'My name is' }            // <-- private channel
// { foo: 'My name', userInput: 'My', graphOutput: 'My name is Lance', bar: 'My name is' }
```

> [card] [View example trace](https://smith.langchain.com/public/bdecebeb-78fe-4831-ac5d-3bae88b8ddf6/r)
>
> Open a public LangSmith run for this example.

To restrict streamed values to specific channels (for example, only the output schema), pass `outputKeys` to `graph.stream`:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for await (const snapshot of await graph.stream(
  { userInput: "My" },
  { streamMode: "values", outputKeys: ["graphOutput"] }, // [!code highlight]
)) {
  console.log(snapshot);
}
// { graphOutput: 'My name is Lance' }
```

If you only need the channels a node produced in each step (not the full accumulated state), use `streamMode: "updates"` instead. See [Streaming](/oss/javascript/langgraph/streaming).

## Alternative state definitions

Prefer `StateSchema` for new graphs. LangGraph also supports the approaches below for legacy code and advanced channel control.

### Channels API

The channels API provides low-level control over state management. LangGraph provides several built-in channel types:

| Channel Type | Behavior | Use Case |
| - | - | - |
| `LastValue` | Stores the most recent value | Simple fields that get overwritten |
| `BinaryOperatorAggregate` | Combines values using a reducer function | Accumulating values (counters, lists) |
| `Topic` | Collects all values into a sequence | Event streams, audit logs |
| `EphemeralValue` | Value that resets between supersteps | Temporary computation state |

**Using the object shorthand:**

When you pass an object with `reducer` and `default`, it creates a `BinaryOperatorAggregate` channel. Passing `null` creates a `LastValue` channel:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";

interface WorkflowState {
  messages: BaseMessage[];
  question: string;
  answer: string;
}

const workflow = new StateGraph<WorkflowState>({
  channels: {
    // BinaryOperatorAggregate: combines values with a reducer
    messages: {
      reducer: (current, update) => current.concat(update),
      default: () => [],
    },
    // LastValue: stores the most recent value (null = no reducer)
    question: null,
    answer: null,
  },
});
```

**Using channel classes directly:**

For more control, you can instantiate channel classes from `@langchain/langgraph/channels`:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import {
  BinaryOperatorAggregate,
  LastValue,
  Topic,
} from "@langchain/langgraph/channels";

interface WorkflowState {
  messages: BaseMessage[];
  question: string;
  events: string[];
}

const workflow = new StateGraph<WorkflowState>({
  channels: {
    messages: new BinaryOperatorAggregate<BaseMessage[]>(
      (current, update) => current.concat(update),
      () => []
    ),
    question: new LastValue<string>(),
    // Topic collects all values pushed during execution
    events: new Topic<string>(),
  },
});
```

### Annotation.Root

`Annotation.Root` provides a declarative way to define state with reducers. It is similar to `StateSchema` but uses a different syntax:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, messagesStateReducer } from "@langchain/langgraph";

const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  question: Annotation<string>(),
  count: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),
});

const graph = new StateGraph(State);
```

### Zod objects with Zod v3

When using Zod v3, you can define state with plain `z.object()` schemas. LangGraph extends Zod v3 with a `.langgraph` plugin that provides `.reducer()` and `.metadata()` methods:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { z } from "zod/v3";
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, messagesStateReducer } from "@langchain/langgraph";
import "@langchain/langgraph/zod"; // registers the .langgraph plugin on Zod schemas

const State = z.object({
  // Use .langgraph.reducer() to attach a reducer function
  messages: z
    .array(z.custom<BaseMessage>())
    .default([])
    .langgraph.reducer(messagesStateReducer),
  // Simple fields work directly (last-write-wins)
  question: z.string().optional(),
  answer: z.string().optional(),
  // Custom reducer for accumulating values
  count: z
    .number()
    .default(0)
    .langgraph.reducer((current, update) => current + update),
});

const graph = new StateGraph(State);
```

### Zod objects with Zod v4

Zod v4 uses a registry-based approach. Use the LangGraph registry to attach metadata to schema fields:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, MessagesZodMeta, messagesStateReducer } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";

const State = z.object({
  // Use .register() with the LangGraph registry and MessagesZodMeta
  messages: z
    .array(z.custom<BaseMessage>())
    .default([])
    .register(registry, MessagesZodMeta),
  // Simple fields work directly (last-write-wins)
  question: z.string().optional(),
  answer: z.string().optional(),
  // Custom reducer via registry metadata
  count: z
    .number()
    .default(0)
    .register(registry, {
      reducer: { fn: (current: number, update: number) => current + update },
    }),
});

const graph = new StateGraph(State);
```

### Comparison table

| Approach | Reducers | Type Safety | Zod Version | Recommended |
| - | - | - | - | - |
| `StateSchema` | ✅ Built-in | ✅ Full | v3 or v4 | ✅ Yes |
| Channels API | ✅ Manual | ⚠️ Partial | N/A | For advanced cases |
| `Annotation.Root` | ✅ Built-in | ✅ Full | N/A | Legacy |
| Zod v3 + `.langgraph` | ✅ Via plugin | ✅ Full | v3 only | Legacy |
| Zod v4 + registry | ✅ Via registry | ✅ Full | v4 only | Legacy |

## See also

* [Graph API overview](/oss/javascript/langgraph/graph-api#state)
* [Working with messages in graph state](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state)
* [Event streaming](/oss/javascript/langgraph/event-streaming)
* [Streaming](/oss/javascript/langgraph/streaming)
* [Use the Graph API](/oss/javascript/langgraph/use-graph-api)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-state.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).