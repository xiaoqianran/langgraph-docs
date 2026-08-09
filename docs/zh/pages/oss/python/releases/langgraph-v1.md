<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: What's new in LangGraph v1 | https://docs.langchain.com/oss/python/releases/langgraph-v1 -->

# LangGraph v1 中的新功能

**LangGraph v1 是一个注重稳定性的代理运行时版本。** 它保持核心图形 API 和执行模型不变，同时改进类型安全、文档和开发人员人体工程学。

它旨在与 [LangChain v1](/oss/python/releases/langchain-v1)（其 `create_agent` 基于 LangGraph 构建）携手合作，因此您可以从高层开始，并在需要时下降到精细控制。

<CardGroup>
  <Card title="Stable core APIs" icon="sitemap">
    图基元（状态、节点、边）和执行/运行时模型保持不变，使升级变得简单。
  </Card>

  <Card title="Reliability, by default" icon="database">
    具有检查点、持久性、流式传输和人机交互的持久执行仍然是一流的。
  </Card>

  <Card title="Seamless with LangChain v1" icon="link">
    LangChain的`create_agent`运行在LangGraph上。使用浪链快速启动；拖放到 LangGraph 进行自定义编排。
  </Card>
</CardGroup>

要升级，

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph
  ```
</CodeGroup>

## `create_react_agent` 弃用

预构建的 LangGraph [⟦T5⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent) 已被弃用，取而代之的是 LangChain 的 [⟦T6⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)。它提供了更简单的界面，并通过引入中间件提供了更大的定制潜力。

* 有关新 [⟦T7⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) API 的信息，请参阅 [LangChain v1 release notes](/oss/python/releases/langchain-v1#create_agent)。
* 有关从 [⟦T8⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent) 迁移到 [⟦T9⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 的信息，请参阅 [LangChain v1 migration guide](/oss/python/migrate/langchain-v1#migrate-to-create_agent)。## 报告问题

请使用 [⟦T10⟧ label](https://github.com/langchain-ai/langgraph/issues?q=state%3Aopen%20label%3Av1) 报告 [GitHub](https://github.com/langchain-ai/langgraph/issues) 上 1.0 发现的任何问题。

## 其他资源

<CardGroup>
  <Card title="LangGraph 1.0" icon="rocket" href="https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/">
    阅读公告
  </Card>

  <Card title="Overview" icon="book" href="/oss/python/langgraph/overview">
    LangGraph 是什么以及何时使用它
  </Card>

  <Card title="Graph API" icon="sitemap" href="/oss/python/langgraph/graph-api">
    使用状态、节点和边构建图
  </Card>

  <Card title="LangChain Agents" icon="robot" href="/oss/python/langchain/agents">
    基于 LangGraph 构建的高级代理
  </Card>

  <Card title="Migration guide" icon="arrows-exchange" href="/oss/python/migrate/langgraph-v1">
    如何迁移到 LangGraph v1
  </Card>

  <Card title="GitHub" icon="brand-github" href="https://github.com/langchain-ai/langgraph">
    报告问题或贡献
  </Card>
</CardGroup>

## 另请参阅

* [Versioning](/oss/python/versioning) – 了解版本号
* [Release policy](/oss/python/release-policy) – 详细发布政策

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/python/releases/langgraph-v1.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>