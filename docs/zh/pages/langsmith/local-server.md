<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Local development & testing | https://docs.langchain.com/langsmith/local-server -->

# 本地开发和测试

> 比较 langgraph dev 和 langgraph up，以进行代理服务器应用程序的本地开发和类似生产的测试。

本指南介绍了如何在本地开发和测试 [Agent Server](/langsmith/agent-server) 应用程序。 [LangGraph CLI](/langsmith/cli) 提供了两个用于本地开发的命令，每个命令都针对工作流程的不同阶段进行了优化：

* [⟦T27⟧](#langgraph-dev)：快速迭代的轻量级开发服务器。
* [⟦T28⟧](#langgraph-up)：用于验证的类似生产的测试环境。

|特色 | `langgraph dev` | `langgraph up` |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **需要 Docker** |没有 |是的 |
| **安装** | `pip install langgraph-cli[inmem]` | `pip install langgraph-cli` || **主要用例** |快速开发和测试|类似生产的验证 |
| **状态持久性** |内存中并腌制到本地目录 | PostgreSQL |
| **热重载** |是（默认）|可选（`--watch`标志）|
| **默认端口** | `2024` | `8123` |
| **资源使用** |轻量化|更重（为服务器、PostgreSQL 和 Redis 构建和运行单独的 docker 容器）|
| **IDE 调试** |内置[DAP](https://microsoft.github.io/debug-adapter-protocol/)支持 |定期容器调试 || **自定义授权** |是的 |是（带有许可证密钥）|

<Tip>
  有关完整的参考详细信息，请参阅[LangGraph CLI reference](/langsmith/cli)页面。
</Tip>

## 发展

以下是构建应用程序时的典型工作流程：

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
flowchart LR
    A["Develop<br/><code>langgraph dev</code>"] --> B["Test Locally<br/><code>langgraph dev</code>"] --> C["Validate<br/><code>langgraph up</code>"] --> D["Deploy<br/>via UI or API"]

    style A fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    style B fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    style C fill:#FDF3FF,stroke:#7E65AE,stroke-width:2px,color:#504B5F
    style D fill:#F6FFDB,stroke:#6E8900,stroke-width:2px,color:#2E3900
```

|舞台|工具|目的|
| -------------------------- | ------------------------------------------- | -------------------------------------------------- |
| **本地开发和测试** | [⟦T36⟧](/langsmith/cli#dev) |通过热重载在图表上写入和迭代 |
| **验证** | [⟦T37⟧](/langsmith/cli#up) |使用完整堆栈测试类似生产的行为 |
| **部署** | [⟦T38⟧](/langsmith/cli#deploy) |充满信心地部署到生产中 |

### 推荐的工作流程

1. **日常开发**：使用`langgraph dev`进行快速迭代。
2. **定期验证**：使用`langgraph up`测试主要变更。
3. **部署前检查**：运行 `langgraph up --recreate` 进行全新构建。
4. **部署**：通过[LangSmith UI](/langsmith/deployment-quickstart)或[Control Plane API](/langsmith/api-ref-control-plane)推送到生产环境。

## `langgraph dev`[⟦T43⟧](/langsmith/cli#dev) 命令直接在您的环境中运行轻量级服务器，旨在提高主动开发过程中的速度和便利性。主要特点包括：

* **无需 Docker**：直接在您的环境中运行。
* **热重载**：更改代码时自动重新加载。
* **快速启动**：几秒钟内即可就绪。
* **内置 [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) 支持**：将 IDE 调试器连接到服务器以进行行级断点和调试。
* **本地存储**：状态保存到本地目录。

<Note>
  `dev` 服务器使用与生产相同的集成测试套件进行测试，以确保其行为在开发过程中相同，同时使用最少的资源。
</Note>

<Accordion title="Get started with langgraph dev">
  在开始之前，请确保您拥有：

  * [LangSmith](https://smith.langchain.com/settings) 的 API 密钥（免费注册）。
  * [uv](https://docs.astral.sh/uv/getting-started/installation/) 对于 Python 或 [npx](https://docs.npmjs.com/cli/commands/npx) 对于 TypeScript。

  <Steps>
    <Step title="Create a LangGraph app">
      从[⟦T45⟧ template](https://github.com/langchain-ai/new-langgraph-project)或[⟦T46⟧ template](https://github.com/langchain-ai/new-langgraphjs-project)创建一个新应用程序。该模板演示了您可以使用自己的逻辑进行扩展的单节点应用程序。

      <Tabs>
        <Tab title="Python server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          uvx --from langgraph-cli@latest langgraph new path/to/your/app --template new-langgraph-project-python
          ```
        </Tab>

        <Tab title="Node server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          npx @langchain/langgraph-cli new path/to/your/app --template new-langgraph-project-js
          ```
        </Tab>
      </Tabs><Tip>
        **附加模板**<br />
        如果您使用[⟦T47⟧](/langsmith/cli)而不指定模板，您将看到一个交互式菜单，允许您从可用模板列表中进行选择。
      </Tip>
    </Step>

    <Step title="Install dependencies">
      <Tabs>
        <Tab title="Python server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          cd path/to/your/app
          uv sync --dev -U
          ```
        </Tab>

        <Tab title="Node server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          cd path/to/your/app
          yarn install
          ```
        </Tab>
      </Tabs>
    </Step>

    <Step title="Launch Agent Server">
      <Tabs>
        <Tab title="Python server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          uv run langgraph dev
          ```
        </Tab>

        <Tab title="Node server">
          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          npx @langchain/langgraph-cli dev
          ```
        </Tab>
      </Tabs>

      示例输出：

      ```
      >    Ready!
      >
      >    - API: [http://localhost:2024](http://localhost:2024/)
      >
      >    - Docs: http://localhost:2024/docs
      >
      >    - Studio Web UI: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
      ```
    </Step>

    <Step title="Test the API">
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

        <Tab title="Javascript SDK">
          1.安装LangGraph JS SDK：

          ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          npm install @langchain/langgraph-sdk
          ```

          2.向助手发送消息（无线程运行）：

          ```js theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
          const { Client } = await import("@langchain/langgraph-sdk");

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
    </Step>
  </Steps>
</Accordion>### 用例

使用 `langgraph dev` 作为您的主要开发工具：

* **日常功能开发**：对代码进行更改，服务器会自动重新加载。立即测试，无需重建容器——非常适合快速迭代周期。

* **快速原型设计和实验**：在几秒钟内启动服务器来测试想法，无需 Docker 设置开销。

* **没有 Docker 的环境**：在 Docker 不可用的 CI/CD 管道或轻量级虚拟机中：
  ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  langgraph dev --no-browser
  ```

* **调试器附件**：使用 `--debug-port` 附加 IDE 调试器，以便在开发过程中进行逐步调试。

## `langgraph up`

[⟦T51⟧](/langsmith/cli#up) 命令编排了一个完整的基于 Docker 的堆栈，该堆栈镜像生产基础设施，有助于在生产之前捕获部署问题。主要特点包括：

* **验证构建和依赖关系**：测试您的构建过程和依赖关系。
* **隔离网络**：现实的容器网络。
* **生产验证**：验证部署准备情况。

<Accordion title="Get started with langgraph up">
  ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  # Ensure Docker is running
  docker ps

  # Start production-like stack
  langgraph up
  ```

  您的服务器从 `http://localhost:8123` 开始，具有完整的持久存储。
</Accordion>

### 用例

使用 `langgraph up` 进行验证和生产就绪测试：* **部署前验证**：在部署到生产环境之前，您可以使用全新构建运行最终检查，以确保您的依赖项均已正确指定。

  ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  langgraph up --recreate
  ```

  这可以捕获与容器中的依赖关系解析相关的问题以及任何其他构建过程问题。

* **主要功能验证**：实施重大更改后，定期使用完整的生产堆栈进行测试，以确保一切在容器化环境中正常运行。

* **Docker 故障排除**：调试仅在生产中出现的容器特定问题、网络问题或环境变量配置时。

## 部署前检查清单

在部署应用程序之前，请使用 `langgraph up` 验证以下内容：

* 所有[dependencies](/langsmith/setup-app-requirements-txt)正确安装在容器中。
* 应用程序启动时没有错误。
* 图表执行成功。
* 所有[environment variables](/langsmith/env-var-cloud)工作正常。
* [Authentication/authorization](/langsmith/cli#adding-custom-authentication) 按预期工作。

## 依赖配置

`langgraph dev`和`langgraph up`都从[configuration files](/langsmith/application-structure#configuration-file)读取应用程序的[dependencies](/langsmith/application-structure#dependencies)，但它们运行在不同的环境中：* **`langgraph dev`** 直接在本地环境（Python 或 Node.js）中运行代码，无需使用 Docker。
* **`langgraph up`** 构建一个 Docker 容器并在该隔离容器内运行您的代码。

正确配置依赖项可确保这两个命令正常工作，并且本地测试的内容与部署到生产环境的内容相匹配。

### `langgraph.json` 文件

`dependencies` 字段告诉 [CLI](/langsmith/cli) **在哪里**找到您的应用程序代码。 `dependencies`字段可以指向：

* **包含包配置的目录**（包含`pyproject.toml`、`setup.py`、`requirements.txt`或`package.json`）
* **特定子目录**：`"dependencies": ["./my_agent"]`
* **特定包**：`"dependencies": ["my-package==1.0.0"]` (Python) 或 `"dependencies": ["my-package@1.0.0"]` (JavaScript)

<Tabs>
  <Tab title="Python">
    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "dependencies": ["."],
      "graphs": {
        "my_agent": "./my_agent/agent.py:graph"
      },
      "env": "./.env"
    }
    ```
  </Tab>

  <Tab title="JavaScript">
    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "dependencies": ["."],
      "graphs": {
        "my_agent": "./my_agent/agent.js:graph"
      },
      "env": "./.env"
    }
    ```
  </Tab>
</Tabs>

### 包依赖文件

这些文件定义了您的应用程序需要的**什么**包：

<Tabs>
  <Tab title="Python">
    **pyproject.toml 示例：**

    ```toml theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    [project]
    name = "my-agent"
    version = "0.1.0"
    dependencies = [
        "langchain-openai",
        "langchain-anthropic",
        "langgraph",
    ]
    ```

    **requirements.txt示例：**

    ```
    langchain-openai
    langchain-anthropic
    langgraph
    ```
  </Tab>

  <Tab title="JavaScript">
    **package.json 示例：**

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "name": "my-agent",
      "version": "1.0.0",
      "dependencies": {
        "@langchain/openai": "^0.3.0",
        "@langchain/anthropic": "^0.3.0",
        "@langchain/langgraph": "^0.2.0"
      }
    }
    ```
  </Tab>
</Tabs>

### 依赖解析过程

当您运行 [⟦T69⟧](/langsmith/cli#up) 时，CLI 将按照以下步骤安装应用程序的依赖项：1. [⟦T70⟧](/langsmith/application-structure#configuration-file) 告诉 CLI **在哪里**查找您的应用程序代码。 `dependencies: ["."]`字段指向当前目录。
2. **查找包配置**：CLI 在该目录中查找包配置文件（[⟦T72⟧](/langsmith/setup-pyproject)、[⟦T73⟧](/langsmith/setup-app-requirements-txt) 或 [⟦T74⟧](/langsmith/setup-javascript)）。
3. **读取依赖项列表**：CLI 从配置文件中读取包列表。
4. **安装包**：CLI 使用适合您的语言的包管理器安装所有包（对于 Python 为`uv` 或 `pip`，对于 JavaScript 为`npm`）。

这种两个文件的方法分离了关注点：`langgraph.json`处理应用程序结构和位置，而包配置文件处理特定于语言的包依赖性。

有关安装程序的更多信息，请参阅[CLI configuration file](/langsmith/cli#configuration-file)。

### 故障排除

如果您遇到依赖安装问题，请尝试切换到`pip`：

```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
{
  "dependencies": ["."],
  "pip_installer": "pip"
}
```

然后重建：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
langgraph up --recreate
```

## 调试本地 Docker 设置

即使 `langgraph up` 在本地计算机上失败，生产部署也可能成功。发生这种情况是因为生产使用托管基础设施，而 `langgraph up` 在您的计算机上本地运行完整堆栈。

以下是不影响生产的常见本地环境问题。### Docker 配置问题

`langgraph up` 需要本地 Docker：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Check if Docker is running
docker ps
```

[Cloud deployments](/langsmith/cloud) 不要使用本地 Docker。

**解决方案**：安装Docker，或者使用`langgraph dev`进行本地测试。

### 端口冲突

`langgraph up` 使用可能被占用的端口 `8123`、`5432` 和 `6379`：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Check for conflicts
lsof -i :8123  # API server
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

**解决方案**：停止冲突的服务或使用 [⟦T88⟧](/langsmith/cli#dev) 标志。

### 资源限制

`langgraph up` 需要更多 RAM 和磁盘用于：

* PostgreSQL 容器
* Redis容器
* API服务器容器

**解决方案**：释放资源或使用`langgraph dev`。

### 网络配置

VPN 连接、防火墙规则或公司代理设置可能会影响本地 Docker 网络。

**解决方案**：使用`langgraph dev`进行测试或暂时禁用VPN/防火墙来隔离问题。

## 后续步骤

现在您已经在本地运行了一个 LangGraph 应用程序，您就可以部署它了：

**为 LangSmith 选择托管选项：**

* [**Cloud**](/langsmith/cloud)：最快设置，完全托管（推荐）。
* [**Self-hosted**](/langsmith/self-hosted)：完全控制您的基础设施。

更多详情请参阅[Platform setup comparison](/langsmith/platform-setup)。

**然后部署您的应用程序：**

* [Deploy to Cloud quickstart](/langsmith/deployment-quickstart)：快速设置指南。
* [Full Cloud setup guide](/langsmith/deploy-to-cloud)：全面的部署文档。

**探索功能：*** **[Studio](/langsmith/studio)**：使用 Studio UI 可视化、交互和调试您的应用程序。尝试一下[Studio quickstart](/langsmith/quick-start-studio)。
* **API 参考**：[LangSmith Deployment API](https://langchain-ai.github.io/langgraph/cloud/reference/api/api_ref/)、[Python SDK](/langsmith/langgraph-python-sdk)、[JS/TS SDK](/langsmith/langgraph-js-ts-sdk)

## 相关资源

* [CLI Reference](/langsmith/cli)：所有 CLI 命令的详细文档
* [Application Structure](/langsmith/application-structure)：如何构建 LangGraph 应用程序
* [Troubleshooting](/langsmith/troubleshooting-studio)：常见问题及解决方案
* [Setting up with pyproject.toml](/langsmith/setup-pyproject)：配置Python依赖
* [Setting up with requirements.txt](/langsmith/setup-app-requirements-txt)：替代依赖配置

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/local-dev-testing.mdx) 或[file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>