<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Deployment | https://docs.langchain.com/oss/javascript/langgraph/deploy -->

# 部署

使用 LangSmith 云或 JavaScript 框架和托管平台将 LangGraph 代理部署到生产环境。

当您准备好将 LangGraph 代理部署到生产环境时，请选择适合您的堆栈的托管模型。 **[LangSmith Cloud](/langsmith/deploy-to-cloud)** 为有状态、长期运行的代理提供完全托管的基础设施，具有持久状态和后台执行。

您还可以使用相同的 [Agent Streaming Protocol](https://github.com/langchain-ai/agent-protocol/tree/main/streaming) 部署在 **JavaScript 框架和平台**，例如 Next.js、SvelteKit、Nuxt、Cloudflare Workers 和 Deno Deploy。

框架和平台

[View all guides](/langsmith/deploy-frameworks-and-platforms)

![](https://mintcdn.com/langchain-5e9cc07a/ZPKed1feKJ8F6LVo/images/providers/light/langchain.svg?fit=max\&auto=format\&n=ZPKed1feKJ8F6LVo\&q=85\&s=b910ed9cd0b6b8adb4b6da400882e92c)

LangSmith

[Open](/langsmith/deploy-vite-langsmith)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/nextjs.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=4f3336e9534db50f25f87173a41322d5)

Next.js

[Open](/langsmith/deploy-nextjs)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/svelte.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=07e7e35c40e4522f739feea9ef3e33b7)

苗条套件

[Open](/langsmith/deploy-sveltekit)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/nuxt.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=5d965ed1f93f51ac604e66b935a65368)

努克斯特

[Open](/langsmith/deploy-nuxt)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/cloudflare.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=ae129fcbfc78ccaece42b1c4d3699311)

云耀

[Open](/langsmith/deploy-cloudflare-workers)

![](https://mintcdn.com/langchain-5e9cc07a/Tz8fh3A43FeUPf69/images/providers/light/deno.svg?fit=max\&auto=format\&n=Tz8fh3A43FeUPf69\&q=85\&s=8d213b0000104542fcaa7ab160595224)

德诺

[Open](/langsmith/deploy-deno)

> [!提示]
>
> LangSmith 提供云之外的多种部署选项，包括 [hybrid](/langsmith/hybrid)、[standalone servers](/langsmith/deploy-standalone-server) 和 [self-hosted with control plane](/langsmith/deploy-with-control-plane)。欲了解更多信息，请参阅[LangSmith Deployment overview](/langsmith/deployment)。

## LangSmith 云

本节介绍如何将代理从 GitHub 存储库部署到 LangSmith 云。 LangSmith 处理基础设施、扩展和运营问题。

### 先决条件

在开始之前，请确保您具备以下条件：

* [GitHub account](https://github.com/)
* A [LangSmith account](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy)（免费报名）

### 部署你的代理

#### 1. 在 GitHub 上创建存储库您的应用程序的代码必须驻留在 GitHub 存储库中才能部署在 LangSmith 上。支持公共和私有存储库。对于本快速入门，首先按照 [local server setup guide](/oss/javascript/langgraph/studio#set-up-local-agent-server) 确保您的应用与 LangGraph 兼容。然后，将您的代码推送到存储库。

#### 2. 部署到LangSmith

**1.导航至LangSmith部署**

登录[LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy)。在左侧边栏中，选择**部署**。

**2.创建新部署**

单击 **+ 新部署** 按钮。将打开一个窗格，您可以在其中填写必填字段。

**3.链接存储库**

如果您是首次使用或添加之前未连接过的私有存储库，请单击 **添加新帐户** 按钮并按照说明连接您的 GitHub 帐户。

**4.部署存储库**

选择您的应用程序的存储库。单击**提交**进行部署。这可能需要大约 15 分钟才能完成。您可以在 **部署详细信息** 视图中检查状态。

#### 3. 在 Studio 中测试您的应用程序

部署您的应用程序后：

1. 选择您刚刚创建的部署以查看更多详细信息。
2. 单击右上角的 **Studio** 按钮。 Studio 将打开并显示您的图表。#### 4. 获取您的部署的 API URL

1. In the **Deployment details** view in LangGraph, click the **API URL** to copy it to your clipboard.
2. Click the `URL` to copy it to the clipboard.

#### 5. 测试 API

您现在可以测试 API：

**打字稿**

1.安装LangGraphSDK：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npm install @langchain/langgraph-sdk
```

2. 向代理发送消息：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ apiUrl: "your-deployment-url", apiKey: "your-langsmith-api-key" });

const streamResponse = client.runs.stream(
  null,    // Threadless run
  "agent", // Name of agent. Defined in langgraph.json.
  {
    input: {
      "messages": [
        { "role": "user", "content": "What is LangGraph?"}
      ]
    },
    streamMode: "messages",
  }
);

for await (const chunk of streamResponse) {
  console.log(`Receiving new event of type: ${chunk.event}...`);
  console.log(JSON.stringify(chunk.data));
  console.log("\n\n");
}
```

**休息API**

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
curl -s --request POST \
    --url <DEPLOYMENT_URL>/runs/stream \
    --header 'Content-Type: application/json' \
    --header "X-Api-Key: <LANGSMITH API KEY> \
    --data "{
        \"assistant_id\": \"agent\", `# Name of agent. Defined in langgraph.json.`
        \"input\": {
            \"messages\": [
                {
                    \"role\": \"human\",
                    \"content\": \"What is LangGraph?\"
                }
            ]
        },
        \"stream_mode\": \"updates\"
    }"
```

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/deploy.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。