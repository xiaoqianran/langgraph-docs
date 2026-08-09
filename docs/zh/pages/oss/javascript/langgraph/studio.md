<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangSmith Studio | https://docs.langchain.com/oss/javascript/langgraph/studio -->

# 朗史密斯工作室

当使用 LangChain 在本地构建代理时，可视化代理内部发生的情况、与其实时交互以及在出现问题时进行调试是很有帮助的。 **LangSmith Studio** 是一个免费的可视化界面，用于从本地计算机开发和测试 LangChain 代理。

Studio 连接到本地运行的代理，向您显示代理执行的每个步骤：发送到模型的提示、工具调用及其结果以及最终输出。您可以测试不同的输入、检查中间状态并迭代代理的行为，而无需额外的代码或部署。

本页介绍如何通过本地 LangChain 代理设置 Studio。

## 先决条件

在开始之前，请确保您具备以下条件：

* **LangSmith 帐户**：注册（免费）或通过 [smith.langchain.com](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-studio) 登录。
* **LangSmith API 密钥**：遵循 [Create an API key](/langsmith/create-account-api-key) 指南。
* 如果您不需要数据 [traced](/langsmith/observability-concepts#traces) 到 LangSmith，请在应用程序的 `.env` 文件中设置 `LANGSMITH_TRACING=false`。禁用跟踪后，没有数据离开您的本地服务器。

## 设置本地Agent服务器

### 1. 安装 LangGraph CLI

[LangGraph CLI](/langsmith/cli) 提供本地开发服务器（也称为 [Agent Server](/langsmith/agent-server)），将您的代理连接到 Studio。```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npx @langchain/langgraph-cli
```

### 2. 准备你的代理

如果您已经有LangChain代理，可以直接使用。此示例使用一个简单的电子邮件代理：

```typescript title="agent.ts" theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { createAgent } from "@langchain/langgraph";

function sendEmail(to: string, subject: string, body: string): string {
    // Send an email
    const email = {
        to: to,
        subject: subject,
        body: body
    };
    // ... email sending logic

    return `Email sent to ${to}`;
}

const agent = createAgent({
    model: "gpt-5.5",
    tools: [sendEmail],
    systemPrompt: "You are an email assistant. Always use the sendEmail tool.",
});

export { agent };
```

### 3.环境变量

Studio 需要 LangSmith API 密钥才能连接您的本地代理。在项目的根目录中创建一个 `.env` 文件，并从 [LangSmith](https://smith.langchain.com/settings) 添加 API 密钥。

<Warning>
  确保您的 `.env` 文件未提交给版本控制，例如 Git。
</Warning>

```bash .env theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
LANGSMITH_API_KEY=lsv2...
```

### 4. 创建 LangGraph 配置文件

LangGraph CLI 使用配置文件来查找代理并管理依赖项。在应用程序目录中创建一个 `langgraph.json` 文件：

```json title="langgraph.json" theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
{
  "dependencies": ["."],
  "graphs": {
    "agent": "./src/agent.ts:agent"
  },
  "env": ".env"
}
```

[⟦T12⟧](https://reference.langchain.com/javascript/langchain/index/createAgent) 函数自动返回编译后的 LangGraph 图，这正是配置文件中 `graphs` 键所期望的。

<Info>
  配置文件JSON对象中各个key的详细解释，请参考[LangGraph configuration file reference](/langsmith/cli#configuration-file)。
</Info>

此时，项目结构将如下所示：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
my-app/
├── src
│   └── agent.ts
├── .env
├── package.json
└── langgraph.json
```

### 5.安装依赖项

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
yarn install
```

### 6. 在 Studio 中查看您的代理

启动开发服务器以将代理连接到 Studio：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npx @langchain/langgraph-cli dev
```<Warning>
  Safari 阻止 `localhost` 与 Studio 的连接。要解决此问题，请使用 `--tunnel` 运行上述命令，以通过安全隧道访问 Studio。您需要通过单击 Studio UI 中的 **连接到本地服务器** 来手动将隧道 URL 添加到允许的源。步骤请参阅[troubleshooting guide](/langsmith/troubleshooting-studio#safari-connection-issues)。
</Warning>

服务器运行后，您的代理可以通过 `http://127.0.0.1:2024` 的 API 和 `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024` 的 Studio UI 访问：

<Frame>
  <img alt="Agent view in the Studio UI" />
</Frame>

通过 Studio 连接到本地代理，您可以快速迭代代理的行为。运行测试输入，检查完整的执行跟踪，包括提示、工具参数、返回值和[LangSmith](/langsmith/observability-studio)中的令牌/延迟指标。当出现问题时，Studio 会捕获周围状态的异常，以帮助您了解发生的情况。

开发服务器支持热重载——对代码中的提示或工具签名进行更改，Studio 会立即反映它们。从任何步骤重新运行对话线程以测试您的更改，而无需重新开始。该工作流程从简单的单工具代理扩展到复杂的多节点图。

有关如何运行 Studio 的更多信息，请参阅[LangSmith docs](/langsmith/observability)中的以下指南：* [Run application](/langsmith/use-studio#run-application)
* [Manage assistants](/langsmith/use-studio#manage-assistants)
* [Manage threads](/langsmith/use-studio#manage-threads)
* [Iterate on prompts](/langsmith/observability-studio)
* [Debug LangSmith traces](/langsmith/observability-studio#debug-langsmith-traces)
* [Add node to dataset](/langsmith/observability-studio#add-node-to-dataset)

## 视频指南

<Frame>
  <iframe title="Studio" />
</Frame>

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/studio.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>