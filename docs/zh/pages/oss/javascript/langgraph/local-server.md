<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Run a local server | https://docs.langchain.com/oss/javascript/langgraph/local-server -->

# 运行本地服务器

本指南向您展示如何在本地运行 LangGraph 应用程序。

## 先决条件

在开始之前，请确保您具备以下条件：

* [LangSmith](https://smith.langchain.com/settings) 的 API 密钥 - 免费注册

## 1. 安装 LangGraph CLI

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npm install --save-dev @langchain/langgraph-cli
```

## 2. 创建 LangGraph 应用程序

从 [⟦T14⟧ template](https://github.com/langchain-ai/new-langgraphjs-project) 创建一个新应用程序。该模板演示了您可以使用自己的逻辑进行扩展的单节点应用程序。

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npm create langgraph
```

<Accordion title="Adding LangGraph to an existing project">
  如果您有一个带有 LangGraph 代理的现有项目，您可以使用 `config` 命令自动生成 `langgraph.json` 配置文件：

  ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm create langgraph config
  ```

  此命令扫描您的项目中的 LangGraph 代理（例如 `createAgent()`、`StateGraph.compile()` 或 `workflow.compile()` 模式），并生成包含所有导出代理的配置文件。

  输出示例：

  ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  {
    "node_version": "24",
    "graphs": {
      "agent": "./src/agent.ts:agent",
      "searchAgent": "./src/search.ts:searchAgent"
    },
    "env": ".env"
  }
  ```

  <Tip>
    配置中仅包含**导出的**代理。如果未导出代理，该命令会警告您，以便您添加 `export` 关键字。
  </Tip>
</Accordion>

## 3.安装依赖项

在新 LangGraph 应用程序的根目录中，以 `edit` 模式安装依赖项，以便服务器使用本地更改：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
cd path/to/your/app
npm install
```

## 4. 创建`.env`文件您将在新 LangGraph 应用程序的根目录中找到一个 `.env.example`。在新 LangGraph 应用程序的根目录中创建一个 `.env` 文件，并将 `.env.example` 文件的内容复制到其中，填写必要的 API 密钥：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
LANGSMITH_API_KEY=lsv2...
```

## 5.启动代理服务器

本地启动 LangGraph API 服务器：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npx @langchain/langgraph-cli dev
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
```

`langgraph dev` 命令以内存模式启动 Agent Server。该模式适合开发和测试目的。对于生产使用，部署可以访问持久存储后端的代理服务器。欲了解更多信息，请参阅[Platform setup overview](/langsmith/platform-setup)。

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

## 7. 测试 API<Tabs>
  <Tab title="Javascript SDK">
    1.安装LangGraph JS SDK：
       ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
       npm install @langchain/langgraph-sdk
       ```
    2.向助手发送消息（无线程运行）：

    ```js theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Client } from "@langchain/langgraph-sdk";

    // only set the apiUrl if you changed the default port when calling langgraph dev
    const client = new Client({ apiUrl: "http://localhost:2024"});

    const streamResponse = client.runs.stream(
      null, // Threadless run
      "agent", // Assistant ID
      {
        input: {
          "messages": [
            { "role": "user", "content": "What is LangGraph?"}
          ]
        },
        streamMode: "messages-tuple",
      }
    );

    for await (const chunk of streamResponse) {
      console.log(`Receiving new event of type: ${chunk.event}...`);
      console.log(JSON.stringify(chunk.data));
      console.log("\n\n");
    }
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

## 后续步骤

现在您已经在本地运行了 LangGraph 应用程序，可以通过探索部署和高级功能来进一步推进您的旅程：

* [Deployment quickstart](/langsmith/deployment-quickstart)：使用 LangSmith 部署 LangGraph 应用程序。

* [LangSmith](/langsmith/observability)：了解 LangSmith 的基本概念。

* [SDK Reference](https://reference.langchain.com/javascript/modules/_langchain_langgraph-sdk.html)：探索 SDK API 参考。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/local-server.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>