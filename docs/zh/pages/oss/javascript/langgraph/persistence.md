<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Persistence | https://docs.langchain.com/oss/javascript/langgraph/persistence -->

# 坚持

LangGraph 的持久层通过检查点为代理提供短期记忆，通过存储为代理提供长期记忆。

<a />

<a />

<a />

<a />

<a />

<a />

持久性使 LangGraph 应用程序可以在单个图形运行之外保留有用的信息。当代理需要继续对话、中断后恢复、从故障中恢复或记住交互过程中的信息时，这一点很重要。

LangGraph 提供了两个互补的持久化系统：

* **[Checkpointers](/oss/javascript/langgraph/checkpointers)** 将线程的图形状态保留为检查点。将它们用于短期、线程范围的记忆，包括对话连续性、人机交互工作流程、时间旅行和容错。
* **[Stores](/oss/javascript/langgraph/stores)** 在图状态之外保留应用程序定义的数据。将它们用于长期、跨线程记忆，包括用户偏好、事实和共享知识。

大多数应用程序都可以使用两者：[checkpointer](/oss/javascript/langgraph/checkpointers) 跟踪当前线程，[store](/oss/javascript/langgraph/stores) 跟踪跨线程的持久信息。

## 快速入门

使用检查点、存储或两者来编译图表：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { MemorySaver, MemoryStore } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const store = new MemoryStore();

const graph = builder.compile({ checkpointer, store });

const result = await graph.invoke(
  { messages: [{ role: "user", content: "Hi, my name is Bob." }] },
  { configurable: { thread_id: "thread-1" } }
);
```<Info>
  **代理服务器自动处理持久性**
  使用[Agent Server](/langsmith/agent-server)时，您不需要手动实现或配置检查点或存储。服务器在幕后处理持久性基础设施。
</Info>

## 检查点与存储

|                |检查点 |商店 |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------- |
|坚持 |图状态快照 |应用程序定义的键值数据 |
|范围 |单线程 |跨线程|
|内存类型|短期、线程范围内存 |长期、跨线程内存|
|用于 |对话连续性、人机交互、时间旅行和容错 |用户偏好、事实和共享知识 ||访问模式|在图形配置中传递 `thread_id` |从节点或应用程序代码读取和写入项目 |
|完整指南 | [Checkpointers](/oss/javascript/langgraph/checkpointers) | [Stores](/oss/javascript/langgraph/stores) |

## 常见问题疑难解答

### PostgresSaver：`thread_id`太长

当使用`PostgresSaver`（或`AsyncPostgresSaver`）时，`thread_id`存储在长度有限的列中。如果您的 `thread_id` 超过列大小，您将看到数据库错误。

**修复：** 将 `thread_id` 值保持在 255 个字符以下。如果需要确定性 ID，请使用 UUID 或哈希：

### `MemorySaver` 在重新启动之间不会持续存在

`MemorySaver`和`InMemorySaver`将检查点存储在RAM中。当进程重新启动时，所有检查点都会丢失。

**修复：** 使用持久检查点进行生产：

* `PostgresSaver`：具有异步支持的 PostgreSQL
* `SqliteSaver`：用于开发的基于本地文件的存储

### 检查点无限增长

经过长时间的对话，检查点会不断累积。这会增加延迟和存储成本。

**修复：** 定期修剪旧检查点或设置保留策略：

### 从父图到子图的状态访问当子图更新状态时，父图可能不会立即看到更改。这是因为每个子图管理自己的检查点名称空间。

**修复：** 对于需要跨越图边界的数据使用[shared state via Store](/oss/javascript/langgraph/stores)，或者配置子图以写入父检查点。

## 后续步骤

* [Use checkpointers](/oss/javascript/langgraph/checkpointers) 保存并检查线程状态。
* [Use stores](/oss/javascript/langgraph/stores) 跨线程持久保存数据。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/persistence.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>