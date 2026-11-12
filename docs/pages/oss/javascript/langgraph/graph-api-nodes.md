<!-- langgraph-docs: Configure nodes | https://docs.langchain.com/oss/javascript/langgraph/graph-api-nodes -->

# Configure nodes

Add runtime configuration, retry policies, timeouts, error handling, defaults, and caching to LangGraph nodes.

[Nodes](/oss/javascript/langgraph/graph-api#nodes) are the steps of a Graph API graph. This page covers how to attach runtime configuration, retries, timeouts, error handlers, defaults, and caching when you add a node. For wiring nodes into sequences, branches, and loops, see [Control flow](/oss/javascript/langgraph/graph-api-control-flow). For the full retry, timeout, and error lifecycle, see [Fault tolerance](/oss/javascript/langgraph/fault-tolerance).

## Add runtime configuration

Pass values into a run (for example, which LLM or system prompt to use) without putting those values in graph state.

To add runtime configuration:

1. Specify a schema for your configuration
2. Add the configuration to the function signature for nodes or conditional edges
3. Pass the configuration into the graph

See below for a simple example:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, END, START } from "@langchain/langgraph";
import * as z from "zod";

// 1. Specify config schema
const ContextSchema = z.object({
  myRuntimeValue: z.string(),
});

// 2. Define a graph that accesses the config in a node
const State = new StateSchema({
  myStateValue: z.number(),
});

const node: GraphNode<typeof State> = (state, config) => {
  if (config?.context?.myRuntimeValue === "a") {  // [!code highlight]
    return { myStateValue: 1 };
  } else if (config?.context?.myRuntimeValue === "b") {  // [!code highlight]
    return { myStateValue: 2 };
  } else {
    throw new Error("Unknown values.");
  }
};

const graph = new StateGraph(State, ContextSchema)
  .addNode("node", node)
  .addEdge(START, "node")
  .addEdge("node", END)
  .compile();

// 3. Pass in configuration at runtime:
console.log(await graph.invoke({}, { context: { myRuntimeValue: "a" } }));  // [!code highlight]
console.log(await graph.invoke({}, { context: { myRuntimeValue: "b" } }));  // [!code highlight]
```

```
{ myStateValue: 1 }
{ myStateValue: 2 }
```

> [accordion] Extended example: specifying LLM at runtime
>
> Choose OpenAI or Anthropic at invoke time. These examples call live providers and need API keys.
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatOpenAI } from "@langchain/openai";
> import { ChatAnthropic } from "@langchain/anthropic";
> import { StateGraph, StateSchema, MessagesValue, GraphNode, START, END } from "@langchain/langgraph";
> import * as z from "zod";
>
> const ContextSchema = z.object({
>   modelProvider: z.string().default("anthropic"),
> });
>
> const State = new StateSchema({
>   messages: MessagesValue,
> });
>
> const MODELS = {
>   anthropic: new ChatAnthropic({ model: "claude-haiku-4-5-20251001" }),
>   openai: new ChatOpenAI({ model: "gpt-5.4-mini" }),
> };
>
> const callModel: GraphNode<typeof State> = async (state, config) => {
>   const modelProvider = config?.context?.modelProvider || "anthropic";
>   const model = MODELS[modelProvider as keyof typeof MODELS];
>   const response = await model.invoke(state.messages);
>   return { messages: [response] };
> };
>
> const graph = new StateGraph(State, ContextSchema)
>   .addNode("model", callModel)
>   .addEdge(START, "model")
>   .addEdge("model", END)
>   .compile();
>
> // Usage
> const inputMessage = { role: "user", content: "hi" };
> // With no configuration, uses default (Anthropic)
> const response1 = await graph.invoke({ messages: [inputMessage] });
> // Or, can set OpenAI
> const response2 = await graph.invoke(
>   { messages: [inputMessage] },
>   { context: { modelProvider: "openai" } },
> );
>
> console.log(response1.messages.at(-1)?.response_metadata?.model);
> console.log(response2.messages.at(-1)?.response_metadata?.model);
> ```
>
> ```
> claude-haiku-4-5-20251001
> gpt-5.4-mini
> ```

