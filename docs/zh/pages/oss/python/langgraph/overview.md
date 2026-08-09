<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph overview | https://docs.langchain.com/oss/python/langgraph/overview -->

# LangGraph 概述

使用 LangGraph 获得控制权，设计能够可靠处理复杂任务的代理

受到塑造代理未来的公司（包括 Klarna、Uber、J.P. Morgan 等）的信赖，LangGraph 是一个低级编排框架和运行时，用于构建、管理和部署长期运行的有状态代理。 LangGraph 为您提供细粒度的控制，将确定性的手动编码步骤与 LLM 驱动的代理步骤混合在同一图表中，因此您可以构建完全按照应用程序所需的方式运行的定制代理。

LangGraph 级别非常低，完全专注于代理**编排**。在使用LangGraph之前，我们建议您先熟悉一些用于构建代理的组件，从[models](/oss/python/langchain/models)和[tools](/oss/python/langchain/tools)开始。

我们将在整个文档中通常使用[LangChain](/oss/python/langchain/overview)组件来集成模型和工具，但您不需要使用LangChain来使用LangGraph。如果您刚刚开始使用代理或想要更高级别的抽象，我们建议您使用LangChain的[agents](/oss/python/langchain/agents)，它为常见的LLM和工具调用循环提供预构建的架构。LangGraph 专注于对代理编排非常重要的底层功能：持久执行、流式传输、人机交互等。

LangGraph 的核心优势之一是能够在单个图中将确定性步骤与 LLM 驱动的代理步骤混合在一起。这使您可以构建定制的工作流程，其中部分逻辑完全可预测和可审计，而其他部分则灵活且由模型驱动，从而使您能够精确控制人工智能的应用位置和方式。

<Expandable title="how LangChain products fit together">
  * [Deep Agents](/oss/python/deepagents/overview) 是 [agent harness](/oss/python/concepts/products#agent-harnesses-like-the-deep-agents-sdk)：在 LangGraph 之上的规划、子代理、文件系统工具和上下文管理。
  * [LangChain](/oss/python/langchain/overview) 是代理框架：模型、工具和代理循环的抽象和集成。
  * [LangGraph](/oss/python/langgraph/overview) 是编排运行时：持久执行、流式传输、人机交互和持久性。
  * [LangSmith](/langsmith/observability)是跨框架追踪、评估、提示、部署的平台。
  * [LangSmith Engine](/langsmith/engine) 检测您的 LangGraph 代理跟踪中的问题并提出修复建议。您可以直接从“引擎”选项卡打开包含建议修复的拉取请求。
  * [LangSmith Fleet](/langsmith/fleet/index) 是用于模板、集成和例程自动化的无代码代理构建器。阅读 [Frameworks, runtimes, and harnesses](/oss/python/concepts/products) 来比较开源堆栈。
</Expandable>

## <Icon icon="download" /> 安装

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph
  ```
</CodeGroup>

然后，创建一个简单的 hello world 示例：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, MessagesState, START, END

def mock_llm(state: MessagesState):
    return {"messages": [{"role": "ai", "content": "hello world"}]}

graph = StateGraph(MessagesState)
graph.add_node(mock_llm)
graph.add_edge(START, "mock_llm")
graph.add_edge("mock_llm", END)
graph = graph.compile()

graph.invoke({"messages": [{"role": "user", "content": "hi!"}]})
```

<Tip>
  使用 [LangSmith](/langsmith/observability) 跟踪请求、调试代理行为并评估输出。设置 `LANGSMITH_TRACING=true` 和您的 API 密钥即可开始。按照[tracing quickstart](/langsmith/trace-with-langchain)进行设置。  我们建议您还设置 [LangSmith Engine](/langsmith/engine) 来监视您的痕迹、检测问题并提出修复建议。
</Tip>

## 核心优势

LangGraph 为*任何*长期运行、有状态的工作流程或代理提供低级支持基础设施。 LangGraph 不抽象提示或架构，并提供以下核心优势：* **混合确定性和代理步骤**：将手动编码的确定性逻辑与 LLM 驱动的决策结合在单个图中。在需要可靠性和可预测性的地方使用确定性步骤，在需要灵活性的地方使用代理步骤，让您能够精确控制代理行为的每个部分。
* [Persistence](/oss/python/langgraph/persistence)：构建能够在故障中持续存在并可以长时间运行并从中断位置恢复的代理。
* [Human-in-the-loop](/oss/python/langgraph/interrupts)：通过随时检查和修改代理状态来纳入人工监督。
* [Comprehensive memory](/oss/python/concepts/memory)：创建有状态代理，具有用于持续推理的短期工作记忆和跨会话的长期记忆。
* [Debugging with LangSmith](/langsmith/observability)：通过可视化工具跟踪执行路径、捕获状态转换并提供详细的运行时指标，深入了解复杂的代理行为。
* [Production-ready deployment](/langsmith/deployment)：通过可扩展的基础设施自信地部署复杂的代理系统，该基础设施旨在应对有状态、长时间运行的工作流程的独特挑战。

## LangGraph 生态系统虽然LangGraph可以独立使用，但它也可以与任何LangChain产品无缝集成，为开发人员提供了一整套用于构建代理的工具。为了改善您的 LLM 申请开发，请将 LangGraph 与：

<Columns>
  <Card title="LangSmith Observability" icon="https://mintcdn.com/langchain-5e9cc07a/nQm-sjd_MByLhgeW/images/brand/observability-icon-dark.png?fit=max&auto=format&n=nQm-sjd_MByLhgeW&q=85&s=ccbc183bca2a5e4ca78d30149e3836cc" href="/langsmith/observability">
    在一处跟踪请求、评估输出并监控部署。使用LangGraph在本地进行原型设计，然后通过集成的可观察性和评估进行生产，以构建更可靠的代理系统。
  </Card>

  <Card title="LangSmith Deployment" icon="https://mintcdn.com/langchain-5e9cc07a/nQm-sjd_MByLhgeW/images/brand/deployment-icon-dark.png?fit=max&auto=format&n=nQm-sjd_MByLhgeW&q=85&s=024e3712d388bfa55f4f160cc9d6a85b" href="/langsmith/deployment">
    使用专门构建的部署平台轻松部署和扩展代理，以实现长期运行、有状态的工作流程。跨团队发现、重用、配置和共享代理，并通过 Studio 中的可视化原型快速迭代。
  </Card>

  <Card title="LangChain" icon="https://mintcdn.com/langchain-5e9cc07a/nQm-sjd_MByLhgeW/images/brand/langchain-icon.png?fit=max&auto=format&n=nQm-sjd_MByLhgeW&q=85&s=663b30f85baf99ad708b97e05da2a5a4" href="/oss/python/langchain/overview">
    提供集成和可组合组件以简化法学硕士应用程序开发。包含构建在 LangGraph 之上的代理抽象。
  </Card>
</Columns>

## 致谢

LangGraph的灵感来自于[Pregel](https://research.google/pubs/pub37252/)和[Apache Beam](https://beam.apache.org/)。公共界面的灵感来自于[NetworkX](https://networkx.org/documentation/latest/)。 LangGraph 由 LangChain 的创建者 LangChain Inc 构建，但可以在没有 LangChain 的情况下使用。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout><Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/overview.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>