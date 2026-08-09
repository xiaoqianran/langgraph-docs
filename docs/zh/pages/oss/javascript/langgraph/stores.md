<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Stores | https://docs.langchain.com/oss/javascript/langgraph/stores -->

# 商店

LangGraph 存储提供跨线程长期内存，补充了每线程检查点持久性。

存储让代理能够跨线程保存信息，包括用户偏好、积累的知识以及在一次对话之后仍能保存的事实。与 [checkpointers](/oss/javascript/langgraph/checkpointers) 不同的是，[checkpointers](/oss/javascript/langgraph/checkpointers) 保存了一个线程范围内的完整图状态，存储保存了可从任何线程访问的任意键值数据。

<img alt="Model of shared state" />

<Info>
  **代理服务器自动处理存储**
  使用[Agent Server](/langsmith/agent-server)时，您不需要手动实现或配置存储。 API 在幕后为您处理所有存储基础设施。
</Info>

<Note>
  [InMemoryStore](https://reference.langchain.com/javascript/langchain-core/stores/InMemoryStore)适合开发和测试。对于生产，请使用持久存储，例如 `PostgresStore`、`MongoDBStore`、`RedisStore` 或 `UpstashStore`。所有实现都扩展[BaseStore](https://reference.langchain.com/javascript/langchain-core/stores/BaseStore)，这是在节点函数签名中使用的类型注释。
</Note>

## 基本用法

以下代码片段在不使用 LangGraph 的情况下单独显示了 [InMemoryStore](https://reference.langchain.com/javascript/langchain-core/stores/InMemoryStore)：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemoryStore } from "@langchain/langgraph";

const memoryStore = new MemoryStore();
```

内存由 `tuple` 命名，在以下示例中为 `(<user_id>, "memories")`。命名空间可以是任意长度并代表任何内容，不必是特定于用户的。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const userId = "1";
const namespaceForMemory = [userId, "memories"];
```使用`store.put`方法将内存保存到store中的命名空间中。指定上面定义的命名空间，以及内存的键值对：键只是内存的唯一标识符（`memory_id`），值（字典）是内存本身。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const memoryId = crypto.randomUUID();
const memory = { food_preference: "I like pizza" };
await memoryStore.put(namespaceForMemory, memoryId, memory);
```

使用 `store.search` 方法从命名空间中读出内存，该方法以列表的形式返回给定用户的内存，直到 `limit` 参数（默认为 `10`）。对于`InMemoryStore`，项目按插入顺序返回，因此最近的内存位于列表的最后；其他后端可能会以不同的方式对内存进行排序（请参阅[Listing items in a namespace](#listing-items-in-a-namespace)）。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const memories = await memoryStore.search(namespaceForMemory);
memories[memories.length - 1];

// {
//   value: { food_preference: 'I like pizza' },
//   key: '07e0caf4-1631-47b7-b15f-65515d4c1843',
//   namespace: ['1', 'memories'],
//   createdAt: '2024-10-02T17:22:31.590602+00:00',
//   updatedAt: '2024-10-02T17:22:31.590605+00:00'
// }
```

它所具有的属性有：

* `value`：该内存的值

* `key`：该内存在该命名空间中的唯一键

* `namespace`：字符串元组，该内存类型的命名空间

  <Note>
    虽然类型为`tuple`，但转换为 JSON 时可能会序列化为列表（例如，`['1', 'memories']`）。
  </Note>

* `createdAt`：创建该内存的时间戳

* `updatedAt`：此内存更新的时间戳

## 列出命名空间中的项目在没有 `query` 和 `filter` 的情况下调用 `store.search` 将返回存储在命名空间前缀下的项目，直到 `limit`。当您不需要语义排名时，可以使用它来枚举命名空间中的所有内容。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Return up to 100 items stored under ["alice", "memories"].
const items = await store.search(["alice", "memories"], { limit: 100 });
```

需要牢记的三种行为：

* **`namespace_prefix` 按前缀匹配，但不完全匹配。** `("alice",)` 还会返回 `("alice", "memories")`、`("alice", "preferences")` 等下的项目。要限制为单个级别，请传递完整的命名空间或在 `item.namespace` 上过滤客户端返回的项目。
* **超过 `limit` 的结果将被静默截断。** 没有溢出信号 - 将 `limit` 设置为高于预期最大值，或使用 `offset` 进行分页。
* **默认排序取决于商店后端。** `PostgresStore` 和 `AsyncPostgresStore` 返回按 `updated_at` 降序排序的结果（最近更新的最先）。 `InMemoryStore` 按插入顺序返回结果（最近插入的最后一个）。不要依赖跨实现的特定顺序；如果顺序很重要，请在`item.updated_at`上对客户端进行排序。

要对大型名称空间进行分页：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const pageSize = 50;
let offset = 0;
while (true) {
  const page = await store.search(["alice", "memories"], { limit: pageSize, offset });
  if (page.length === 0) break;
  for (const item of page) {
    // ...
  }
  offset += pageSize;
}
```

要发现存在哪些命名空间（例如，在列出每个用户的记忆之前迭代每个用户），请使用 `store.listNamespaces`：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// All namespaces that start with ["alice"], truncated to two levels deep.
const namespaces = await store.listNamespaces({ prefix: ["alice"], maxDepth: 2 });
```

## 语义搜索除了简单的检索之外，该商店还支持语义搜索，让您可以根据含义而不是精确匹配来查找记忆。要启用此功能，请使用嵌入模型配置商店：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { OpenAIEmbeddings } from "@langchain/openai";

const store = new InMemoryStore({
  index: {
    embeddings: new OpenAIEmbeddings({ model: "text-embedding-3-small" }),
    dims: 1536,
    fields: ["food_preference", "$"], // Fields to embed
  },
});
```

现在搜索时，您可以使用自然语言查询来查找相关记忆：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Find memories about food preferences
// (This can be done after putting memories into the store)
const memories = await store.search(namespaceForMemory, {
  query: "What does the user like to eat?",
  limit: 3, // Return top 3 matches
});
```

您可以通过配置 `fields` 参数或在存储内存时指定 `index` 参数来控制嵌入内存的哪些部分：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Store with specific fields to embed
await store.put(
  namespaceForMemory,
  crypto.randomUUID(),
  {
    food_preference: "I love Italian cuisine",
    context: "Discussing dinner plans",
  },
  { index: ["food_preference"] } // Only embed "food_preferences" field
);

// Store without embedding (still retrievable, but not searchable)
await store.put(
  namespaceForMemory,
  crypto.randomUUID(),
  { system_info: "Last updated: 2024-01-01" },
  { index: false }
);
```

## 在 LangGraph 中使用

`memoryStore` 与检查指针协同工作：如上所述，检查指针将状态保存到线程，而 `memoryStore` 允许您存储任意信息以便*跨*线程访问。使用检查点和 `memoryStore` 编译图表，如下所示。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver } from "@langchain/langgraph";

// We need this because we want to enable threads (conversations)
const checkpointer = new MemorySaver();

// ... Define the graph ...

// Compile the graph with the checkpointer and store
const graph = workflow.compile({ checkpointer, store: memoryStore });
```

然后像以前一样使用 `thread_id` 调用该图，并使用 `user_id` 来调用该图，它像以前一样充当该特定用户的内存命名空间。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Invoke the graph
const userId = "1";
const config = { configurable: { thread_id: "1" }, context: { userId } };

// First let's just say hi to the AI
for await (const update of await graph.stream(
  { messages: [{ role: "user", content: "hi" }] },
  { ...config, streamMode: "updates" }
)) {
  console.log(update);
}
```

您可以使用 `runtime` 参数从*任何节点*访问存储和 `userId`。您可以用它来保存记忆：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue, Runtime } from "@langchain/langgraph";