> [accordion] Extended example: specifying model and system message at runtime
>
> Configure both the model provider and a system message at invoke time. These examples call live providers and need API keys.
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatOpenAI } from "@langchain/openai";
> import { ChatAnthropic } from "@langchain/anthropic";
> import { SystemMessage } from "@langchain/core/messages";
> import { StateGraph, StateSchema, MessagesValue, GraphNode, START, END } from "@langchain/langgraph";
> import * as z from "zod";
>
> const ContextSchema = z.object({
>   modelProvider: z.string().default("anthropic"),
>   systemMessage: z.string().optional(),
> });
>
> const State = new StateSchema({
>   messages: MessagesValue,
> });
>
> const MODELS = {
>   anthropic: new ChatAnthropic({ model: "claude-haiku-4-5-20251001" }),
>   openai: new ChatOpenAI({ model: "gpt-5.4-mini" }),
> };
>
> const callModel: GraphNode<typeof State> = async (state, config) => {
>   const modelProvider = config?.context?.modelProvider || "anthropic";
>   const systemMessage = config?.context?.systemMessage;
>
>   const model = MODELS[modelProvider as keyof typeof MODELS];
>   let messages = state.messages;
>
>   if (systemMessage) {
>     messages = [new SystemMessage(systemMessage), ...messages];
>   }
>
>   const response = await model.invoke(messages);
>   return { messages: [response] };
> };
>
> const graph = new StateGraph(State, ContextSchema)
>   .addNode("model", callModel)
>   .addEdge(START, "model")
>   .addEdge("model", END)
>   .compile();
>
> // Usage
> const inputMessage = { role: "user", content: "hi" };
> const response = await graph.invoke(
>   { messages: [inputMessage] },
>   {
>     context: {
>       modelProvider: "openai",
>       systemMessage: "Respond in Italian.",
>     },
>   }
> );
>
> for (const message of response.messages) {
>   console.log(`${message.getType()}: ${message.content}`);
> }
> ```
>
> ```
> human: hi
> ai: Ciao! Come posso aiutarti oggi?
> ```

## Add retry policies

Attach a retry policy when a node calls an API, database, or LLM that can fail transiently.

Pass `retryPolicy` to [`addNode`](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.Graph.html#addnode). An empty object uses the built-in defaults:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const builder = new StateGraph(State)
  .addNode("nodeName", nodeFunction, { retryPolicy: {} });
```

Retries are opt-in: without a `retryPolicy`, the first failure ends the attempt. If the policy omits `retryOn`, LangGraph retries thrown errors except:

* Abort and cancellation errors (`error.name === "AbortError"`, or `error.message` starts with `"Cancel"` or `"AbortError"`)
* `GraphValueError`, matched by `error.name`
* Aborted connections (`error.code === "ECONNABORTED"`)
* HTTP client errors with status 400, 401, 402, 403, 404, 405, 406, 407, or 409
* OpenAI-style quota errors (`error.error?.code === "insufficient_quota"`)

