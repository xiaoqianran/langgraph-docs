<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph v1 migration guide | https://docs.langchain.com/oss/javascript/migrate/langgraph-v1 -->

# LangGraph v1 迁移指南

本指南概述了 LangGraph v1 中的更改以及如何从以前的版本迁移。有关新功能的高级概述，请参阅 [release notes](/oss/javascript/releases/langgraph-v1)。

要升级，

<CodeGroup>
  ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm install @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pnpm add @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  yarn add @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  bun add @langchain/langgraph@latest @langchain/core@latest
  ```
</CodeGroup>

## 变更摘要

|面积 |发生了什么变化|
| -------------------------------- | ---------------------------------------------------------------------- |
|反应预建 | `createReactAgent` 已弃用；使用浪链`createAgent` |
|中断 |通过 `interrupts` 配置支持类型化中断 |
| `toLangGraphEventStream` 已删除 |将 `graph.stream` 与所需的 `encoding` 格式结合使用 |
| `useStream` |支持自定义传输 |

***

## 弃用：`createReactAgent` → `createAgent`

LangGraph v1 弃用了预构建的 `createReactAgent`。使用LangChain的`createAgent`，它运行在LangGraph上并添加了灵活的中间件系统。

详情请参阅 LangChain v1 文档：

* [Release notes](/oss/javascript/releases/langchain-v1#createagent)
* [Migration guide](/oss/javascript/migrate/langchain-v1#createagent)

<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { createAgent } from "langchain";

  const agent = createAgent({
    model,
    tools,
    systemPrompt: "You are a helpful assistant.", // [!code highlight]
  });
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { createReactAgent } from "@langchain/langgraph/prebuilts";

  const agent = createReactAgent({
    model,
    tools,
    prompt: "You are a helpful assistant.", // [!code highlight]
  });
  ```
</CodeGroup>

***

## 类型中断

您现在可以在图形构造时定义中断类型，以严格键入传递到中断和从中断接收的值。<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { StateGraph, interrupt } from "@langchain/langgraph";
  import * as z from "zod";

  const State = z.object({ foo: z.string() });

  const graphConfig = {
    interrupts: {
      approve: interrupt<{ reason: string }, { messages: string[] }>(),
    },
  }

  const graph = new StateGraph(State, graphConfig)
    .addNode("node", async (state, runtime) => {
      const value = runtime.interrupt.approve({ reason: "review" }); // [!code highlight]
      return { foo: value };
    })
    .compile();
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { StateGraph } from "@langchain/langgraph";

  const graph = new StateGraph(State)
    .addNode("node", async (state, runtime) => {
      const value = runtime.interrupt.approve({ reason: "review" }); // [!code highlight]
      return state;
    })
    .compile();
  ```
</CodeGroup>

请参阅[Interrupts](/oss/javascript/langgraph/interrupts)了解更多信息。

***

## 事件流编码

低级 `toLangGraphEventStream` 助手已被删除。流式响应由 SDK 处理；使用低级客户端时，通过传递给 `graph.stream` 的 `encoding` 选项选择有线格式。

<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const stream = await graph.stream(input, {
    encoding: "text/event-stream",
    streamMode: ["values", "messages"],
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" }, // [!code highlight]
  });
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  return toLangGraphEventStreamResponse({
    stream: graph.streamEvents(input, {
      version: "v2",
      streamMode: ["values", "messages"],
    }),
  });
  ```
</CodeGroup>

***

## 重大变更

### 删除了 Node 18 支持

所有 LangGraph 包现在都需要 **Node.js 22 或更高版本**。 Node.js 18 于 2025 年 3 月达到[end of life](https://nodejs.org/en/about/releases/)。

### 新构建输出

所有 langgraph 包的构建现在使用基于捆绑器的方法，而不是使用原始打字稿输出。如果您从 `dist/` 目录导入文件（不推荐），则需要更新导入以使用新的模块系统。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/javascript/migrate/langgraph-v1.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>