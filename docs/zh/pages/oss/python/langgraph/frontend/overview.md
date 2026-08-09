<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Overview | https://docs.langchain.com/oss/python/langgraph/frontend/overview -->

# 概述

将 LangGraph 代理渲染到前端

构建实时可视化 LangGraph 管道的前端。这些图案
展示如何使用每个节点状态和流来渲染多步图执行
来自自定义 `StateGraph` 工作流程的内容。

LangGraph的前端优势是UI可以遵循与
图表。节点、状态键、检查点、中断、子图和流式传输
消息都是可见的运行时概念，因此您可以构建以下接口：
解释系统正在做什么，而不是将执行隐藏在系统后面
助理消息。

<Note>
  这些模式使用 v1 前端 SDK 包。如果您使用的是早期版本，请参阅 [React](https://github.com/langchain-ai/langgraphjs/blob/main/libs/sdk-react/docs/v1-migration.md)、[Vue](https://github.com/langchain-ai/langgraphjs/blob/main/libs/sdk-vue/docs/v1-migration.md)、[Svelte](https://github.com/langchain-ai/langgraphjs/blob/main/libs/sdk-svelte/docs/v1-migration.md) 和 [Angular](https://github.com/langchain-ai/langgraphjs/blob/main/libs/sdk-angular/docs/v1-migration.md) 的迁移指南。
</Note>

## 架构

LangGraph 图由通过边连接的命名节点组成。每个节点执行一个步骤（分类、研究、分析、综合）并将输出写入特定的状态键。在前端，SDK 流句柄提供对节点输出、流令牌和发现的子图的反应式访问，以便您可以将每个节点映射到 UI 卡。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{
  init: {
    "fontFamily": "monospace",
    "flowchart": {
      "curve": "curve"
    }
  }
}%%
graph LR
  FRONTEND["useStream()"]
  GRAPH["StateGraph"]
  N1["Node A"]
  N2["Node B"]
  N3["Node C"]

  GRAPH --"stream"--> FRONTEND
  FRONTEND --"submit"--> GRAPH
  GRAPH --> N1
  N1 --> N2
  N2 --> N3

  classDef blueHighlight fill:#DBEAFE,stroke:#2563EB,color:#1E3A8A;
  classDef greenHighlight fill:#DCFCE7,stroke:#16A34A,color:#14532D;
  classDef orangeHighlight fill:#FEF3C7,stroke:#D97706,color:#92400E;
  class FRONTEND blueHighlight;
  class GRAPH greenHighlight;
  class N1,N2,N3 orangeHighlight;
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, MessagesState, START, END

class State(MessagesState):
    classification: str
    research: str
    analysis: str
    synthesis: str

graph = StateGraph(State)
graph.add_node("classify", classify_node)
graph.add_node("do_research", research_node)
graph.add_node("analyze", analyze_node)
graph.add_node("synthesize", synthesize_node)
graph.add_edge(START, "classify")
graph.add_edge("classify", "do_research")
graph.add_edge("do_research", "analyze")
graph.add_edge("analyze", "synthesize")
graph.add_edge("synthesize", END)

app = graph.compile()
```在前端，[⟦T4⟧](https://reference.langchain.com/javascript/langchain-react/index/useStream)公开`stream.subgraphs`用于图节点发现
以及选择器帮助器，例如用于节点范围的 `useMessages(stream, node)`
流媒体内容。当您
需要诸如最后的`synthesis`之类的字段。 Angular 使用相同的流 API
通过[⟦T9⟧](https://reference.langchain.com/javascript/langchain-angular/injectStream)塑造形状。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { useStream } from "@langchain/react";

function Pipeline() {
  const stream = useStream<typeof graph>({
    apiUrl: "http://localhost:2024",
    assistantId: "pipeline",
  });

  const classification = stream.values?.classification;
  const research = stream.values?.research;
  const analysis = stream.values?.analysis;
  const graphNodes = [...stream.subgraphs.values()];
}
```

## 这与聊天流有何不同

自定义图表通常为产品工作流程提供动力：研究管道、审批流程、
数据管道、数据丰富、代码审查、规划和多步骤分析。的
前端 SDK 允许您使用图形本机信号渲染这些工作流程：|运行时概念|前端用户体验 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| **命名节点** |每个图形节点一张卡片、时间线步骤或状态徽章。                                               |
| **状态密钥** |用于分类、来源、分析和最终综合等类型化输出的专用 UI​​ 区域。 |
| **流式元数据** |将部分消息路由到生成它们的节点。                                                 |
| **检查点** |检查或从先前的图形状态恢复以进行调试和可审核性。                              |
| **中断** |暂停节点以进行人工输入、批准或更正，然后继续。                                  |
| **子图** |仅当用户需要更多详细信息时才显示嵌套执行。                                          |由于 SDK 直接公开了这些概念，因此您可以从简单的
聊天面板到完整的工作流程调试器，无需更改后端协议。

## 模式

<CardGroup>
  <Card title="Graph execution" icon="chart-dots" href="/oss/python/langgraph/frontend/graph-execution">
    通过每个节点的状态和流内容可视化多步骤图形管道。
  </Card>

  <Card title="Custom stream channels" icon="broadcast" href="/oss/python/langgraph/frontend/custom-stream-channels">
    将自定义服务器端数据流式传输到前端并使用`useExtension`和`useChannel`读取它。
  </Card>
</CardGroup>

## 相关模式

[LangChain frontend patterns](/oss/python/langchain/frontend/overview)——markdown 消息、工具调用、人机交互、可恢复流和时间旅行——适用于任何 LangGraph 图。无论您使用 `createAgent`、`createDeepAgent` 还是自定义 `StateGraph`，流 API 都提供相同的核心数据模型。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/frontend/overview.md) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>