See [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#retries) for the full default list and parameters.

> [accordion] Extended example: customizing retry policies
>
> These snippets show how to attach different retry policies. They do not create database tables or invoke the graph.
>
> Pass different retry policies to a model node and a SQL node. The example uses Node.js built-in `node:sqlite` (Node.js 22.5 or later):
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { DatabaseSync } from "node:sqlite";
> import { ChatAnthropic } from "@langchain/anthropic";
> import { AIMessage } from "@langchain/core/messages";
> import {
>   END,
>   GraphNode,
>   MessagesValue,
>   START,
>   StateGraph,
>   StateSchema,
> } from "@langchain/langgraph";
>
> const State = new StateSchema({
>   messages: MessagesValue,
> });
>
> // Create an in-memory database
> const db = new DatabaseSync(":memory:");
>
> const model = new ChatAnthropic({ model: "claude-haiku-4-5-20251001" });
>
> const callModel: GraphNode<typeof State> = async (state) => {
>   const response = await model.invoke(state.messages);
>   return { messages: [response] };
> };
>
> const queryDatabase: GraphNode<typeof State> = async (_state) => {
>   const queryResult: string = JSON.stringify(
>     db.prepare("SELECT * FROM Artist LIMIT 10;").all(),
>   );
>
>   return { messages: [new AIMessage({ content: queryResult })] };
> };
>
> const workflow = new StateGraph(State)
>   .addNode("call_model", callModel, { retryPolicy: { maxAttempts: 5 } })
>   .addNode("query_database", queryDatabase, {
>     retryPolicy: {
>       retryOn: (e: unknown): boolean => {
>         if (
>           e &&
>           typeof e === "object" &&
>           "code" in e &&
>           (e as { code: string }).code === "ERR_SQLITE_ERROR"
>         ) {
>           // Retry on SQLite runtime errors (for example, a locked database)
>           return true;
>         }
>         return false; // Do not retry on other errors
>       },
>     },
>   })
>   .addEdge(START, "call_model")
>   .addEdge("call_model", "query_database")
>   .addEdge("query_database", END);
>
> const graph = workflow.compile();
> ```

## Set node timeouts

> [!NOTE]
>
> Requires `@langchain/langgraph` v1.4.0 or later.

Pass `timeout` to [`addNode`](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addNode) to cap how long a single node attempt may run. Use a number (milliseconds) or a [`TimeoutPolicy`](https://reference.langchain.com/javascript/langchain-langgraph/index/TimeoutPolicy) for separate run and idle limits:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  START,
  END,
  NodeTimeoutError,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  value: z.string(),
});

const callModel = async () => {
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  return { value: "done" };
};

const graph = new StateGraph(State)
  .addNode("model", callModel, { timeout: 1_000 })
  // Or: { timeout: { runTimeout: 120_000, idleTimeout: 30_000 } }
  .addEdge(START, "model")
  .addEdge("model", END)
  .compile();

try {
  await graph.invoke({ value: "start" });
} catch (error) {
  if (error instanceof NodeTimeoutError) {
    console.log("Node timed out");
  }
}
```

When a node exceeds its timeout, LangGraph raises [`NodeTimeoutError`](https://reference.langchain.com/javascript/langchain-langgraph/index/NodeTimeoutError), clears writes from the failed attempt, and lets the retry policy decide whether to retry. The timeout applies to each attempt independently.

See [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#timeouts) for the full timeout lifecycle, idle-timeout refresh sources, and heartbeats.

## Handle node errors

> [!NOTE]
>
> Requires `@langchain/langgraph` v1.4.0 or later.

Pass `errorHandler` to [`addNode`](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addNode) on [`StateGraph`](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) (not the base `Graph` class). The handler runs after retries are exhausted and can route with [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command):

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  START,
  Command,
  NodeError,
} from "@langchain/langgraph";
import * as z from "zod";

class ConnectionError extends Error {}

const State = new StateSchema({
  status: z.string(),
});

const chargePayment = () => {
  throw new Error("payment gateway timeout");
};

const paymentErrorHandler = (
  state: typeof State.State,
  error: NodeError
) =>
  new Command({
    update: { status: `compensated: ${error.error.message}` },
    goto: "finalize",
  });

const finalize = (state: typeof State.State) => state;

const graph = new StateGraph(State)
  .addNode("chargePayment", chargePayment, {
    retryPolicy: {
      maxAttempts: 3,
      retryOn: (err) => err instanceof ConnectionError,
    },
    errorHandler: paymentErrorHandler,
  })
  .addNode("finalize", finalize)
  .addEdge(START, "chargePayment")
  .compile();
```

See [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#error-handling) for compensation patterns and `Command` routing.

## Set graph-wide node defaults

> [!NOTE]
>
> Requires `@langchain/langgraph` v1.4.0 or later.

Use [`setNodeDefaults`](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph#member-setNodeDefaults) to set `retryPolicy`, `timeout`, `cachePolicy`, or `errorHandler` once for every node in a graph, instead of repeating them on each `addNode` call. Per-node values always win, and defaults are applied at compile time:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, START } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .setNodeDefaults({
    retryPolicy: { maxAttempts: 3 },
    timeout: { runTimeout: 30_000 },
    errorHandler: fallbackHandler,
  })
  .addNode("a", nodeA)
  .addNode("b", nodeB, { retryPolicy: { maxAttempts: 5 } }) // overrides default
  .addEdge(START, "a")
  .compile();
```

`retryPolicy` and `timeout` defaults apply to every node, including error-handler nodes. `cachePolicy` and `errorHandler` defaults apply only to regular nodes. Handlers never catch themselves, and caching a handler result is unsafe. Defaults are not inherited by subgraphs.

See [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#graph-defaults) for the full precedence rules and applicability table.

## Access execution info inside a node

Access execution identity and retry information via `config.executionInfo` on the node's second argument (`LangGraphRunnableConfig`). This surfaces thread, run, and checkpoint identifiers as well as retry state.

| Attribute | Type | Description |
| - | - | - |
| `threadId` | `string \| undefined` | Thread ID for the current execution. |
| `runId` | `string \| undefined` | Run ID for the current execution. |
| `checkpointId` | `string` | Checkpoint ID for the current execution. |
| `checkpointNs` | `string` | Checkpoint namespace for the current execution. |
| `taskId` | `string` | Task ID for the current execution. |
| `nodeAttempt` | `number` | Current execution attempt number (1-indexed). |
| `nodeFirstAttemptTime` | `number \| undefined` | Unix timestamp (milliseconds) of when the first attempt started. Stays the same across retries. |

#### Access thread and run IDs

Use `executionInfo` to access the thread ID, run ID, and other identity fields inside a node:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  result: z.string(),
});

const myNode: GraphNode<typeof State> = async (state, config) => {
  const info = config.executionInfo;
  console.log(`Thread: ${info?.threadId}, Run: ${info?.runId}`);  // [!code highlight]
  return { result: "done" };
};

const graph = new StateGraph(State)
  .addNode("my_node", myNode)
  .addEdge(START, "my_node")
  .addEdge("my_node", END)
  .compile();
```

#### Adjust behavior based on retry state

When a node has a retry policy, use `executionInfo` to inspect the current attempt number and switch to a fallback after the first attempt fails:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  result: z.string(),
});

const myNode: GraphNode<typeof State> = async (state, config) => {
  const attempt = config.executionInfo?.nodeAttempt ?? 1;
  if (attempt > 1) {  // [!code highlight]
    // use a fallback on retries
    return { result: await callFallbackApi() };
  }
  return { result: await callPrimaryApi() };
};

const graph = new StateGraph(State)
  .addNode("my_node", myNode, { retryPolicy: { maxAttempts: 3 } })
  .addEdge(START, "my_node")
  .addEdge("my_node", END)
  .compile();
```

`executionInfo` is set once the node task is prepared. Even without a retry policy, `nodeAttempt` defaults to `1`, and `nodeFirstAttemptTime` is set when the node starts executing.

## Access server info inside a node

When your graph runs on LangSmith Agent Server, you can access server-specific metadata via `config.serverInfo`.

| Attribute | Type | Description |
| - | - | - |
| `assistantId` | `string` | The assistant ID for the current deployment. |
| `graphId` | `string` | The graph ID for the current deployment. |
| `user` | `Record<string, unknown> \| undefined` | The authenticated user object, if [custom auth](/langsmith/custom-auth) is configured. |

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  result: z.string(),
});

