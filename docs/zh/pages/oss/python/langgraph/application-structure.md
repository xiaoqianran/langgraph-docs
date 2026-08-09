<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Application structure | https://docs.langchain.com/oss/python/langgraph/application-structure -->

# 应用程序结构

LangGraph 应用程序由一个或多个图、一个配置文件 (`langgraph.json`)、一个指定依赖项的文件以及一个可选的指定环境变量的 `.env` 文件组成。

本指南展示了应用程序的典型结构，并向您展示如何提供使用 [LangSmith Deployment](/langsmith/deployment) 部署应用程序所需的配置。

<Info>
  LangSmith Deployment 是一个托管平台，用于部署和扩展 LangGraph 代理。它处理基础设施、扩展和操作问题，因此您可以直接从存储库部署有状态、长期运行的代理。在[Deployment documentation](/langsmith/deployment)了解更多信息。
</Info>

## 关键概念

要使用 LangSmith 进行部署，应提供以下信息：

1. [LangGraph configuration file](#configuration-file-concepts) (`langgraph.json`)，指定应用程序使用的依赖项、图表和环境变量。
2. 实现应用程序逻辑的[graphs](#graphs)。
3. 指定运行应用程序所需的[dependencies](#dependencies)的文件。
4. 应用程序运行所需的[Environment variables](#environment-variables)。

## 文件结构

以下是应用程序目录结构的示例：

<Tabs>
  <Tab title="Python (requirements.txt)">
    ```plaintext theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    my-app/
    ├── my_agent # all project code lies within here
    │   ├── utils # utilities for your graph
    │   │   ├── __init__.py
    │   │   ├── tools.py # tools for your graph
    │   │   ├── nodes.py # node functions for your graph
    │   │   └── state.py # state definition of your graph
    │   ├── __init__.py
    │   └── agent.py # code for constructing your graph
    ├── .env # environment variables
    ├── requirements.txt # package dependencies
    └── langgraph.json # configuration file for LangGraph
    ```
  </Tab>

  <Tab title="Python (pyproject.toml)">
    ```plaintext theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    my-app/
    ├── my_agent # all project code lies within here
    │   ├── utils # utilities for your graph
    │   │   ├── __init__.py
    │   │   ├── tools.py # tools for your graph
    │   │   ├── nodes.py # node functions for your graph
    │   │   └── state.py # state definition of your graph
    │   ├── __init__.py
    │   └── agent.py # code for constructing your graph
    ├── .env # environment variables
    ├── langgraph.json  # configuration file for LangGraph
    └── pyproject.toml # dependencies for your project
    ```
  </Tab>
</Tabs><Note>
  LangGraph 应用程序的目录结构可能会根据所使用的编程语言和包管理器的不同而有所不同。
</Note>

<a />

## 配置文件

`langgraph.json` 文件是一个 JSON 文件，指定部署 LangGraph 应用程序所需的依赖项、图形、环境变量和其他设置。

有关 JSON 文件中所有支持的键的详细信息，请参阅 [LangGraph configuration file reference](/langsmith/cli#configuration-file)。

<Tip>
  [LangGraph CLI](/langsmith/cli) 默认使用当前目录下的配置文件`langgraph.json`。
</Tip>

### 示例

* 依赖项涉及自定义本地包和`langchain_openai`包。
* 将从文件 `./your_package/your_file.py` 和变量 `variable` 加载单个图表。
* 环境变量从`.env`文件加载。

```json theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
{
  "dependencies": ["langchain_openai", "./your_package"],
  "graphs": {
    "my_agent": "./your_package/your_file.py:agent"
  },
  "env": "./.env"
}
```

## 依赖关系

LangGraph 应用程序可能依赖于其他 Python 包。

您通常需要指定以下信息才能正确设置依赖项：

1. 目录中指定依赖项的文件（例如 `requirements.txt`、`pyproject.toml` 或 `package.json`）。

2. [LangGraph configuration file](#configuration-file-concepts) 中的`dependencies` 键指定运行 LangGraph 应用程序所需的依赖项。

3. 任何其他二进制文件或系统库都可以使用 [LangGraph configuration file](#configuration-file-concepts) 中的 `dockerfile_lines` 键指定。## 图表

使用 [LangGraph configuration file](#configuration-file-concepts) 中的 `graphs` 键指定哪些图将在已部署的 LangGraph 应用程序中可用。

您可以在配置文件中指定一个或多个图表。每个图都由名称（应该是唯一的）和路径来标识：(1) 已编译的图或 (2) 定义了生成图的函数。

## 环境变量

如果您在本地使用已部署的 LangGraph 应用程序，则可以在 [LangGraph configuration file](#configuration-file-concepts) 的 `env` 键中配置环境变量。

对于生产部署，您通常需要在部署环境中配置环境变量。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/application-structure.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>