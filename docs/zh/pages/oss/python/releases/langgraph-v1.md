<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: What's new in LangGraph v1 | https://docs.langchain.com/oss/python/releases/langgraph-v1 -->

# LangGraph v1 中的新功能

**LangGraph v1 是一个以稳定性为中心的代理运行时版本。** 它保持核心图形 API 和执行模型不变，同时改进类型安全、文档和开发人员人体工程学。

它旨在与 [LangChain v1](/oss/python/releases/langchain-v1)（其 `create_agent` 构建于 LangGraph 之上）协同工作，因此您可以从高层开始，并在需要时下降到精细控制。

> **稳定的核心API**
>
> 图基元（状态、节点、边）和执行/运行时模型保持不变，使升级变得简单。

> **默认可靠性**
>
> 具有检查点、持久性、流式传输和人机交互的持久执行仍然是一流的。

> **与 LangChain v1 无缝连接**
>
> LangChain 的 `create_agent` 在 LangGraph 上运行。使用LangChain快速启动；下降到 LangGraph 进行自定义编排。

要升级，

```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
pip install -U langgraph
```

```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
uv add langgraph
```

## `create_react_agent` 弃用

预构建的 LangGraph [⟦T5⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent) 已被弃用，取而代之的是 LangChain 的 [⟦T6⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)。它提供了更简单的界面，并通过引入中间件提供了更大的定制潜力。

* 有关新 [⟦T7⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) API 的信息，请参阅 [LangChain v1 release notes](/oss/python/releases/langchain-v1#create_agent)。
* 有关从 [⟦T8⟧](https://reference.langchain.com/python/langchain-classic/agents/react/agent/create_react_agent) 迁移到 [⟦T9⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 的信息，请参阅 [LangChain v1 migration guide](/oss/python/migrate/langchain-v1#migrate-to-create_agent)。

## 报告问题请使用 [⟦T10⟧ label](https://github.com/langchain-ai/langgraph/issues?q=state%3Aopen%20label%3Av1) 报告 [GitHub](https://github.com/langchain-ai/langgraph/issues) 上 1.0 发现的任何问题。

## 其他资源

> **[LangGraph 1.0](https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/)**
>
> 阅读公告

> **[Overview](/oss/python/langgraph/overview)**
>
> LangGraph是什么以及何时使用它

> **[Graph API](/oss/python/langgraph/graph-api)**
>
> 使用状态、节点和边构建图

> **[LangChain Agents](/oss/python/langchain/agents)**
>
> 基于LangGraph构建的高级代理

> **[Migration guide](/oss/python/migrate/langgraph-v1)**
>
> 如何迁移到LangGraph v1

> **[GitHub](https://github.com/langchain-ai/langgraph)**
>
> 报告问题或贡献

## 另请参阅

* [Versioning](/oss/python/versioning) – 了解版本号
* [Release policy](/oss/python/release-policy) – 详细发布政策

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/python/releases/langgraph-v1.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。