const myNode: GraphNode<typeof State> = async (state, config) => {
  const server = config.serverInfo;
  if (server != null) {
    console.log(`Assistant: ${server.assistantId}, Graph: ${server.graphId}`);  // [!code highlight]
    if (server.user != null) {
      console.log(`User: ${JSON.stringify(server.user)}`);
    }
  }
  return { result: "done" };
};

const graph = new StateGraph(State)
  .addNode("my_node", myNode)
  .addEdge(START, "my_node")
  .addEdge("my_node", END)
  .compile();
```

`serverInfo` is `undefined` when the graph is not running on Agent Server.

> [!NOTE]
>
> Requires `@langchain/langgraph` v1.2.8 or later.

## Access drain state inside a node

When a [graceful shutdown](/oss/javascript/langgraph/fault-tolerance#graceful-shutdown) has been requested, `runtime.control?.drainRequested` is `true`. Read this inside a node to skip expensive work before the next superstep boundary:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, type Runtime } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  status: z.string(),
  reason: z.string().optional(),
});

const myNode = async (
  state: typeof State.State,
  runtime: Runtime<typeof State>
) => {
  if (runtime.control?.drainRequested) {  // [!code highlight]
    return { status: "skipped", reason: runtime.control.drainReason };
  }
  return { status: await doWork() };
};
```

| Property | Type | Description |
| - | - | - |
| `control.drainRequested` | `boolean` | `true` if drain has been requested for this run. |
| `control.drainReason` | `string \| undefined` | The reason string passed to `requestDrain`, if any. |

> [!NOTE]
>
> See [Graceful shutdown](/oss/javascript/langgraph/fault-tolerance#graceful-shutdown) for the full `RunControl` API.

## Add node caching

Use node caching when a step is expensive and you want to reuse results for the same input.

To enable caching:

1. Pass a cache when you compile the graph (for example, `InMemoryCache`). `SqliteCache` is also available in Python.
2. Attach a [`CachePolicy`](https://reference.langchain.com/javascript/langchain-langgraph/index/CachePolicy) on the node.

[`CachePolicy`](https://reference.langchain.com/javascript/langchain-langgraph/index/CachePolicy) options:

* **`keyFunc`**: Function that builds a cache key from the node input.
* **`ttl`**: Time to live in seconds. When omitted, the cache entry does not expire.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import { InMemoryCache } from "@langchain/langgraph-checkpoint";
import * as z from "zod";

const State = new StateSchema({
  x: z.number(),
  result: z.number(),
});

const expensiveNode: GraphNode<typeof State> = async (state) => {
  // Simulate an expensive operation
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { result: state.x * 2 };
};

const graph = new StateGraph(State)
  .addNode("expensive_node", expensiveNode, { cachePolicy: { ttl: 3 } })
  .addEdge(START, "expensive_node")
  .addEdge("expensive_node", END)
  .compile({ cache: new InMemoryCache() });

await graph.invoke({ x: 5 }, { streamMode: "updates" });  // [!code highlight]
// [{"expensive_node": {"result": 10}}]
await graph.invoke({ x: 5 }, { streamMode: "updates" });  // [!code highlight]
// [{"expensive_node": {"result": 10}, "__metadata__": {"cached": true}}]
```

You can also set `cachePolicy` (and other node options) once for the graph with `setNodeDefaults`. See [Set graph-wide node defaults](#set-graph-wide-node-defaults).

## See also

* [Graph API](/oss/javascript/langgraph/graph-api#nodes)
* [Control flow](/oss/javascript/langgraph/graph-api-control-flow)
* [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
* [Define and update state](/oss/javascript/langgraph/graph-api-state)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-nodes.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).