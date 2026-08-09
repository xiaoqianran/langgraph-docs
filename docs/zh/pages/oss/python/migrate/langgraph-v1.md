<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph v1 migration guide | https://docs.langchain.com/oss/python/migrate/langgraph-v1 -->

# LangGraph v1 迁移指南

本指南概述了 LangGraph v1 中的更改以及如何从以前的版本迁移。有关更改的高级概述，请参阅 [what's new](/oss/python/releases/langgraph-v1) 页面。

升级：

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph langchain-core
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph langchain-core
  ```
</CodeGroup>

## 变更摘要

LangGraph v1 在很大程度上向后兼容以前的版本。主要变化是弃用[⟦T4⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent)，转而支持LangChain新的[⟦T5⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)功能。

## 弃用

下表列出了 LangGraph v1 中已弃用的所有项目：|已弃用的项目 |另类|
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_react_agent` | [⟦T7⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) |
| `AgentState` | [⟦T9⟧](https://reference.langchain.com/python/langchain/agents/middleware/types/AgentState) |
| `AgentStatePydantic` | `langchain.agents.AgentState`（不再有卑鄙状态）|| `AgentStateWithStructuredResponse` | `langchain.agents.AgentState` |
| `AgentStateWithStructuredResponsePydantic` | `langchain.agents.AgentState`（不再有卑鄙状态）|
| `HumanInterruptConfig` | `langchain.agents.middleware.human_in_the_loop.InterruptOnConfig` |
| `ActionRequest` | `langchain.agents.middleware.human_in_the_loop.InterruptOnConfig` |
| `HumanInterrupt` | `langchain.agents.middleware.human_in_the_loop.HITLRequest` |
| `ValidationNode` |工具自动使用 [⟦T23⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 验证输入 || `MessageGraph` | [⟦T25⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 带有 `messages` 键，如 [⟦T27⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 提供 |

## `create_react_agent` → `create_agent`

LangGraph v1 弃用了预构建的 [⟦T30⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent)。使用LangChain的[⟦T31⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)，它运行在LangGraph上并添加了灵活的中间件系统。

详情请参阅 LangChain v1 文档：

* [Release notes](/oss/python/releases/langchain-v1#create_agent)
* [Migration guide](/oss/python/migrate/langchain-v1#migrate-to-create_agent)

<CodeGroup>
  ```python v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langchain.agents import create_agent

  agent = create_agent(  # [!code highlight]
      model,
      tools,
      system_prompt="You are a helpful assistant.",
  )
  ```

  ```python v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from langgraph.prebuilt import create_react_agent

  agent = create_react_agent(  # [!code highlight]
      model,
      tools,
      prompt="You are a helpful assistant.",  # [!code highlight]
  )
  ```
</CodeGroup>

## 重大变更

### 放弃了 Python 3.9 支持

所有 LangChain 软件包现在都需要 **Python 3.10 或更高版本**。 Python 3.9 于 2025 年 10 月达到[end of life](https://devguide.python.org/versions/)。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/python/migrate/langgraph-v1.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>