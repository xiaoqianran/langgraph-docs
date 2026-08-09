<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Run a local server | https://docs.langchain.com/oss/python/langgraph/local-server -->

# 运行本地服务器

本指南向您展示如何在本地运行 LangGraph 应用程序。

## 先决条件

在开始之前，请确保您具备以下条件：

* [LangSmith](https://smith.langchain.com/settings) 的 API 密钥 - 免费注册

## 1. 安装 LangGraph CLI

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Python >= 3.11 is required.
  pip install -U "langgraph-cli[inmem]"
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Python >= 3.11 is required.
  uv add "langgraph-cli[inmem]"
  ```
</CodeGroup>

## 2. 创建 LangGraph 应用程序

从 [⟦T16⟧ template](https://github.com/langchain-ai/new-langgraph-project) 创建一个新应用程序。该模板演示了您可以使用自己的逻辑进行扩展的单节点应用程序。

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
langgraph new path/to/your/app --template new-langgraph-project-python
```

<Tip>
  **附加模板**
  如果您使用`langgraph new`而不指定模板，您将看到一个交互式菜单，允许您从可用模板列表中进行选择。
</Tip>

## 3.安装依赖项

在新 LangGraph 应用程序的根目录中，以 `edit` 模式安装依赖项，以便服务器使用本地更改：

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  cd path/to/your/app
  pip install -e .
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  cd path/to/your/app
  uv sync
  ```
</CodeGroup>

## 4. 创建`.env`文件

您将在新 LangGraph 应用程序的根目录中找到 `.env.example`。在新 LangGraph 应用程序的根目录中创建一个 `.env` 文件，并将 `.env.example` 文件的内容复制到其中，填写必要的 API 密钥：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
LANGSMITH_API_KEY=lsv2...
```

## 5.启动代理服务器

本地启动 LangGraph API 服务器：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
langgraph dev
```

示例输出：

```
INFO:langgraph_api.cli:

        Welcome to

╦  ┌─┐┌┐┌┌─┐╔═╗┬─┐┌─┐┌─┐┬ ┬
║  ├─┤││││ ┬║ ╦├┬┘├─┤├─┘├─┤
╩═╝┴ ┴┘└┘└─┘╚═╝┴└─┴ ┴┴  ┴ ┴

- 🚀 API: http://127.0.0.1:2024
- 🎨 Studio UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
- 📚 API Docs: http://127.0.0.1:2024/docs

This in-memory server is designed for development and testing.
For production use, please use LangSmith Deployment.
````langgraph dev` 命令以内存模式启动 Agent Server。该模式适合开发和测试目的。对于生产使用，部署可以访问持久存储后端的代理服务器。欲了解更多信息，请参阅[Platform setup overview](/langsmith/platform-setup)。

## 6. 在 Studio 中测试您的应用程序

[Studio](/langsmith/studio) 是一个专门的 UI，您可以连接到 LangGraph API 服务器以在本地可视化、交互和调试您的应用程序。通过访问 `langgraph dev` 命令输出中提供的 URL 来测试您的图形：

```
>    - LangGraph Studio Web UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

对于在自定义主机/端口上运行的代理服务器，请更新 URL 中的 `baseUrl` 查询参数。例如，如果您的服务器在 `http://myhost:3000` 上运行：

```
https://smith.langchain.com/studio/?baseUrl=http://myhost:3000
```

<Accordion title="Safari compatibility">
  在命令中使用 `--tunnel` 标志来创建安全隧道，因为 Safari 在连接到本地主机服务器时有限制：

  ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  langgraph dev --tunnel
  ```
</Accordion>

## 7. 测试 API

<Tabs>
  <Tab title="Python SDK (async)">
    1.安装LangGraph Python SDK：
       ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
       pip install langgraph-sdk
       ```
    2.向助手发送消息（无线程运行）：
       ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
       from langgraph_sdk import get_client
       import asyncio

       client = get_client(url="http://localhost:2024")

       async def main():
           async for chunk in client.runs.stream(
               None,  # Threadless run
               "agent", # Name of assistant. Defined in langgraph.json.
               input={
               "messages": [{
                   "role": "human",
                   "content": "What is LangGraph?",
                   }],
               },
           ):
               print(f"Receiving new event of type: {chunk.event}...")
               print(chunk.data)
               print("\n\n")

       asyncio.run(main())
       ```
  </Tab>

  <Tab title="Python SDK (sync)">
    1.安装LangGraph Python SDK：
       ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
       pip install langgraph-sdk
       ```
    2.向助手发送消息（无线程运行）：
       ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
       from langgraph_sdk import get_sync_client

       client = get_sync_client(url="http://localhost:2024")

       for chunk in client.runs.stream(
           None,  # Threadless run
           "agent", # Name of assistant. Defined in langgraph.json.
           input={
               "messages": [{
                   "role": "human",
                   "content": "What is LangGraph?",
               }],
           },
           stream_mode="messages-tuple",
       ):
           print(f"Receiving new event of type: {chunk.event}...")
           print(chunk.data)
           print("\n\n")
       ```
  </Tab>

  <Tab title="Rest API">
    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    curl -s --request POST \
        --url "http://localhost:2024/runs/stream" \
        --header 'Content-Type: application/json' \
        --data "{
            \"assistant_id\": \"agent\",
            \"input\": {
                \"messages\": [
                    {
                        \"role\": \"human\",
                        \"content\": \"What is LangGraph?\"
                    }
                ]
            },
            \"stream_mode\": \"messages-tuple\"
        }"
    ```
  </Tab>
</Tabs>

## 后续步骤现在您已经在本地运行了 LangGraph 应用程序，可以通过探索部署和高级功能来进一步推进您的旅程：

* [Deployment quickstart](/langsmith/deployment-quickstart)：使用 LangSmith 部署 LangGraph 应用程序。

* [LangSmith](/langsmith/observability)：了解 LangSmith 的基本概念。

* [SDK Reference](https://reference.langchain.com/python/langsmith/deployment/sdk/)：探索 SDK API 参考。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/local-server.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>