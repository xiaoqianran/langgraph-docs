<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: What's new in LangGraph v1 | https://docs.langchain.com/oss/javascript/releases/langgraph-v1 -->

# LangGraph v1 中的新功能

**LangGraph v1 是一个注重稳定性的代理运行时版本。** 它保持核心图形 API 和执行模型不变，同时改进类型安全、文档和开发人员人体工程学。

它旨在与 [LangChain v1](/oss/javascript/releases/langchain-v1)（其 `createAgent` 基于 LangGraph 构建）携手合作，因此您可以从高层开始，并在需要时下降到精细控制。

<CardGroup>
  <Card title="Stable core APIs" icon="sitemap">
    图基元（状态、节点、边）和执行/运行时模型保持不变，使升级变得简单。
  </Card>

  <Card title="Reliability, by default" icon="database">
    具有检查点、持久性、流式传输和人机交互的持久执行仍然是一流的。
  </Card>

  <Card title="Seamless with LangChain v1" icon="link">
    LangChain的`createAgent`运行在LangGraph上。使用浪链快速启动；拖放到 LangGraph 进行自定义编排。
  </Card>
</CardGroup>

要升级，

<CodeGroup>
  ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm install @langchain/langgraph @langchain/core
  ```

  ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pnpm add @langchain/langgraph @langchain/core
  ```

  ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  yarn add @langchain/langgraph @langchain/core
  ```

  ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  bun add @langchain/langgraph @langchain/core
  ```
</CodeGroup>

有关更改的完整列表，请参阅 [migration guide](/oss/javascript/migrate/langgraph-v1)。

## `createReactAgent` 弃用

预构建的 LangGraph `createReactAgent` 已被弃用，取而代之的是 LangChain 的 `createAgent`。它提供了更简单的界面，并通过引入中间件提供了更大的定制潜力。* 有关新 `createAgent` API 的信息，请参阅 [LangChain v1 release notes](/oss/javascript/releases/langchain-v1#createagent)。
* 有关从 `createReactAgent` 迁移到 `createAgent` 的信息，请参阅 [LangChain v1 migration guide](/oss/javascript/migrate/langchain-v1#createagent)。

## 类型中断

[⟦T14⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 现在在构造函数中接受中断类型映射，以更严格地限制可在图中使用的中断类型。

```typescript expandable theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, MemorySaver, interrupt } from "@langchain/langgraph";
import * as z from "zod";

const stateSchema = z.object({
  foo: z.string(),
})

const graphConfig = {
  interrupts: {
    // Define a simple interrupt that accepts a reason and returns messages
    simple: interrupt<{ reason: string }, { messages: string[] }>, // [!code highlight]
    // Define a complex interrupt with the same signature
    complex: interrupt<{ reason: string }, { messages: string[] }>, // [!code highlight]
  }
}

const checkpointer = new MemorySaver();

const graph = new StateGraph(stateSchema, graphConfig)
  .addNode("node", async (state, runtime) => {
    // Trigger the simple interrupt with a reason
    const response = runtime.interrupt.simple({ reason: "test" });
    // Return the interrupt response as the new state
    return { foo: response };
  })
  // Compile the graph with the checkpointer
  .compile({ checkpointer });

// Invoke the graph with initial state
const result = await graph.invoke({ foo: "test" });

// Access the interrupt data
if (graph.isInterrupted(result)) {
  console.log(result.__interrupt__.messages);
}
```

有关中断的更多信息，请参阅 [Interrupts](/oss/javascript/langgraph/interrupts) 文档。

## 前端 SDK 增强

从前端与 LangGraph 应用程序交互时，LangGraph v1 提供了一些增强功能。

### 事件流编码

低级 `toLangGraphEventStream` 助手已被删除。流式响应现在由 SDK 本机处理，您可以通过将 `encoding` 格式传递到 `graph.stream` 来选择有线格式。这使得 SSE 和普通 JSON 响应之间的切换变得简单，无需更改 UI 逻辑。

请参阅[migration guide](/oss/javascript/migrate/langgraph-v1#event-stream-encoding)了解更多信息。

### `useStream` 的自定义运输

React `useStream` 钩子现在支持可插拔传输，因此您可以在不更改 UI 代码的情况下对网络层进行更多控制。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const stream = useStream({
  transport: new FetchStreamTransport({
    apiUrl: "http://localhost:2024",
  }),
});
```

了解如何集成和定制钩子：[Integrate LangGraph into your React application](/oss/javascript/langgraph/ui)。

## 报告问题

请使用 [⟦T20⟧ label](https://github.com/langchain-ai/langgraphjs/issues?q=state%3Aopen%20label%3Av1) 在 [GitHub](https://github.com/langchain-ai/langgraphjs/issues) 报告 1.0 中发现的任何问题。

## 其他资源<CardGroup>
  <Card title="LangGraph 1.0" icon="rocket" href="https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/">
    阅读公告
  </Card>

  <Card title="Overview" icon="book" href="/oss/javascript/langgraph/overview">
    LangGraph 是什么以及何时使用它
  </Card>

  <Card title="Graph API" icon="sitemap" href="/oss/javascript/langgraph/graph-api">
    使用状态、节点和边构建图
  </Card>

  <Card title="LangChain Agents" icon="robot" href="/oss/javascript/langchain/agents">
    基于 LangGraph 构建的高级代理
  </Card>

  <Card title="Migration guide" icon="arrows-exchange" href="/oss/javascript/migrate/langgraph-v1">
    如何迁移到 LangGraph v1
  </Card>

  <Card title="GitHub" icon="brand-github" href="https://github.com/langchain-ai/langgraphjs">
    报告问题或贡献
  </Card>
</CardGroup>

## 另请参阅

* [Versioning](/oss/javascript/versioning) – 了解版本号
* [Release policy](/oss/javascript/release-policy) – 详细发布政策

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/javascript/releases/langgraph-v1.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>