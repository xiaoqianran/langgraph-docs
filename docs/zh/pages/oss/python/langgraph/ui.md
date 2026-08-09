<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Agent Chat UI | https://docs.langchain.com/oss/python/langgraph/ui -->

# 代理聊天界面

[Agent Chat UI](https://github.com/langchain-ai/agent-chat-ui)是一个Next.js应用程序，提供与任何LangChain代理交互的对话界面。它支持实时聊天、工具可视化以及时间旅行调试和状态分叉等高级功能。代理聊天 UI 与使用 [⟦T2⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 创建的代理无缝协作，并以最少的设置为您的代理提供交互式体验，无论您是在本地运行还是在部署的上下文中（例如 [LangSmith](/langsmith/observability)）运行。

代理聊天 UI 是开源的，可以根据您的应用程序需求进行调整。

<Frame>
  <iframe title="Agent Chat UI" />
</Frame>

<Tip>
  您可以在代理聊天 UI 中使用生成 UI。欲了解更多信息，请参阅[Implement generative user interfaces with LangGraph](/langsmith/generative-ui-react)。
</Tip>

### 快速开始

最快的入门方法是使用托管版本：

1. **参观[Agent Chat UI](https://agentchat.vercel.app)**
2. **通过输入您的部署 URL 或本地服务器地址来连接您的代理**
3. **开始聊天** - UI会自动检测并渲染工具调用和中断

### 本地发展

对于自定义或本地开发，您可以在本地运行代理聊天 UI：

<CodeGroup>
  ```bash Use npx theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Create a new Agent Chat UI project
  npx create-agent-chat-app --project-name my-chat-ui
  cd my-chat-ui

  # Install dependencies and start
  pnpm install
  pnpm dev
  ```

  ```bash Clone repository theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Clone the repository
  git clone https://github.com/langchain-ai/agent-chat-ui.git
  cd agent-chat-ui

  # Install dependencies and start
  pnpm install
  pnpm dev
  ```
</CodeGroup>

### 连接到您的代理

代理聊天 UI 可以连接到 [local](/oss/python/langgraph/studio#set-up-local-agent-server) 和 [deployed agents](/oss/python/langgraph/deploy)。启动代理聊天 UI 后，您需要将其配置为连接到您的代理：

1. **图表 ID**：输入您的图表名称（在 `langgraph.json` 文件中的 `graphs` 下找到）
2. **部署 URL**：您的代理服务器的端点（例如，用于本地开发的`http://localhost:2024`，或您部署的代理的 URL）
3. **LangSmith API 密钥（可选）**：添加您的 LangSmith API 密钥（如果您使用本地代理服务器则不需要）

配置完成后，代理聊天 UI 将自动获取并显示代理中任何中断的线程。

<Tip>
  代理聊天 UI 对呈现工具调用和工具结果消息提供开箱即用的支持。要自定义显示的消息，请参阅[Hiding Messages in the Chat](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#hiding-messages-in-the-chat)。
</Tip>

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/ui.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>