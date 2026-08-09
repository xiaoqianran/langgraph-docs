<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph CLI | https://docs.langchain.com/langsmith/cli -->

# LangGraph CLI

**LangGraph CLI** 是一个用于在本地构建和运行 [Agent Server](/langsmith/agent-server) 的命令行工具。生成的服务器公开运行、线程、助手等的所有 API 端点，并包括支持服务，例如用于检查点和存储的托管数据库。

## 安装

1. 确保安装了 Docker（例如 `docker --version`）。

2. 安装 CLI：

   <CodeGroup>
     ```bash [Python (pip)] theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
     pip install langgraph-cli
     ```

     ```bash JavaScript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
     # Use latest on demand
     npx @langchain/langgraph-cli

     # Or install globally (available as `langgraphjs`)
     npm install -g @langchain/langgraph-cli
     ```
   </CodeGroup>

3.验证安装

   <CodeGroup>
     ```bash [Python (pip)] theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
     langgraph --help
     ```

     ```bash JavaScript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
     npx @langchain/langgraph-cli --help
     ```
   </CodeGroup>

### 快速命令|命令 |它有什么作用 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [⟦T43⟧](#dev) |启动轻量级本地开发服务器（不需要 Docker），非常适合快速测试。                                                 |
| [⟦T44⟧](#build) |构建 LangGraph API 服务器的 Docker 映像以进行部署。                                                                   |
| [⟦T45⟧](#deploy) |只需一步即可构建 LangGraph 映像并将其直接部署到 LangSmith 部署。                                             |
| [⟦T46⟧](#dockerfile) |发出从您的配置派生的 Dockerfile 以进行自定义构建。                                                                       |
| [⟦T47⟧](#up) |在 Docker 中本地启动 LangGraph API 服务器。需要 Docker 运行；用于本地开发的 LangSmith API 密钥；生产许可证。 |

对于 JS，使用 `npx @langchain/langgraph-cli <command>` （或 `langgraphjs` 如果全局安装）。## 配置文件

要构建并运行有效的应用程序，LangGraph CLI 需要遵循此[schema](https://raw.githubusercontent.com/langchain-ai/langgraph/refs/heads/main/libs/cli/schemas/schema.json) 的 JSON 配置文件。它包含以下属性：

<Note>LangGraph CLI 默认使用当前目录中名为 <strong>langgraph.json</strong> 的配置文件。</Note>

<Tabs>
  <Tab title="Python">
    |关键|描述|| ---------------------------------------------------------------- | ————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ || <span style={{ whiteSpace: "nowrap" }}>`dependencies`</span> | **必需的**。 LangSmith API 服务器的依赖项数组。依赖项可以是以下之一： <ul><li>单个句点 (`"."`)，它将查找本地 Python 包。</li><li>`pyproject.toml`、`setup.py` 或 `requirements.txt` 所在的目录路径位于。<br />例如，如果`requirements.txt`位于项目根目录，则指定`"./"`。如果它位于名为 `local_package` 的子目录中，请指定 `"./local_package"`。不要指定字符串 `"requirements.txt"` 本身。</li><li>Python 包名称。</li></ul>|| <span style={{ whiteSpace: "nowrap" }}>`graphs`</span> | **必需的**。从图形 ID 映射到定义已编译图形或生成图形的函数的路径。示例：<ul><li>`./your_package/your_file.py:variable`，其中`variable`是`langgraph.graph.state.CompiledStateGraph`</li><li>`./your_package/your_file.py:make_graph`的实例，其中`make_graph`是采用配置字典的函数(`langchain_core.runnables.RunnableConfig`) 并返回`langgraph.graph.state.StateGraph`或`langgraph.graph.state.CompiledStateGraph`的实例。更多详情请参见[how to rebuild a graph at runtime](/langsmith/graph-rebuild)。</li></ul>|
    | <span style={{ whiteSpace: "nowrap" }}>`auth`</span> | *（在 v0.0.11 中添加）* 包含身份验证处理程序路径的身份验证配置。示例：`./your_package/auth.py:auth`，其中 `auth` 是 `langgraph_sdk.Auth` 的实例。详情请参阅[authentication guide](/langsmith/auth)。|| <span style={{ whiteSpace: "nowrap" }}>`base_image`</span> |选修的。用于 LangGraph API 服务器的基础镜像。默认为 `langchain/langgraph-api` 或 `langchain/langgraphjs-api`。使用它可以将您的构建固定到 langgraph API 的特定版本，例如 `"langchain/langgraph-server:0.2"`。更多详情请参见[https://hub.docker.com/r/langchain/langgraph-server/tags](https://hub.docker.com/r/langchain/langgraph-server/tags)。 （`langgraph-cli==0.2.8`添加）|| <span style={{ whiteSpace: "nowrap" }}>`image_distro`</span> |选修的。基础镜像的 Linux 发行版。必须是 `"debian"`、`"wolfi"`、`"bookworm"` 或 `"bullseye"` 之一。如果省略，则默认为`"debian"`。提供`langgraph-cli>=0.2.11`。|| <span style={{ whiteSpace: "nowrap" }}>`env`</span> | `.env` 文件的路径或从环境变量到其值的映射。|| <span style={{ whiteSpace: "nowrap" }}>`store`</span> |用于向 BaseStore 添加语义搜索和/或生存时间 (TTL) 的配置。包含以下字段： <ul><li>`index`（可选）：使用字段 `embed`、`dims` 和可选 `fields`.</li><li>`ttl`（可选）进行语义搜索索引配置：项目过期的配置。具有可选字段的对象：`refresh_on_read`（布尔值，默认为`true`），`default_ttl`（浮点型，生命周期以**分钟**为单位；仅适用于新创建的项目；现有项目不变；默认不过期）和`sweep_interval_minutes`（整数，检查过期项目的频率，默认为否扫）。</li></ul>|| <span style={{ whiteSpace: "nowrap" }}>`ui`</span> |选修的。代理发出的 UI 组件的命名定义，每个组件都指向一个 JS/TS 文件。 （`langgraph-cli==0.1.84`添加）|| <span style={{ whiteSpace: "nowrap" }}>`python_version`</span> | `3.11`、`3.12` 或 `3.13`。默认为`3.11`。|| <span style={{ whiteSpace: "nowrap" }}>`node_version`</span> |指定 `node_version: 20` 使用 LangGraph.js。|| <span style={{ whiteSpace: "nowrap" }}>`pip_config_file`</span> | `pip` 配置文件的路径。|| <span style={{ whiteSpace: "nowrap" }}>`pip_installer`</span> | *（在 v0.3 中添加）* 可选。 Python 包安装程序选择器。可设置为 `"auto"`、`"pip"` 或 `"uv"`。从版本 0.3 开始，默认策略是运行 `uv pip`，它通常可以提供更快的构建，同时保持直接替代。在不常见的情况下，`uv`无法处理您的依赖图或`pyproject.toml`的结构，请在此处指定`"pip"`以恢复到之前的行为。|| <span style={{ whiteSpace: "nowrap" }}>`keep_pkg_tools`</span> | *（在 v0.3.4 中添加）* 可选。控制最终镜像中是否保留Python打包工具（`pip`、`setuptools`、`wheel`）。接受的值： <ul><li><code>true</code> ：保留所有三个工具（跳过卸载）。</li><li><code>false</code> / 省略：卸载所有三个工具（默认）行为）。</li><li><code>list\[str]</code>：<strong>要保留</strong>的工具名称。每个值必须是“pip”、“setuptools”、“wheel”之一。</li></ul>。默认情况下，所有三个工具均已卸载。|| <span style={{ whiteSpace: "nowrap" }}>`dockerfile_lines`</span> |从父映像导入后添加到 Dockerfile 的附加行数组。|| <span style={{ whiteSpace: "nowrap" }}>`checkpointer`</span> |检查点的配置。支持：<ul><li>`backend`（可选）：`"default"`、`"mongo"`或`"custom"`。默认为 `"default"` (PostgreSQL)。请参阅[Configure checkpointer backend](/langsmith/configure-checkpointer)。</li><li>`path`（可选）：自定义检查点工厂的路径（当`backend`为`"custom"`时）。请参阅 [Custom checkpointer](/langsmith/custom-checkpointer)。</li><li>`ttl`（可选）：具有 `strategy`、`sweep_interval_minutes`、`default_ttl` 和 `sweep_limit`（代理服务器 v0.8+）控制检查点的对象过期。</li><li>`serde`（可选，代理服务器 v0.5+）：具有 `allowed_json_modules` 和 `pickle_fallback` 的对象，用于调整反序列化行为。</li></ul>|| <span style={{ whiteSpace: "nowrap" }}>`http`</span> |具有以下字段的 HTTP 服务器配置： <ul><li>`app`：自定义 Starlette/FastAPI 应用程序的路径（例如，`"./src/agent/webapp.py:app"`）。请参阅[custom routes guide](/langsmith/custom-routes)。</li><li>`cors`：CORS 配置，包含`allow_origins`、`allow_methods`、`allow_headers`、`allow_credentials`、`allow_origin_regex`、 `expose_headers`和`max_age`。</li><li>`configurable_headers`：定义通过`includes` / `excludes`将哪些请求标头公开为可配置值模式。</li><li>`logging_headers`：`configurable_headers`的镜像，用于从日志中排除敏感标头。</li><li>`middleware_order`：选择自定义中间件和身份验证的交互方式。 `auth_first` 在自定义中间件之前运行身份验证挂钩，而`middleware_first`（默认）首先运行中间件。</li><li>`enable_custom_route_auth`：对通过`app`添加的路由应用身份验证检查。</li><li>路由禁用flags — 有选择地关闭内置端点组：<ul><li>`disable_meta`：禁用 `/`（根）、`/info`、`/metrics`、`/docs` 和 `/openapi.json` 系统路由。 `/ok` 健康检查仍然可用。</li><li>`disable_assistants`：禁用所有 `/assistants/*` 路由。</li><li>`disable_runs`：禁用所有 `/runs/*`路线。</li><li>`disable_threads`：禁用所有`/threads/*`路线。</li><li>`disable_store`：禁用所有`/store/*`路线。</li><li>`disable_ui`：禁用所有`/ui/*`路线。</li><li>`disable_mcp`：禁用`/mcp`端点。请参阅[Disable MCP](/langsmith/server-mcp#disable-mcp)。</li><li>`disable_a2a`：禁用`/a2a/*`端点。请参阅[Disable A2A](/langsmith/server-a2a#disable-a2a)。</li><li>`disable_webhooks`：在运行完成时禁用 Webhook 传递（不是路由切换）。请参阅 [Disable webhooks](/langsmith/use-webhooks#disable-webhooks)。</li></ul></li><li>`mount_prefix`：挂载路由的前缀（例如“/my-deployment/api”）。</li></ul> |
    | <span style={{ whiteSpace: "nowrap" }}>`webhooks`</span> | *（在 v0.5.36 中添加）* 出站 Webhook 传递的配置。包含： <ul><li>`env_prefix`：标头模板中引用的环境变量所需的前缀（默认为`LG_WEBHOOK_`）。</li><li>`headers`：要包含在 Webhook 请求中的静态标头。值可能包含类似 `${{ env.VAR }}`.</li><li>`url` 的模板：带有 `allowed_domains`、`allowed_ports`、`require_https`、`disable_loopback` 的 URL 验证策略和`max_url_length`.</li></ul>|| <span style={{ whiteSpace: "nowrap" }}>`api_version`</span> | *（在 v0.3.7 中添加）* 使用 LangGraph API 服务器的语义版本（例如，`"0.3"`）。默认为最新。检查服务器[changelog](/langsmith/agent-server-changelog)以获取每个版本的详细信息。|
  </Tab><Tab title="JS">
    |关键|描述 || ---------------------------------------------------------------- | ————————————————————————————————————————————————————————————————————————————————————————————————————————| <span style={{ whiteSpace: "nowrap" }}>`graphs`</span> | **必需的**。从图形 ID 映射到定义已编译图形或生成图形的函数的路径。示例：<ul><li>`./src/graph.ts:variable`，其中`variable`是[⟦T198⟧](https://reference.langchain.com/python/langgraph/graph/state/CompiledStateGraph)</li><li>`./src/graph.ts:makeGraph`的实例，其中`makeGraph`是采用配置字典的函数(`LangGraphRunnableConfig`) 并返回[⟦T202⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)或[⟦T203⟧](https://reference.langchain.com/python/langgraph/graph/state/CompiledStateGraph)的实例。详情请参阅[how to rebuild a graph at runtime](/langsmith/graph-rebuild)。</li></ul> |
    | <span style={{ whiteSpace: "nowrap" }}>`env`</span> | `.env` 文件的路径或从环境变量到其值的映射。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             || <span style={{ whiteSpace: "nowrap" }}>`store`</span> |用于向 BaseStore 添加语义搜索和/或生存时间 (TTL) 的配置。包含以下字段： <ul><li>`index`（可选）：使用字段 `embed`、`dims` 和可选字段进行语义搜索索引配置`fields`.</li><li>`ttl`（可选）：项目过期配置。具有可选字段的对象：`refresh_on_read`（布尔值，默认为`true`），`default_ttl`（浮点型，生命周期以**分钟**为单位；仅适用于新创建的项目；现有项目不变；默认不过期）和`sweep_interval_minutes`（整数，检查过期项目的频率，默认为否扫）。</li></ul> || <span style={{ whiteSpace: "nowrap" }}>`node_version`</span> |指定 `node_version: 20` 使用 LangGraph.js。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      || <span style={{ whiteSpace: "nowrap" }}>`dockerfile_lines`</span> |从父映像导入后添加到 Dockerfile 的附加行数组。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               || <span style={{ whiteSpace: "nowrap" }}>`checkpointer`</span> |检查点的配置。支持：<ul><li>`backend`（可选）：`"default"`、`"mongo"`或`"custom"`。默认为 `"default"` (PostgreSQL)。请参阅[Configure checkpointer backend](/langsmith/configure-checkpointer)。</li><li>`path`（可选）：自定义检查点工厂的路径（当`backend`为`"custom"`时）。请参阅 [Custom checkpointer](/langsmith/custom-checkpointer)。</li><li>`ttl`（可选）：具有 `strategy`、`sweep_interval_minutes`、`default_ttl` 和 `sweep_limit`（代理服务器 v0.8+）控制检查点的对象</li><li>`serde`（可选，代理服务器 v0.5+）：具有 `allowed_json_modules` 和 `pickle_fallback` 的对象，用于调整反序列化行为。</li></ul> || <span style={{ whiteSpace: "nowrap" }}>`http`</span> | HTTP 服务器配置镜像 Python 选项：<ul><li>`cors` 与 `allow_origins`、`allow_methods`、`allow_headers`、`allow_credentials`、`allow_origin_regex`、`expose_headers`、 `max_age`。</li><li>`configurable_headers` 和 `logging_headers` 模式列表。</li><li>`middleware_order`（`auth_first` 或`middleware_first`)。</li><li>`enable_custom_route_auth`加上与上面相同的布尔路由切换。</li></ul> || <span style={{ whiteSpace: "nowrap" }}>`webhooks`</span> | *（在 v0.5.36 中添加）* 出站 Webhook 传递的配置。包含： <ul><li>`env_prefix`：标头模板中引用的环境变量所需的前缀（默认为`LG_WEBHOOK_`）。</li><li>`headers`：Webhook 请求中包含的静态标头。值可能包含类似 `${{ env.VAR }}`.</li><li>`url` 的模板：具有 `allowed_domains`、`allowed_ports`、`require_https`、`disable_loopback` 的 URL 验证策略和`max_url_length`.</li></ul> || <span style={{ whiteSpace: "nowrap" }}>`api_version`</span> | *（在 v0.3.7 中添加）* 使用 LangGraph API 服务器的语义版本（例如，`"0.3"`）。默认为最新。检查服务器[changelog](/langsmith/agent-server-changelog)以了解每个版本的详细信息。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  </Tab>
</Tabs>

### 示例

<Tabs>
  <Tab title="Python">
    #### 基本配置

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      }
    }
    ```

    #### 使用 Wolfi 基础镜像

    您可以使用 `image_distro` 字段指定基础映像的 Linux 发行版。有效选项为 `debian`、`wolfi`、`bookworm` 或 `bullseye`。 Wolfi 是推荐的选项，因为它提供更小、更安全的图像。这在 `langgraph-cli>=0.2.11` 中可用。

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "image_distro": "wolfi"
    }
    ```

    #### 向商店添加语义搜索所有部署都带有数据库支持的 BaseStore。向 `langgraph.json` 添加“索引”配置将在部署的 BaseStore 中启用 [semantic search](/langsmith/semantic-search)。

    `index.fields` 配置决定要嵌入文档的哪些部分：

    * 如果省略或设置为`["$"]`，则将嵌入整个文档
    * 要嵌入特定字段，请使用 JSON 路径表示法：`["metadata.title", "content.text"]`
    * 缺少指定字段的文档仍将被存储，但不会嵌入这些字段
    * 您仍然可以使用 `index` 参数覆盖在 `put` 时间嵌入特定项目的字段

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "dependencies": ["."],
      "graphs": {
        "memory_agent": "./agent/graph.py:graph"
      },
      "store": {
        "index": {
          "embed": "openai:text-embedding-3-small",
          "dims": 1536,
          "fields": ["$"]
        }
      }
    }
    ```

    <Note>
      **常用型号尺寸**

      *`openai:text-embedding-3-large`：3072
      *`openai:text-embedding-3-small`：1536
      *`openai:text-embedding-ada-002`：1536
      *`cohere:embed-english-v3.0`：1024
      *`cohere:embed-english-light-v3.0`：384
      *`cohere:embed-multilingual-v3.0`：1024
      *`cohere:embed-multilingual-light-v3.0`：384
    </Note>

    #### 使用自定义嵌入函数进行语义搜索

    如果您想将语义搜索与自定义嵌入函数一起使用，您可以将路径传递给自定义嵌入函数：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "dependencies": ["."],
      "graphs": {
        "memory_agent": "./agent/graph.py:graph"
      },
      "store": {
        "index": {
          "embed": "./embeddings.py:embed_texts",
          "dims": 768,
          "fields": ["text", "summary"]
        }
      }
    }
    ```

    商店配置中的 `embed` 字段可以引用自定义函数，该函数接受字符串列表并返回嵌入列表。实施示例：

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    # embeddings.py
    def embed_texts(texts: list[str]) -> list[list[float]]:
        """Custom embedding function for semantic search."""
        # Implementation using your preferred embedding model
        return [[0.1, 0.2, ...] for _ in texts]  # dims-dimensional vectors
    ```#### 添加自定义身份验证

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "auth": {
        "path": "./auth.py:auth",
        "openapi": {
          "securitySchemes": {
            "apiKeyAuth": {
              "type": "apiKey",
              "in": "header",
              "name": "X-API-Key"
            }
          },
          "security": [{ "apiKeyAuth": [] }]
        },
        "disable_studio_auth": false
      }
    }
    ```

    有关详细信息，请参阅 [authentication conceptual guide](/langsmith/auth)，有关该过程的实际演练，请参阅 [setting up custom authentication](/langsmith/set-up-custom-auth) 指南。

    <a id="ttl" />

    #### 配置商店商品的生存时间

    您可以使用 `store.ttl` 键为 BaseStore 中的项目/内存配置默认数据过期时间。这决定了项目在上次访问后保留的时间（读取可能会根据`refresh_on_read`刷新计时器）。请注意，可以通过修改 `get`、`search` 等中的相应参数来覆盖每次调用的默认值。

    `ttl` 配置是一个包含可选字段的对象：

    * `refresh_on_read`：如果`true`（默认），通过`get`或`search`访问项目会重置其过期计时器。设置为 `false` 仅在写入时刷新 TTL (`put`)。
    * `default_ttl`：项目的默认寿命（以**分钟**为单位）。仅适用于新创建的项目；现有项目不会被修改。如果未设置，则默认情况下项目不会过期。
    * `sweep_interval_minutes`：系统应运行后台进程来删除过期项目的频率（以分钟为单位）。如果未设置，则不会自动进行扫描。下面是一个启用 7 天 TTL（10080 分钟）、读取刷新并每小时扫描的示例：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "memory_agent": "./agent/graph.py:graph"
      },
      "store": {
        "ttl": {
          "refresh_on_read": true,
          "sweep_interval_minutes": 60,
          "default_ttl": 10080
        }
      }
    }
    ```

    <a id="ttl" />

    #### 配置检查点生存时间

    您可以使用 `checkpointer` 键配置检查点的生存时间 (TTL)。这决定了检查点数据在根据指定策略（例如删除）自动处理之前保留多长时间。支持两个可选的子对象：

    * `ttl`：包括`strategy`、`sweep_interval_minutes`、`default_ttl`和`sweep_limit`（代理服务器 v0.8+），它们共同设置检查点的过期方式。
    * `serde` *(代理服务器 v0.5+)* ：允许您控制检查点有效负载的反序列化行为。

    以下是将默认 TTL 设置为 30 天（43200 分钟）的示例：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "checkpointer": {
        "ttl": {
          "strategy": "delete",
          "sweep_interval_minutes": 10,
          "default_ttl": 43200
        }
      }
    }
    ```

    在此示例中，超过 30 天的检查点将被删除，并且检查每 10 分钟运行一次。

    #### 配置检查点 serde

    `checkpointer.serde`对象形状反序列化：* `allowed_json_modules` 定义自定义 Python 对象的允许列表，您希望服务器能够从以“json”模式保存的有效负载进行反序列化。这是`[path, to, module, file, symbol]`序列的列表。如果省略，则仅允许 LangChain 安全的默认值。您可以不安全地设置为 `true` 以允许任何模块被反序列化。
    * `pickle_fallback`：JSON解码失败时是否回退到pickle反序列化。

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "checkpointer": {
        "serde": {
          "allowed_json_modules": [
            ["my_agent", "auth", "SessionState"]
          ]
        }
      }
    }
    ```

    #### 自定义 HTTP 中间件和标头

    `http` 块可让您微调请求处理：

    * `middleware_order`：选择 `"auth_first"` 在中间件之前运行身份验证，或选择 `"middleware_first"`（默认）来反转该顺序。
    * `enable_custom_route_auth`：将身份验证扩展到通过`http.app`挂载的路由。
    * `configurable_headers` / `logging_headers`：每个都接受一个带有可选 `includes` 和 `excludes` 数组的对象；支持通配符，并且排除在包含之前运行。
    * `cors`：自定义服务器的 CORS（跨源资源共享）配置。用于配置 CORS 的示例 `langgraph.json` 文件：

      ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      {
        ...
        "http": {
          "cors": {
            "allow_origins": ["https://example.com", "https://app.example.com"],
            "allow_methods": ["GET", "POST"],
            "allow_headers": ["Authorization", "Content-Type"],
            "allow_credentials": true,
            "allow_origin_regex": "^https://.*\\.example\\.com$",
            "expose_headers": ["x-pagination-total", "x-pagination-next", "x-request-id"],
            "max_age": 600
          }
        },
        ...
      }
      ```

          <Note>
            自定义服务器的 CORS 配置将覆盖设置 [⟦T321⟧ environment variable](/langsmith/env-var-cloud) 的功能。
          </Note>

    #### 配置网络钩子您可以为出站 Webhook 请求配置自定义标头和 URL 限制：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "webhooks": {
        "headers": {
          "Authorization": "Bearer ${{ env.LG_WEBHOOK_TOKEN }}"
        },
        "url": {
          "allowed_domains": ["*.mycompany.com"],
          "require_https": true
        }
      }
    }
    ```

    有关标头配置、环境变量模板和 URL 限制的详细信息，请参阅[Use webhooks](/langsmith/use-webhooks#add-headers-to-webhook-requests)。

    <a id="api-version" />

    #### 固定 API 版本

    *（在 v0.3.7 中添加）*

    您可以使用 `api_version` 密钥固定代理服务器的 API 版本。如果您想确保您的服务器使用特定版本的 API，这非常有用。
    默认情况下，云部署中的构建使用服务器的最新稳定版本。这可以通过将 `api_version` 键设置为特定版本来固定。

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "api_version": "0.2"
    }
    ```

    #### 禁用内置路由

    您可以使用 `http` 配置块中的布尔标志有选择地禁用内置 HTTP 路由组。这对于您想要最小化服务器暴露表面积的生产部署非常有用。

    例如，要禁用系统信息和文档路由：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "chat.graph:graph"
      },
      "http": {
        "disable_meta": true
      }
    }
    ```

    将 `disable_meta` 设置为 `true` 会禁用以下路由：* `/` — 根健康检查
    * `/info` — 服务器版本和配置信息
    * `/metrics` — Prometheus 和 JSON 指标
    * `/docs` — API 文档 UI
    * `/openapi.json` — OpenAPI 规范

    即使设置了 `disable_meta`，`/ok` 运行状况检查端点仍然可用，因此 Kubernetes 等编排器仍然可以执行活性和就绪性探测。

    其他路由禁用标志包括`disable_assistants`、`disable_runs`、`disable_threads`、`disable_store`和`disable_ui`。对于 MCP、A2A 和 webhook，请参阅各自的指南：[Disable MCP](/langsmith/server-mcp#disable-mcp)、[Disable A2A](/langsmith/server-a2a#disable-a2a)、[Disable webhooks](/langsmith/use-webhooks#disable-webhooks)。
  </Tab>

  <Tab title="JS">
    #### 基本配置

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "graphs": {
        "chat": "./src/graph.ts:graph"
      }
    }
    ```

    <a id="api-version" />

    #### 固定 API 版本

    *（在 v0.3.7 中添加）*

    您可以使用 `api_version` 键固定代理服务器的 API 版本。如果您想确保您的服务器使用特定版本的 API，这非常有用。
    默认情况下，云部署中的构建使用服务器的最新稳定版本。这可以通过将 `api_version` 键设置为特定版本来固定。

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "dependencies": ["."],
      "graphs": {
        "chat": "./src/chat/graph.ts:graph"
      },
      "api_version": "0.2"
    }
    ```

    #### 禁用内置路由您可以使用 `http` 配置块中的布尔标志有选择地禁用内置 HTTP 路由组。这对于您想要最小化服务器暴露表面积的生产部署非常有用。

    例如，要禁用系统信息和文档路由：

    ```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      "$schema": "https://langgra.ph/schema.json",
      "graphs": {
        "chat": "./src/chat/graph.ts:graph"
      },
      "http": {
        "disable_meta": true
      }
    }
    ```

    将 `disable_meta` 设置为 `true` 会禁用以下路由：

    * `/` — 根健康检查
    * `/info` — 服务器版本和配置信息
    * `/metrics` — Prometheus 和 JSON 指标
    * `/docs` — API 文档 UI
    * `/openapi.json` — OpenAPI 规范

    即使设置了 `disable_meta`，`/ok` 运行状况检查端点仍然可用，因此 Kubernetes 等编排器仍然可以执行活性和就绪性探测。

    其他路由禁用标志包括 `disable_assistants`、`disable_runs`、`disable_threads`、`disable_store` 和 `disable_ui`。对于 MCP、A2A 和 webhook，请参阅各自的指南：[Disable MCP](/langsmith/server-mcp#disable-mcp)、[Disable A2A](/langsmith/server-a2a#disable-a2a)、[Disable webhooks](/langsmith/use-webhooks#disable-webhooks)。
  </Tab>
</Tabs>

## 命令

**使用**

<Tabs>
  <Tab title="Python">
    LangGraph CLI 的基本命令是`langgraph`。

    ```
    langgraph [OPTIONS] COMMAND [ARGS]
    ```
  </Tab>

  <Tab title="JS">
    LangGraph.js CLI 的基本命令是 `langgraphjs`。

    ```
    npx @langchain/langgraph-cli [OPTIONS] COMMAND [ARGS]
    ```我们建议使用 `npx` 来始终使用最新版本的 CLI。
  </Tab>
</Tabs>

### `dev`

<Tabs>
  <Tab title="Python">
    在开发模式下运行 LangGraph API 服务器，具有热重载和调试功能。这种轻量级服务器不需要安装 Docker，适合开发和测试。状态保存到本地目录。

    <Note>目前 CLI 仅支持 Python >= 3.11。</Note>

    <Tip>
      如果您需要了解何时使用`langgraph dev`与`langgraph up`的更多信息，请参阅[Local development & testing guide](/langsmith/local-dev-testing)进行详细比较。
    </Tip>

    **安装**

    此命令需要安装额外的“inmem”：

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    pip install -U "langgraph-cli[inmem]"
    ```

    **使用**

    ```
    langgraph dev [OPTIONS]
    ```

    **选项**|选项|默认|描述 |
    | -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图形和环境变量的配置文件路径 |
    | `--host TEXT` | `127.0.0.1` |将服务器绑定到的主机 |
    | `--port INTEGER` | `2024` |将服务器绑定到的端口 || `--no-reload` |                  |禁用自动重新加载 |
    | `--n-jobs-per-worker INTEGER` |                  |每个工人的工作数量。默认值为 10 |
    | `--debug-port INTEGER` |                  |调试器监听的端口 |
    | `--wait-for-client` | `False` |在启动服务器之前等待调试器客户端连接到调试端口 |
    | `--no-browser` |                  |跳过服务器启动时自动打开浏览器 || `--studio-url TEXT` |                  |要连接的 Studio 实例的 URL。默认为 [https://smith.langchain.com](https://smith.langchain.com) |
    | `--allow-blocking` | `False` |不要在代码中引发同步 I/O 阻塞操作的错误（在 `0.2.6` 中添加）|
    | `--tunnel` | `False` |通过公共隧道 (Cloudflare) 公开本地服务器以进行远程前端访问。这可以避免 Safari 等浏览器或网络阻止本地主机连接出现问题 |
    | `--help` |                  |显示命令文档 |
  </Tab>

  <Tab title="JS">
    在开发模式下运行具有热重载功能的 LangGraph API 服务器。这种轻量级服务器不需要安装 Docker，适合开发和测试。状态保存到本地目录。

    **使用**

    ```
    npx @langchain/langgraph-cli dev [OPTIONS]
    ```

    **选项**|选项|默认|描述 |
    | -------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图形和环境变量的配置文件路径 |
    | `--host TEXT` | `127.0.0.1` |将服务器绑定到的主机 |
    | `--port INTEGER` | `2024` |将服务器绑定到的端口 || `--no-reload` |                  |禁用自动重新加载 |
    | `--n-jobs-per-worker INTEGER` |                  |每个工人的工作数量。默认值为 10 |
    | `--debug-port INTEGER` |                  |调试器监听的端口 |
    | `--wait-for-client` | `False` |在启动服务器之前等待调试器客户端连接到调试端口 |
    | `--no-browser` |                  |跳过服务器启动时自动打开浏览器 |
    | `--studio-url TEXT` |                  |要连接的 Studio 实例的 URL。默认为 [https://smith.langchain.com](https://smith.langchain.com) || `--allow-blocking` | `False` |不要在代码中引发同步 I/O 阻塞操作的错误 |
    | `--tunnel` | `False` |通过公共隧道 (Cloudflare) 公开本地服务器以进行远程前端访问。这可以避免浏览器或网络阻止本地主机连接的问题 |
    | `--help` |                  |显示命令文档 |
  </Tab>
</Tabs>

### `build`

<Tabs>
  <Tab title="Python">
    构建 LangSmith API 服务器 Docker 镜像。

    **使用**

    ```
    langgraph build [OPTIONS]
    ```

    **选项**|选项 |默认|描述 |
    | -------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `--platform TEXT`​​ |                  |要为其构建 Docker 映像的目标平台。示例：`langgraph build --platform linux/amd64,linux/arm64` |
    | `-t, --tag TEXT` |                  | **必需的**。 Docker 镜像的标签。示例：`langgraph build -t my-image` |
    | `--pull / --no-pull` | `--pull` |使用最新的远程 Docker 镜像进行构建。使用 `--no-pull` 运行带有本地构建图像的 LangSmith API 服务器。                                  |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图表和环境变量的配置文件的路径。                                                                    || `--build-command TEXT`<sup>\*</sup> |                  |构建要运行的命令。从 `langgraph.json` 文件所在的目录运行。示例：`langgraph build --build-command "yarn run turbo build"` |
    | `--install-command TEXT`<sup>\*</sup> |                  |安装命令运行。从您调用 `langgraph build` 的目录运行。示例：`langgraph build --install-command "yarn install"` |
    | `--help` |                  |显示命令文档。                                                                                                                          |

    <sup>\*</sup>仅支持 JS 部署，对 Python 部署没有影响。
  </Tab>

  <Tab title="JS">
    构建 LangSmith API 服务器 Docker 镜像。

    **使用**

    ```
    npx @langchain/langgraph-cli build [OPTIONS]
    ```

    **选项**|选项|默认|描述 |
    | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
    | `--platform TEXT` |                  |要为其构建 Docker 映像的目标平台。示例：`langgraph build --platform linux/amd64,linux/arm64` |
    | `-t, --tag TEXT` |                  | **必需的**。 Docker 镜像的标签。示例：`langgraph build -t my-image` |
    | `--no-pull` |                  |使用本地构建的图像。默认为 `false` 使用最新的远程 Docker 镜像进行构建。                         |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图表和环境变量的配置文件的路径。                            |
    | `--help` |                  |显示命令文档。                                                                                  |
  </Tab>
</Tabs>

### `deploy`

<Tabs>
  <Tab title="Python">
    <Note>此命令位于 [beta](/langsmith/release-stages) 中并且正在积极开发中。期待频繁的更新和改进。</Note>构建 LangGraph 镜像并将其直接部署到[LangSmith Deployments](/langsmith/deployment)。此命令在本地构建 Docker 映像，将其推送到托管注册表，并创建或更新部署 - 所有这些都只需一步即可完成。如果未安装 Docker，则会触发远程构建。

    **先决条件**

    * 具有部署访问权限的[**LangSmith API key**](/langsmith/create-account-api-key)。
    * （可选）必须安装 **Docker** 并且必须运行 Docker 守护进程以进行本地构建。远程构建不需要。 [Install Docker Desktop](https://docs.docker.com/get-docker/)。

    <Note>仅适用于 LangSmith Cloud。</Note>

    **使用**

    ```
    langgraph deploy [OPTIONS] [DOCKER_BUILD_ARGS]
    ```

    此命令还接受所有 [⟦T426⟧](#build) 标志（`--platform`、`-t`、`--pull`、`--no-pull`、`-c`）。详情请参阅`langgraph build --help`。

    **选项**|选项 |默认|描述 |
    | ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `--api-key TEXT` |                        | LangSmith 部署的 API 密钥。也可以通过 `LANGGRAPH_HOST_API_KEY`、`LANGSMITH_API_KEY` 或 `LANGCHAIN_API_KEY` 环境变量或 `.env` 文件进行设置。                 |
    | `--name TEXT` |当前目录名称 |部署名称。也可以通过 `LANGSMITH_DEPLOYMENT_NAME` 环境变量或 `.env` 文件设置。                                                                             |
    | `--deployment-id TEXT` |                        |要更新的现有部署的 ID。如果省略，则使用 `--name` 查找或创建部署。                                                                            || `--deployment-type TEXT` | `serverless` |在云上创建新部署时的部署类型：基于新的基于使用情况的定价的`serverless`或`dedicated`； `dev` 或 `prod` 适用于仍采用之前定价的组织。 |
    | `--remote / --no-remote` |                        |强制远程或本地构建。默认情况下，如果 Docker 本地不可用，则远程构建。                                                                                      |
    | `--no-wait` | `False` |推送后跳过等待部署状态。                                                                                                                                 |
    | `--verbose` | `False` |显示详细的输出，包括 Docker 构建和推送日志。                                                                                                                        |
    | `--help` |                        |显示命令文档。                                                                                                                                                    |<Note>
      在新的基于使用量的定价中，请传递`--deployment-type serverless`或`--deployment-type dedicated`。在 2026 年 10 月 1 日之前仍采用之前定价的组织可通过 `--deployment-type dev` 或 `--deployment-type prod` 创建开发或生产部署。有关过渡时间线，请参阅[Manage billing](/langsmith/billing#langsmith-deployment-billing)。
    </Note>

    **示例**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    # Deploy with API key from .env file
    langgraph deploy

    # Deploy with inline API key
    LANGSMITH_API_KEY=lsv2_... langgraph deploy

    # Update an existing deployment
    langgraph deploy --deployment-id abc123

    # Deploy with inline deployment name
    LANGSMITH_DEPLOYMENT_NAME=my-agent langgraph deploy

    # Deploy to EU region
    LANGGRAPH_HOST_URL=https://eu.api.host.langchain.com langgraph deploy
    ```

    <Note>通过其他方法（例如，LangSmith UI 或 GitHub 集成）创建的部署也可以使用 `langgraph deploy` 命令进行更新。</Note>

    #### `deploy list`

    列出 LangSmith 部署。

    **使用**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph deploy list [OPTIONS]
    ```

    **选项**|选项|默认 |描述 |
    | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
    | `--name-contains TEXT` |         |仅显示名称包含此值的部署。                                                                                   |
    | `--api-key TEXT` |         | API 密钥。也可以通过 `LANGGRAPH_HOST_API_KEY`、`LANGSMITH_API_KEY` 或 `LANGCHAIN_API_KEY` 环境变量或 `.env` 文件进行设置。 |
    | `--help` |         |显示此消息并退出。                                                                                                             |

    #### `deploy revisions`

    \[Beta] 管理部署修订。

    **使用**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph deploy revisions [OPTIONS] COMMAND [ARGS]...
    ```

    **选项**

    |选项|默认 |描述 |
    | -------- | -------- | ------------------------ | |
    | `--help` |         |显示此消息并退出。 |

    **命令**|命令 |描述 |
    | -------- | -------------------------------------------------- |
    | `list` | \[Beta] 列出 LangSmith 部署的修订版本。 |

    #### `deploy revisions list`

    \[Beta] 列出 LangSmith 部署的修订版本。

    使用 [⟦T472⟧](#deploy-list) 列出部署 ID。

    **使用**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph deploy revisions list [OPTIONS] DEPLOYMENT_ID
    ```

    **选项**

    |选项|默认 |描述 |
    | ----------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
    | `--limit INTEGER` | `10` |返回的最大修订数。                                                                                                  |
    | `--api-key TEXT` |         | API 密钥。也可以通过 `LANGGRAPH_HOST_API_KEY`、`LANGSMITH_API_KEY` 或 `LANGCHAIN_API_KEY` 环境变量或 `.env` 文件进行设置。 |
    | `--help` |         |显示此消息并退出。                                                                                                             |

    #### `deploy delete`删除 LangSmith 部署。

    使用 [⟦T482⟧](#deploy-list) 查找要删除的部署 ID。

    **使用**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph deploy delete [OPTIONS] DEPLOYMENT_ID
    ```

    **选项**

    |选项|默认 |描述 |
    | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
    | `--force` |         |删除而不提示确认。                                                                                              |
    | `--api-key TEXT` |         | API 密钥。也可以通过 `LANGGRAPH_HOST_API_KEY`、`LANGSMITH_API_KEY` 或 `LANGCHAIN_API_KEY` 环境变量或 `.env` 文件进行设置。 |
    | `--help` |         |显示此消息并退出。                                                                                                             |

    #### `deploy logs`

    获取 LangSmith 部署日志。使用 `deploy` 作为代理运行时日志，或使用 `build` 作为远程构建日志。

    **使用**

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph deploy logs [OPTIONS]
    ```

    **选项**|选项 |默认|描述 |
    | ------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | `-f, --follow` | `False` |不断轮询新日志。                                                                                                                    |
    | `--end-time TEXT` |                        | ISO8601 结束时间。示例：`2026-03-08T00:00:00Z`。                                                                                                 |
    | `--start-time TEXT` |                        | ISO8601 开始时间。示例：`2026-03-08T00:00:00Z`。                                                                                               || `-q, --query TEXT` |                        |搜索字符串过滤器。                                                                                                                              |
    | `--limit INTEGER` | `100` |要获取的最大日志条目。                                                                                                                          |
    | `--level [DEBUG\|INFO\|WARNING\|ERROR\|CRITICAL]` |                        |按日志级别过滤。                                                                                                                               |
    | `--revision-id TEXT` |                        |具体修订 ID。对于构建日志，默认为最新版本。                                                                             |
    | `--type [deploy\|build]` | `deploy` |要获取的日志流。 `deploy` 显示代理服务器运行时日志。 `build` 显示远程构建日志。                                                    || `--deployment-id TEXT` |                        |部署 ID。如果省略，则使用 `--name` 查找部署。                                                                                |
    | `--name TEXT` |当前目录名称 |部署名称。也可以通过 `LANGSMITH_DEPLOYMENT_NAME` 环境变量或 `.env` 文件设置。当未提供`--deployment-id`时使用。 |
    | `--api-key TEXT` |                        | API 密钥。也可以通过 `LANGGRAPH_HOST_API_KEY`、`LANGSMITH_API_KEY` 或 `LANGCHAIN_API_KEY` 环境变量或 `.env` 文件进行设置。            |
    | `--help` |                        |显示此消息并退出。                                                                                                                        |
  </Tab>
</Tabs>

### `up`

<Tabs>
  <Tab title="Python">
    启动 LangGraph API 服务器。对于本地测试，需要能够访问 LangSmith 的 LangSmith API 密钥。需要许可证密钥才能用于生产。

    <Tip>
      如果您需要有关何时使用`langgraph dev`与`langgraph up`的更多信息，请参阅[Local development & testing guide](/langsmith/local-dev-testing)进行详细比较。
    </Tip>

    **使用**

    ```
    langgraph up [OPTIONS]
    ```

    **选项**|选项|默认 |描述 |
    | ---------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
    | `--wait` |                           |返回之前等待服务启动。意味着--分离|
    | `--base-image TEXT` | `langchain/langgraph-api` |用于 LangGraph API 服务器的基础镜像。使用版本标签固定到特定版本。                            |
    | `--image TEXT` |                           |用于 langgraph-api 服务的 Docker 映像。如果指定，则跳过构建并直接使用此图像。           |
    | `--postgres-uri TEXT` |本地数据库|用于数据库的 Postgres URI。                                                                                   || `--watch` |                           |文件更改后重新启动 |
    | `--debugger-base-url TEXT` | `http://127.0.0.1:[PORT]` |调试器用于访问 LangGraph API 的 URL。                                                                       |
    | `--debugger-port INTEGER` |                           |将调试器映像拉到本地并在指定端口上提供 UI |
    | `--verbose` |                           |显示服务器日志的更多输出。                                                                                  |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图表和环境变量的配置文件的路径。                                    |
    | `-d, --docker-compose FILE` |                           | docker-compose.yml 文件的路径以及要启动的附加服务。                                                     |
    | `-p, --port INTEGER` | `8123` |要暴露的端口。示例：`langgraph up --port 8000` || `--pull / --no-pull` | `pull` |拉取最新镜像。使用 `--no-pull` 运行带有本地构建镜像的服务器。示例：`langgraph up --no-pull` |
    | `--recreate / --no-recreate` | `no-recreate` |即使容器的配置和映像未更改，也重新创建容器 |
    | `--help` |                           |显示命令文档。                                                                                          |
  </Tab>

  <Tab title="JS">
    启动 LangGraph API 服务器。对于本地测试，需要能够访问 LangSmith 的 LangSmith API 密钥。需要许可证密钥才能用于生产。

    **使用**

    ```
    npx @langchain/langgraph-cli up [OPTIONS]
    ```

    **选项**|选项 |默认|描述 |
    | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
    | <span style={{ whiteSpace: "nowrap" }}>`--wait`</span> |                                                                         |返回之前等待服务启动。意味着--分离|
    | <span style={{ whiteSpace: "nowrap" }}>`--base-image TEXT`</span> | <span style={{ whiteSpace: "nowrap" }}>`langchain/langgraph-api`</span> |用于 LangGraph API 服务器的基础镜像。使用版本标签固定到特定版本。                  |
    | <span style={{ whiteSpace: "nowrap" }}>`--image TEXT`</span> |                                                                         |用于 langgraph-api 服务的 Docker 映像。如果指定，则跳过构建并直接使用此图像。 || <span style={{ whiteSpace: "nowrap" }}>`--postgres-uri TEXT`</span> |本地数据库|用于数据库的 Postgres URI。                                                                         |
    | <span style={{ whiteSpace: "nowrap" }}>`--watch`</span> |                                                                         |文件更改后重新启动 |
    | <span style={{ whiteSpace: "nowrap" }}>`-c, --config FILE`</span> | `langgraph.json` |声明依赖项、图表和环境变量的配置文件的路径。                          |
    | <span style={{ whiteSpace: "nowrap" }}>`-d, --docker-compose FILE`</span> |                                                                         | docker-compose.yml 文件的路径以及要启动的附加服务。                                           |
    | <span style={{ whiteSpace: "nowrap" }}>`-p, --port INTEGER`</span> | `8123` |要暴露的端口。示例：`langgraph up --port 8000` || <span style={{ whiteSpace: "nowrap" }}>`--no-pull`</span> |                                                                         |使用本地构建的图像。默认为 `false` 使用最新的远程 Docker 镜像进行构建。                       |
    | <span style={{ whiteSpace: "nowrap" }}>`--recreate`</span> |                                                                         |即使容器的配置和映像未更改，也重新创建容器 |
    | <span style={{ whiteSpace: "nowrap" }}>`--help`</span> |                                                                         |显示命令文档。                                                                                |
  </Tab>
</Tabs>

### `dockerfile`

<Tabs>
  <Tab title="Python">
    生成用于构建 LangSmith API 服务器 Docker 映像的 Dockerfile。

    **使用**

    ```
    langgraph dockerfile [OPTIONS] SAVE_PATH
    ```

    **选项**|选项|默认|描述 |
    | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图表和环境变量的[configuration file](#configuration-file)的路径。 |
    | `--help` |                  |显示此消息并退出。                                                                                     |

    示例：

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    langgraph dockerfile -c langgraph.json Dockerfile
    ```

    这会生成一个类似于以下内容的 Dockerfile：

    ```dockerfile theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    FROM langchain/langgraph-api:3.11

    ADD ./pipconf.txt /pipconfig.txt

    RUN PIP_CONFIG_FILE=/pipconfig.txt PYTHONDONTWRITEBYTECODE=1 pip install --no-cache-dir -c /api/constraints.txt langchain_anthropic langchain_openai wikipedia scikit-learn

    ADD ./graphs /deps/__outer_graphs/src
    RUN set -ex && \
        for line in '[project]' \
                    'name = "graphs"' \
                    'version = "0.1"' \
                    '[tool.setuptools.package-data]' \
                    '"*" = ["**/*"]'; do \
            echo "$line" >> /deps/__outer_graphs/pyproject.toml; \
        done

    RUN PIP_CONFIG_FILE=/pipconfig.txt PYTHONDONTWRITEBYTECODE=1 pip install --no-cache-dir -c /api/constraints.txt -e /deps/*

    ENV LANGSERVE_GRAPHS='{"agent": "/deps/__outer_graphs/src/agent.py:graph", "storm": "/deps/__outer_graphs/src/storm.py:graph"}'
    ```

    <Note>`langgraph dockerfile` 命令将 `langgraph.json` 文件中的所有配置转换为 Dockerfile 命令。使用此命令时，每当更新 `langgraph.json` 文件时，都必须重新运行它。否则，当您构建或运行 dockerfile 时，您的更改将不会反映出来。</Note>
  </Tab>

  <Tab title="JS">
    生成用于构建 LangSmith API 服务器 Docker 映像的 Dockerfile。

    **使用**

    ```
    npx @langchain/langgraph-cli dockerfile [OPTIONS] SAVE_PATH
    ```

    **选项**|选项|默认|描述 |
    | ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
    | `-c, --config FILE` | `langgraph.json` |声明依赖项、图表和环境变量的[configuration file](#configuration-file)的路径。 |
    | `--help` |                  |显示此消息并退出。                                                                                     |

    示例：

    ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    npx @langchain/langgraph-cli dockerfile -c langgraph.json Dockerfile
    ```

    这会生成一个类似于以下内容的 Dockerfile：

    ```dockerfile theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    FROM langchain/langgraphjs-api:20

    ADD . /deps/agent

    RUN cd /deps/agent && yarn install

    ENV LANGSERVE_GRAPHS='{"agent":"./src/react_agent/graph.ts:graph"}'

    WORKDIR /deps/agent

    RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts
    ```

    <Note>`npx @langchain/langgraph-cli dockerfile`命令将`langgraph.json`文件中的所有配置转换为Dockerfile命令。使用此命令时，每当您更新 `langgraph.json` 文件时，您都必须重新运行它。否则，当您构建或运行 dockerfile 时，您的更改将不会反映出来。</Note>
  </Tab>
</Tabs>

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/cli.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>