const MessagesState = new StateSchema({
  messages: MessagesValue,
});

const updateMemory: GraphNode<typeof MessagesState> = async (state, runtime) => {
  // Get the user id from the config
  const userId = runtime.context?.user_id;
  if (!userId) throw new Error("User ID is required");

  // Namespace the memory
  const namespace = [userId, "memories"];

  // ... Analyze conversation and create a new memory
  const memory = "Some memory content";

  // Create a new memory ID
  const memoryId = crypto.randomUUID();

  // We create a new memory
  await runtime.store?.put(namespace, memoryId, { memory });
};
```您还可以从任何节点访问存储并使用`store.search`方法获取内存。内存以可以转换为字典的对象列表的形式返回。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
memories[memories.length - 1];
// {
//   value: { food_preference: 'I like pizza' },
//   key: '07e0caf4-1631-47b7-b15f-65515d4c1843',
//   namespace: ['1', 'memories'],
//   createdAt: '2024-10-02T17:22:31.590602+00:00',
//   updatedAt: '2024-10-02T17:22:31.590605+00:00'
// }
```

您可以访问内存并在模型调用中使用它们。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const callModel: GraphNode<typeof MessagesState> = async (state, runtime) => {
  // Get the user id from the config
  const userId = runtime.context?.user_id;

  // Namespace the memory
  const namespace = [userId, "memories"];

  // Search based on the most recent message
  const memories = await runtime.store?.search(namespace, {
    query: state.messages[state.messages.length - 1].content,
    limit: 3,
  });
  const info = memories.map((d) => d.value.memory).join("\n");

  // ... Use memories in the model call
};
```

如果你创建一个新线程，只要`user_id`相同，你仍然可以访问相同的内存。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Invoke the graph
const config = { configurable: { thread_id: "2" }, context: { userId: "1" } };

// Let's say hi again
for await (const update of await graph.stream(
  { messages: [{ role: "user", content: "hi, tell me about my memories" }] },
  { ...config, streamMode: "updates" }
)) {
  console.log(update);
}
```

当您在本地使用 LangSmith 时（例如，在[Studio](/langsmith/studio)）或[hosted](/langsmith/platform-setup)中，默认情况下可以使用基本存储，并且您不需要在图形编译期间指定它。但是，要启用语义搜索，您**确实**需要在 `langgraph.json` 文件中配置索引设置。例如：

```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
{
    ...
    "store": {
        "index": {
            "embed": "openai:text-embeddings-3-small",
            "dims": 1536,
            "fields": ["$"]
        }
    }
}
```

有关更多详细信息和配置选项，请参阅[deployment guide](/langsmith/semantic-search)。

### 后续步骤

* [Add a custom store to Agent Server](/langsmith/custom-store) — 部署您的实现
* [Checkpointers](/oss/javascript/langgraph/checkpointers) — 线程范围的状态持久化

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/stores.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>