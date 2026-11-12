<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph overview | https://docs.langchain.com/oss/javascript/langgraph/overview -->

# LangGraph 概述

用于长期运行、有状态代理的低级编排框架和运行时

LangGraph 是一个低级编排框架和运行时，适用于长时间运行的有状态代理。您将工作流程定义为共享状态、节点和边的图，并且可以在同一图中混合确定性步骤与 LLM 驱动的步骤。

LangGraph重点关注[durable execution](/oss/javascript/langgraph/persistence)、[streaming](/oss/javascript/langgraph/streaming)、[human-in-the-loop](/oss/javascript/langgraph/interrupts)等编排能力。它没有规定提示或代理架构。

在开始之前，请了解代理使用的构建块，尤其是[models](/oss/javascript/langchain/models)和[tools](/oss/javascript/langchain/tools)。文档示例通常使用 [LangChain](/oss/javascript/langchain/overview) 进行这些集成，但 LangGraph 不需要 LangChain。

如果您首先想要更高级别的代理循环，请使用[Deep Agents](/oss/javascript/deepagents/overview)或LangChain[agents](/oss/javascript/langchain/agents)。当您需要对状态和控制流进行显式控制时，请使用LangGraph。

**LangChain 产品如何组合*** [Deep Agents](/oss/javascript/deepagents/overview) 是[agent harness](/oss/javascript/concepts/products#agent-harnesses-like-the-deep-agents-sdk)：在LangGraph 之上的规划、子代理、文件系统工具和上下文管理。
* [LangChain](/oss/javascript/langchain/overview) 是代理框架：模型、工具和代理循环的抽象和集成。
* [LangGraph](/oss/javascript/langgraph/overview) 是编排运行时：持久执行、流式传输、人机交互和持久性。
* [LangSmith](/langsmith/observability)是跨框架追踪、评估、提示、部署的平台。
* [LangSmith Engine](/langsmith/engine) 检测LangGraph 代理跟踪中的问题并提出修复建议。您可以从“引擎”选项卡打开包含建议修复的拉取请求。
* [LangSmith Fleet](/langsmith/fleet/index) 是用于模板、集成和例程自动化的无代码代理构建器。

有关开源堆栈的比较，请参阅[Frameworks, runtimes, and harnesses](/oss/javascript/concepts/products)。

## 安装

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

创建一个最小图：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";

const State = new StateSchema({
  messages: MessagesValue,
});

const mockLlm: GraphNode<typeof State> = (state) => {
  return { messages: [{ role: "ai", content: "hello world" }] };
};

const graph = new StateGraph(State)
  .addNode("mock_llm", mockLlm)
  .addEdge(START, "mock_llm")
  .addEdge("mock_llm", END)
  .compile();

await graph.invoke({ messages: [{ role: "user", content: "hi!" }] });
```

有关完整的计算器代理，请参阅[LangGraph quickstart](/oss/javascript/langgraph/quickstart)。

## 能力

LangGraph 为有状态、长时间运行的工作流程提供运行时原语。它不会抽象提示或强制采用固定的代理架构。* **确定性和代理步骤**：将手工编码的节点与模型驱动的节点组合在一张图中。
* [**Persistence**](/oss/javascript/langgraph/persistence)：检查点状态并在失败或暂停后恢复。
* [**Human-in-the-loop**](/oss/javascript/langgraph/interrupts)：暂停执行，检查或编辑状态，然后继续。
* [**Memory**](/oss/javascript/concepts/memory)：跨会话的短期线程状态和长期记忆。
* [**Streaming**](/oss/javascript/langgraph/streaming)：在图表运行时流式传输令牌、状态更新和其他事件。

## 集成、部署和可观察性

LangGraph 可以独立工作。但是，您也可以将其与其他LangChain产品配对：

> [卡][LangChain](/oss/javascript/langchain/overview)
>
> 基于 LangGraph 构建的集成和代理抽象。

> [卡][LangSmith Agent Server](/langsmith/deployment)
>
> 通过 Studio 中的可视化原型来部署和扩展有状态代理。

> [卡][LangSmith Observability](/langsmith/observability)
>
> 跟踪请求、评估输出并监控部署。

## 另请参阅

* [LangGraph quickstart](/oss/javascript/langgraph/quickstart)
* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Frameworks, runtimes, and harnesses](/oss/javascript/concepts/products)
* [Incorporate existing code and other frameworks](/langsmith/deploy-other-frameworks)（为LangSmith代理服务器包装一个非LangGraph代理）

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/overview.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。