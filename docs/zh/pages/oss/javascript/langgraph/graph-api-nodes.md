<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Configure nodes | https://docs.langchain.com/oss/javascript/langgraph/graph-api-nodes -->

# 配置节点

添加运行时配置、重试策略、超时、错误处理、默认值和缓存到 LangGraph 节点。

[Nodes](/oss/javascript/langgraph/graph-api#nodes)是Graph API图的步骤。本页介绍了添加节点时如何附加运行时配置、重试、超时、错误处理程序、默认值和缓存。有关将节点连接到序列、分支和循环中的信息，请参阅[Control flow](/oss/javascript/langgraph/graph-api-control-flow)。有关完整的重试、超时和错误生命周期，请参阅[Fault tolerance](/oss/javascript/langgraph/fault-tolerance)。

## 添加运行时配置

将值传递到运行中（例如，LLM 或系统提示使用哪个），而不将这些值置于图形状态。

添加运行时配置：

1. 指定配置的架构
2. 将配置添加到节点或条件边的函数签名中
3. 将配置传递到图中

请参阅下面的简单示例：

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

> [accordion] 扩展示例：在运行时指定LLM
>
> 在调用时选择OpenAI 或Anthropic。这些示例调用实时提供程序并需要 API 密钥。
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
> ```> [accordion] 扩展示例：运行时指定模型和系统消息
>
> 在调用时配置模型提供者和系统消息。这些示例调用实时提供程序并需要 API 密钥。
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

## 添加重试策略

当节点调用可能暂时失败的 API、数据库或 LLM 时，附加重试策略。

通过`retryPolicy`到[⟦T17⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.Graph.html#addnode)。空对象使用内置默认值：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const builder = new StateGraph(State)
  .addNode("nodeName", nodeFunction, { retryPolicy: {} });
```

重试是可选的：如果没有`retryPolicy`，第一次失败就会结束尝试。如果策略忽略 `retryOn`，LangGraph 会重试抛出的错误，但以下情况除外：

* 中止和取消错误（`error.name === "AbortError"`或`error.message`以`"Cancel"`或`"AbortError"`开头）
* `GraphValueError`，与`error.name`匹配
* 中止连接 (`error.code === "ECONNABORTED"`)
* 状态为 400、401、402、403、404、405、406、407 或 409 的 HTTP 客户端错误
* OpenAI 式配额错误 (`error.error?.code === "insufficient_quota"`)

有关完整的默认列表和参数，请参阅[Fault tolerance](/oss/javascript/langgraph/fault-tolerance#retries)。

> [accordion]扩展示例：自定义重试策略
>
> 这些片段展示了如何附加不同的重试策略。他们不创建数据库表或调用图形。
>
> 将不同的重试策略传递给模型节点和 SQL 节点。该示例使用 Node.js 内置 `node:sqlite`（Node.js 22.5 或更高版本）：
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

## 设置节点超时> [!注意]
>
> 需要 `@langchain/langgraph` v1.4.0 或更高版本。

将 `timeout` 传递给 [⟦T31⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addNode) 以限制单个节点尝试可以运行的时间。使用数字（毫秒）或 [⟦T32⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/TimeoutPolicy) 来表示单独的运行和空闲限制：

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

当节点超过超时时，LangGraph引发[⟦T33⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/NodeTimeoutError)，清除失败尝试中的写入，并让重试策略决定是否重试。超时独立地应用于每次尝试。

请参阅 [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#timeouts) 了解完整的超时生命周期、空闲超时刷新源和心跳。

## 处理节点错误

> [!注意]
>
> 需要 `@langchain/langgraph` v1.4.0 或更高版本。

将 `errorHandler` 传递到 [⟦T37⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 上的 [⟦T36⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addNode)（不是基类 `Graph` 类）。处理程序在重试耗尽后运行，并且可以使用 [⟦T39⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 进行路由：

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

请参阅[Fault tolerance](/oss/javascript/langgraph/fault-tolerance#error-handling)了解补偿模式和`Command`布线。

## 设置图范围节点默认值

> [!注意]
>
> 需要 `@langchain/langgraph` v1.4.0 或更高版本。

使用 [⟦T42⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph#member-setNodeDefaults) 为图中的每个节点设置 `retryPolicy`、`timeout`、`cachePolicy` 或 `errorHandler` 一次，而不是在每个 `addNode` 调用中重复它们。每个节点的值总是获胜，并且默认值在编译时应用：

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
````retryPolicy` 和 `timeout` 默认值适用于每个节点，包括错误处理程序节点。 `cachePolicy` 和 `errorHandler` 默认值仅适用于常规节点。处理程序永远不会捕获自己，并且缓存处理程序结果是不安全的。子图不会继承默认值。

有关完整的优先级规则和适用性表，请参阅[Fault tolerance](/oss/javascript/langgraph/fault-tolerance#graph-defaults)。

## 访问节点内的执行信息

通过节点的第二个参数 (`LangGraphRunnableConfig`) 上的`config.executionInfo` 访问执行身份和重试信息。这会显示线程、运行和检查点标识符以及重试状态。

|属性|类型 |描述 |
| - | - | - |
| `threadId` | `string \| undefined` |当前执行的线程 ID。 |
| `runId` | `string \| undefined` |当前执行的运行 ID。 |
| `checkpointId` | `string` |当前执行的检查点 ID。 |
| `checkpointNs` | `string` |当前执行的检查点命名空间。 |
| `taskId` | `string` |当前执行的任务 ID。 |
| `nodeAttempt` | `number` |当前执行尝试次数（1 索引）。 |
| `nodeFirstAttemptTime` | `number \| undefined` |第一次尝试开始时的 Unix 时间戳（毫秒）。重试后保持不变。 |

#### 访问线程和运行 ID

使用 `executionInfo` 访问节点内的线程 ID、运行 ID 和其他身份字段：

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
```#### 根据重试状态调整行为

当节点有重试策略时，使用`executionInfo`检查当前的尝试次数，并在第一次尝试失败后切换到回退：

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

`executionInfo` 在节点任务准备好后设置。即使没有重试策略，`nodeAttempt`默认为`1`，并且`nodeFirstAttemptTime`在节点开始执行时设置。

## 访问节点内的服务器信息

当您的图表在LangSmith代理服务器上运行时，您可以通过`config.serverInfo`访问特定于服务器的元数据。

|属性|类型 |描述 |
| - | - | - |
| `assistantId` | `string` |当前部署的助手 ID。 |
| `graphId` | `string` |当前部署的图形 ID。 |
| `user` | `Record<string, unknown> \| undefined` |经过身份验证的用户对象（如果配置了[custom auth](/langsmith/custom-auth)）。 |

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

当图表未在代理服务器上运行时，`serverInfo` 为`undefined`。

> [!注意]
>
> 需要 `@langchain/langgraph` v1.2.8 或更高版本。

## 访问节点内的耗尽状态

当请求 [graceful shutdown](/oss/javascript/langgraph/fault-tolerance#graceful-shutdown) 时，`runtime.control?.drainRequested` 为 `true`。在节点内读取此内容以在下一个超级步边界之前跳过昂贵的工作：

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

|物业 |类型 |描述 |
| - | - | - |
| `control.drainRequested` | `boolean` | `true` 如果本次运行已请求排水。 |
| `control.drainReason` | `string \| undefined` |传递给 `requestDrain` 的原因字符串（如果有）。 |> [!注意]
>
> 请参阅 [Graceful shutdown](/oss/javascript/langgraph/fault-tolerance#graceful-shutdown) 了解完整的 `RunControl` API。

## 添加节点缓存

当步骤成本高昂并且您希望对同一输入重用结果时，请使用节点缓存。

要启用缓存：

1. 编译图时传递一个缓存（例如`InMemoryCache`）。 `SqliteCache` 也可以在 Python 中使用。
2. 在节点上附加[⟦T95⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/CachePolicy)。

[⟦T96⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/CachePolicy)选项：

* **`keyFunc`**：从节点输入构建缓存键的函数。
* **`ttl`**：以秒为单位的生存时间。当省略时，缓存条目不会过期。

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

您还可以使用 `setNodeDefaults` 为图形设置一次 `cachePolicy` （和其他节点选项）。参见[Set graph-wide node defaults](#set-graph-wide-node-defaults)。

## 另请参阅

* [Graph API](/oss/javascript/langgraph/graph-api#nodes)
* [Control flow](/oss/javascript/langgraph/graph-api-control-flow)
* [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
* [Define and update state](/oss/javascript/langgraph/graph-api-state)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-nodes.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。