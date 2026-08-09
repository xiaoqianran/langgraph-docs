<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Stores | https://docs.langchain.com/oss/python/langgraph/stores -->

# 商店

LangGraph 存储提供跨线程长期内存，补充了每线程检查点持久性。

存储让代理能够跨线程保存信息，包括用户偏好、积累的知识以及在一次对话之后仍能保存的事实。与[checkpointers](/oss/python/langgraph/checkpointers)不同的是，[checkpointers](/oss/python/langgraph/checkpointers)保存了一个线程范围内的完整图状态，存储保存了可从任何线程访问的任意键值数据。

<img alt="Model of shared state" />

<Info>
  **代理服务器自动处理存储**
  使用[Agent Server](/langsmith/agent-server)时，您不需要手动实现或配置存储。 API 在幕后为您处理所有存储基础设施。
</Info>

<Note>
  [InMemoryStore](https://reference.langchain.com/python/langchain-core/stores/InMemoryStore)适合开发和测试。对于生产，请使用持久存储，例如 `PostgresStore`、`MongoDBStore`、`RedisStore` 或 `UpstashStore`。所有实现都扩展[BaseStore](https://reference.langchain.com/python/langchain-core/stores/BaseStore)，这是在节点函数签名中使用的类型注释。
</Note>

<Note>
  有关可用提供商的完整列表，请参阅[store integrations](/oss/python/integrations/long-term-memory/index)。
</Note>

## 基本用法

以下代码片段在不使用 LangGraph 的情况下单独显示了 [InMemoryStore](https://reference.langchain.com/python/langchain-core/stores/InMemoryStore)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.store.memory import InMemoryStore
store = InMemoryStore()
```内存由 `tuple` 命名，在以下示例中为 `(<user_id>, "memories")`。命名空间可以是任意长度并代表任何内容，不必是特定于用户的。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
user_id = "1"
namespace_for_memory = (user_id, "memories")
```

使用`store.put`方法将内存保存到store中的命名空间中。指定上面定义的命名空间，以及内存的键值对：键只是内存的唯一标识符（`memory_id`），值（字典）是内存本身。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
memory_id = str(uuid.uuid4())
memory = {"food_preference" : "I like pizza"}
store.put(namespace_for_memory, memory_id, memory)
```

使用 `store.search` 方法从命名空间中读出内存，该方法以列表的形式返回给定用户的内存，直到 `limit` 参数（默认为 `10`）。对于`InMemoryStore`，项目按插入顺序返回，因此最近的内存位于列表的最后；其他后端可能会以不同的方式对内存进行排序（请参阅[Listing items in a namespace](#listing-items-in-a-namespace)）。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
memories = store.search(namespace_for_memory)
memories[-1].dict()
{'value': {'food_preference': 'I like pizza'},
 'key': '07e0caf4-1631-47b7-b15f-65515d4c1843',
 'namespace': ['1', 'memories'],
 'created_at': '2024-10-02T17:22:31.590602+00:00',
 'updated_at': '2024-10-02T17:22:31.590605+00:00'}
```

每个内存类型都是一个具有某些属性的 Python 类 ([⟦T32⟧](https://langchain-ai.github.io/langgraph/reference/store/#langgraph.store.base.Item))。我们可以通过使用 `.dict` 进行转换来将其作为字典来访问。

它所具有的属性有：

* `value`：这块内存的值（本身就是一个字典）

* `key`：该内存在该命名空间中的唯一键

* `namespace`：字符串元组，该内存类型的命名空间<Note>
    虽然类型为`tuple[str, ...]`，但转换为 JSON 时可能会序列化为列表（例如，`['1', 'memories']`）。
  </Note>

* `created_at`：创建该内存的时间戳

* `updated_at`：此内存更新的时间戳

## 列出命名空间中的项目

在没有 `query` 和没有 `filter` 的情况下调用 [⟦T41⟧](https://reference.langchain.com/python/langgraph/store/#langgraph.store.base.BaseStore.search)（或异步 [⟦T42⟧](https://reference.langchain.com/python/langgraph/store/#langgraph.store.base.BaseStore.asearch)）会返回存储在 `namespace_prefix` 下的项目，最多为 `limit`。当您不需要语义排名时，可以使用它来枚举命名空间中的所有内容。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Return up to 100 items stored under ("alice", "memories").
items = store.search(("alice", "memories"), limit=100)
```

需要牢记的三种行为：

* **`namespace_prefix` 按前缀匹配，但不完全匹配。** `("alice",)` 还会返回 `("alice", "memories")`、`("alice", "preferences")` 等下的项目。要限制为单个级别，请传递完整的命名空间或在 `item.namespace` 上过滤客户端返回的项目。
* **超过 `limit` 的结果将被静默截断。** 没有溢出信号 - 将 `limit` 设置为高于预期最大值，或使用 `offset` 进行分页。
* **默认排序取决于商店后端。** `PostgresStore` 和 `AsyncPostgresStore` 返回按 `updated_at` 降序排序的结果（最近更新的最先）。 `InMemoryStore` 按插入顺序返回结果（最近插入的最后一个）。不要依赖跨实现的特定顺序；如果顺序很重要，请在`item.updated_at`上对客户端进行排序。要对大型名称空间进行分页：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
page_size = 50
offset = 0
while True:
    page = store.search(("alice", "memories"), limit=page_size, offset=offset)
    if not page:
        break
    for item in page:
        pass
    offset += page_size
```

要发现存在哪些命名空间（例如，在列出用户的记忆之前迭代每个用户），请使用 [⟦T60⟧](https://reference.langchain.com/python/langgraph/store/#langgraph.store.base.BaseStore.list_namespaces) 或 [⟦T61⟧](https://reference.langchain.com/python/langgraph/store/#langgraph.store.base.BaseStore.alist_namespaces)：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# All namespaces that start with ("alice",), truncated to two levels deep.
namespaces = store.list_namespaces(prefix=("alice",), max_depth=2)
```

## 语义搜索

除了简单的检索之外，该商店还支持语义搜索，让您可以根据含义而不是精确匹配来查找记忆。要启用此功能，请使用嵌入模型配置商店：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.embeddings import init_embeddings

store = InMemoryStore(
    index={
        "embed": init_embeddings("openai:text-embedding-3-small"),  # Embedding provider
        "dims": 1536,                              # Embedding dimensions
        "fields": ["food_preference", "$"]              # Fields to embed
    }
)
```

现在搜索时，您可以使用自然语言查询来查找相关记忆：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Find memories about food preferences
# (This can be done after putting memories into the store)
memories = store.search(
    namespace_for_memory,
    query="What does the user like to eat?",
    limit=3  # Return top 3 matches
)
```

您可以通过配置 `fields` 参数或在存储内存时指定 `index` 参数来控制嵌入内存的哪些部分：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Store with specific fields to embed
store.put(
    namespace_for_memory,
    str(uuid.uuid4()),
    {
        "food_preference": "I love Italian cuisine",
        "context": "Discussing dinner plans"
    },
    index=["food_preference"]  # Only embed "food_preferences" field
)

# Store without embedding (still retrievable, but not searchable)
store.put(
    namespace_for_memory,
    str(uuid.uuid4()),
    {"system_info": "Last updated: 2024-01-01"},
    index=False
)
```

## 在 LangGraph 中使用

存储与检查指针携手合作：如上所述，检查指针将状态保存到线程，并且存储允许您存储任意信息以供*跨*线程访问。使用检查指针和存储编译图形，如下所示。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from dataclasses import dataclass
from langgraph.checkpoint.memory import InMemorySaver

@dataclass
class Context:
    user_id: str

# We need this because we want to enable threads (conversations)
checkpointer = InMemorySaver()

# ... Define the graph ...

# Compile the graph with the checkpointer and store
builder = StateGraph(MessagesState, context_schema=Context)
# ... add nodes and edges ...
graph = builder.compile(checkpointer=checkpointer, store=store)
```

然后像以前一样使用 `thread_id` 调用该图，并使用 `user_id` 来调用该图，它像以前一样充当该特定用户的内存命名空间。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Invoke the graph
config = {"configurable": {"thread_id": "1"}}

# First let's just say hi to the AI
for update in graph.stream(
    {"messages": [{"role": "user", "content": "hi"}]},
    config,
    stream_mode="updates",
    context=Context(user_id="1"),
):
    print(update)
```您可以使用 `Runtime` 对象从*任何节点*访问存储和 `user_id`。当您将 `Runtime` 作为参数添加到节点函数时，LangGraph 会自动注入它。您可以用它来保存记忆：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.runtime import Runtime
from dataclasses import dataclass

@dataclass
class Context:
    user_id: str

async def update_memory(state: MessagesState, runtime: Runtime[Context]):

    # Get the user id from the runtime context
    user_id = runtime.context.user_id

    # Namespace the memory
    namespace = (user_id, "memories")

    # ... Analyze conversation and create a new memory

    # Create a new memory ID
    memory_id = str(uuid.uuid4())

    # We create a new memory
    await runtime.store.aput(namespace, memory_id, {"memory": memory})

```

您还可以从任何节点访问存储并使用`store.search`方法获取记忆。内存以可以转换为字典的对象列表的形式返回。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
memories[-1].dict()
{'value': {'food_preference': 'I like pizza'},
 'key': '07e0caf4-1631-47b7-b15f-65515d4c1843',
 'namespace': ['1', 'memories'],
 'created_at': '2024-10-02T17:22:31.590602+00:00',
 'updated_at': '2024-10-02T17:22:31.590605+00:00'}
```

您可以访问内存并在模型调用中使用它们。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from dataclasses import dataclass
from langgraph.runtime import Runtime

@dataclass
class Context:
    user_id: str

async def call_model(state: MessagesState, runtime: Runtime[Context]):
    # Get the user id from the runtime context
    user_id = runtime.context.user_id

    # Namespace the memory
    namespace = (user_id, "memories")

    # Search based on the most recent message
    memories = await runtime.store.asearch(
        namespace,
        query=state["messages"][-1].content,
        limit=3
    )
    info = "\n".join([d.value["memory"] for d in memories])

    # ... Use memories in the model call
```

如果你创建一个新线程，只要`user_id`相同，你仍然可以访问相同的内存。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Invoke the graph on a new thread
config = {"configurable": {"thread_id": "2"}}

# Let's say hi again
for update in graph.stream(
    {"messages": [{"role": "user", "content": "hi, tell me about my memories"}]},
    config,
    stream_mode="updates",
    context=Context(user_id="1"),
):
    print(update)
```

当您在本地使用 LangSmith 时（例如，在[Studio](/langsmith/studio)）或[hosted](/langsmith/platform-setup)中，默认情况下可以使用基本存储，并且不需要在图形编译期间指定它。但是，要启用语义搜索，您**确实**需要在 `langgraph.json` 文件中配置索引设置。例如：

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

## 建立一个自定义商店

要使用内置实现之外的存储后端，请子类 [BaseStore](https://reference.langchain.com/python/langchain-core/stores/BaseStore) 并实现其所需的方法。内置的[InMemoryStore](https://reference.langchain.com/python/langchain-core/stores/InMemoryStore)是最简单的参考实现。

### 基础合约所有五个异步方法都是必需的。同步对应项（`put`、`get`、`delete`、`search`、`list_namespaces`）是可选的，但建议使用以与同步图执行兼容。

|方法|描述 |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `aput(namespace, key, value, index=None)` |存储或覆盖单个项目 |
| `aget(namespace, key)` |通过键检索单个项目；如果缺失则返回`None` |
| `adelete(namespace, key)` |删除单个项目 |
| `asearch(namespace_prefix, *, query=None, filter=None, limit=10, offset=0)` |搜索命名空间前缀下的项目；可选地通过语义查询 |
| `alist_namespaces(*, prefix=None, suffix=None, max_depth=None, limit=100, offset=0)` |列出与前缀/后缀模式匹配的命名空间 |

在实施之前查找确切的签名：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import inspect
from langgraph.store.base import BaseStore
print(inspect.getsource(BaseStore))
```

### 命名空间设计命名空间是字符串的元组，例如`("user_id", "memories")`。商店实施必须支持：

* **前缀匹配**： `asearch(("alice",))` 返回 `("alice",)`、`("alice", "memories")` 和任何其他子命名空间下的项目。
* **精确键查找**：`aget(("alice", "memories"), "some-key")` 必须是 O(1) 或接近它。

对于 SQL 后端，通用架构：

```sql theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
CREATE TABLE store_items (
    namespace   TEXT[] NOT NULL,
    key         TEXT NOT NULL,
    value       JSONB NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (namespace, key)
);

CREATE INDEX ON store_items USING gin(namespace);
```

### 序列化

存储值是普通的 Python 字典——不需要特殊的序列化器。直接使用 `json.dumps` / `json.loads` 或 JSONB 列进行序列化。不要存储不可 JSON 序列化的原始 Python 对象。

### 语义搜索支持

如果您的后端支持矢量搜索，请在 `asearch` 上实现 `query` 参数：

* 接受`query: str | None` 参数。
* 当`query`不是`None`时，将其嵌入并按余弦相似度对结果进行排名。
* 当提供 `query` 时，结果应在每个 `Item` 上包含 `score` 字段。

如果您的后端不支持向量搜索，请在传递 `query` 时引发 `NotImplementedError`。

### 测试

目前没有适用于定制商店的一致性套件。以[InMemoryStore](https://reference.langchain.com/python/langchain-core/stores/InMemoryStore)为参考进行测试：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import pytest
from langgraph.store.memory import InMemoryStore
from your_module import YourStore

@pytest.fixture
async def store():
    async with YourStore.create() as s:
        yield s

@pytest.fixture
def reference():
    return InMemoryStore()

async def test_put_and_get(store, reference):
    ns = ("test", "ns")
    for s in [store, reference]:
        await s.aput(ns, "k1", {"val": 1})
        item = await s.aget(ns, "k1")
        assert item is not None
        assert item.value == {"val": 1}

async def test_delete(store, reference):
    ns = ("test", "ns")
    for s in [store, reference]:
        await s.aput(ns, "k1", {"val": 1})
        await s.adelete(ns, "k1")
        assert await s.aget(ns, "k1") is None

async def test_search_prefix(store, reference):
    for s in [store, reference]:
        await s.aput(("user", "memories"), "m1", {"text": "likes pizza"})
        results = await s.asearch(("user",))
        assert any(r.key == "m1" for r in results)
```

### 后续步骤

* [Add a custom store to Agent Server](/langsmith/custom-store) — 部署您的实现
* [Checkpointers](/oss/python/langgraph/checkpointers) — 线程范围的状态持久化

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout><Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/stores.mdx) 或[file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>