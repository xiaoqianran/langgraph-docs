<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Agent Server | https://docs.langchain.com/langsmith/agent-server-overview -->

# 代理服务器

> 配置和操作LangSmith代理服务器运行时，包括功能、应用程序结构、身份验证和定制。

在 [Agent Server](https://docs.langchain.com/langsmith/agent-server.md) 运行时配置和构建应用程序。部署后，代理将使用三个原语：[**assistants**](https://docs.langchain.com/langsmith/assistants.md)用于配置，[**threads**](https://docs.langchain.com/langsmith/use-threads.md)用于状态，[**runs**](https://docs.langchain.com/langsmith/runs.md)用于工作负载。此选项卡中的页面涵盖代理服务器提供的功能、如何[structure your application](https://docs.langchain.com/langsmith/application-structure.md)，以及如何[secure](https://docs.langchain.com/langsmith/auth.md) 和[customize](https://docs.langchain.com/langsmith/custom-routes.md) 服务器。

## 能力

> [卡][Develop your application](https://docs.langchain.com/langsmith/application-structure.md)
>
> 构建您的应用程序，配置 Python、JavaScript 和 monorepos 的依赖项，并使用 RemoteGraph、语义搜索、TTL 和 CI/CD 连接代理。

> [卡][Agent Server runtime](https://docs.langchain.com/langsmith/agent-server.md)
>
> 使用助手、线程、运行和 cron 作业。流式传输给用户、暂停以供人工审核、处理并发输入并通过 MCP 和 A2A 连接。

> [卡][Auth & access control](https://docs.langchain.com/langsmith/auth.md)
>
> 对用户进行身份验证、强制实施资源级访问并连接外部 OAuth2 身份提供商。

> [卡][Server customization](https://docs.langchain.com/langsmith/caching.md)
>
> 添加缓存、自定义存储和检查点、生命周期挂钩、中间件、自定义路由、加密以及可配置标头和日志。

> [卡片] [REST API](https://docs.langchain.com/langsmith/server-api-ref.md)
>
> 针对助手、线程、运行、cron、存储、A2A、MCP 和系统端点的完整 REST API 参考。## 教程

* [Collect user feedback for Agent Server runs](https://docs.langchain.com/langsmith/agent-server-feedback.md)：将最终用户反馈附加到运行和跟踪中
* [Deploy other frameworks (e.g., Strands, CrewAI)](https://docs.langchain.com/langsmith/deploy-other-frameworks.md)：使用功能 API 包装现有代理并部署
* [Implement generative user interfaces with LangGraph](https://docs.langchain.com/langsmith/generative-ui-react.md)：将 UI 元素流式传输到 React 客户端
* [Implement a CI/CD pipeline](https://docs.langchain.com/langsmith/cicd-pipeline-example.md)：使用 GitHub Actions 自动化测试、评估和部署

## 保护和定制您的服务器

* [Custom auth](https://docs.langchain.com/langsmith/auth.md)：身份验证和多租户访问控制
* [Server customization](https://docs.langchain.com/langsmith/custom-routes.md)：自定义路线、[middleware](https://docs.langchain.com/langsmith/custom-middleware.md)、[lifespan hooks](https://docs.langchain.com/langsmith/custom-lifespan.md)、[encryption](https://docs.langchain.com/langsmith/encryption)

## 操作

* [CI/CD pipelines](https://docs.langchain.com/langsmith/cicd-pipeline-example.md)
* [TTL configuration](https://docs.langchain.com/langsmith/configure-ttl.md) 用于状态和线程管理
* [Semantic search](https://docs.langchain.com/langsmith/semantic-search.md)

***

[Connect these docs](https://docs.langchain.com/use-these-docs.md) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server-overview.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。