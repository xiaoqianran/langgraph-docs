<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Deployment | https://docs.langchain.com/oss/python/langgraph/deploy -->

# 部署

使用 LangSmith Cloud 或 JavaScript 框架和托管平台将 LangGraph 代理部署到生产环境。

当您准备好将 LangGraph 代理部署到生产环境时，请选择适合您的堆栈的托管模型。 **[LangSmith Cloud](/langsmith/deploy-to-cloud)** 为有状态、长期运行的代理提供完全托管的基础设施，具有持久状态和后台执行。

<Tip>
  LangSmith 提供了云之外的多种部署选项，包括 [hybrid](/langsmith/hybrid)、[standalone servers](/langsmith/deploy-standalone-server) 和 [self-hosted with control plane](/langsmith/deploy-with-control-plane)。欲了解更多信息，请参阅[LangSmith Deployment overview](/langsmith/deployment)。
</Tip>

## 朗史密斯云

本节介绍如何将代理从 GitHub 存储库部署到 LangSmith Cloud。 LangSmith 负责处理基础设施、扩展和运营问题。

### 先决条件

在开始之前，请确保您具备以下条件：

* [GitHub account](https://github.com/)
* A [LangSmith account](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy)（免费报名）

### 部署你的代理

#### 1. 在 GitHub 上创建存储库

您的应用程序代码必须驻留在 GitHub 存储库中才能部署在 LangSmith 上。支持公共和私有存储库。对于本快速入门，首先按照 [local server setup guide](/oss/python/langgraph/studio#set-up-local-agent-server) 确保您的应用程序与 LangGraph 兼容。然后，将您的代码推送到存储库。

#### 2. 部署到 LangSmith<Steps>
  <Step title="Navigate to LangSmith Deployment">
    登录[LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy)。在左侧边栏中，选择**部署**。
  </Step>

  <Step title="Create new deployment">
    单击 **+ 新部署** 按钮。将打开一个窗格，您可以在其中填写必填字段。
  </Step>

  <Step title="Link repository">
    如果您是首次使用或添加之前未连接过的私有存储库，请单击 **添加新帐户** 按钮并按照说明连接您的 GitHub 帐户。
  </Step>

  <Step title="Deploy repository">
    选择您的应用程序的存储库。单击**提交**进行部署。这可能需要大约 15 分钟才能完成。您可以在 **部署详细信息** 视图中检查状态。
  </Step>
</Steps>

#### 3. 在 Studio 中测试您的应用程序

部署您的应用程序后：

1. 选择您刚刚创建的部署以查看更多详细信息。
2. 单击右上角的 **Studio** 按钮。 Studio 将打开并显示您的图表。

#### 4. 获取您的部署的 API URL

1. 在 LangGraph 的 **部署详细信息** 视图中，单击 **API URL** 将其复制到剪贴板。
2. 点击`URL`将其复制到剪贴板。

#### 5. 测试 API

您现在可以测试 API：

<Tabs>
  <Tab title="Python">
    1.安装LangGraph SDK：

    ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    pip install langgraph-sdk
    ```2. 向代理发送消息：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph_sdk import get_sync_client # or get_client for async

    client = get_sync_client(url="your-deployment-url", api_key="your-langsmith-api-key")

    for chunk in client.runs.stream(
        None,    # Threadless run
        "agent", # Name of agent. Defined in langgraph.json.
        input={
            "messages": [{
                "role": "human",
                "content": "What is LangGraph?",
            }],
        },
        stream_mode="updates",
    ):
        print(f"Receiving new event of type: {chunk.event}...")
        print(chunk.data)
        print("\n\n")
    ```
  </Tab>

  <Tab title="Rest API">
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
  </Tab>
</Tabs>

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/deploy.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>