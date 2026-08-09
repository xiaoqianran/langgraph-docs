<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Agent Server | https://docs.langchain.com/langsmith/agent-server-overview -->

# 代理服务器

> 配置和操作LangSmith代理服务器运行时，包括功能、应用程序结构、身份验证和定制。

在 [Agent Server](/langsmith/agent-server) 运行时配置和构建应用程序。部署后，代理将使用三个原语：[**assistants**](/langsmith/assistants)用于配置，[**threads**](/langsmith/use-threads)用于状态，[**runs**](/langsmith/runs)用于工作负载。此选项卡中的页面涵盖代理服务器提供的功能、如何[structure your application](/langsmith/application-structure)，以及如何[secure](/langsmith/auth) 和[customize](/langsmith/custom-routes) 服务器。

## 能力

<CardGroup cols={2}>
  <Card title="Develop your application" cta="Set up your project" href="/langsmith/application-structure" icon="code">
    构建您的应用程序，配置 Python、JavaScript 和 monorepos 的依赖项，并使用 RemoteGraph、语义搜索、TTL 和 CI/CD 连接代理。
  </Card>

  <Card title="Agent Server runtime" cta="Explore the runtime" href="/langsmith/agent-server" icon="bolt">
    使用助手、线程、运行和 cron 作业。流式传输给用户、暂停以供人工审核、处理并发输入并通过 MCP 和 A2A 连接。
  </Card>

  <Card title="Auth & access control" cta="Secure your server" href="/langsmith/auth" icon="lock">
    对用户进行身份验证、强制实施资源级访问并连接外部 OAuth2 身份提供商。
  </Card>

  <Card title="Server customization" cta="Customize your server" href="/langsmith/caching" icon="settings">
    添加缓存、自定义存储和检查点、生命周期挂钩、中间件、自定义路由、加密以及可配置标头和日志。
  </Card>
</CardGroup>

## 教程* [Collect user feedback for Agent Server runs](/langsmith/agent-server-feedback)：将最终用户反馈附加到运行和跟踪中
* [Deploy other frameworks (e.g., Strands, CrewAI)](/langsmith/deploy-other-frameworks)：使用功能 API 包装现有代理并部署
* [Implement generative user interfaces with LangGraph](/langsmith/generative-ui-react)：将 UI 元素流式传输到 React 客户端
* [Implement a CI/CD pipeline](/langsmith/cicd-pipeline-example)：使用 GitHub Actions 自动化测试、评估和部署

## 保护和定制您的服务器

* [Custom auth](/langsmith/auth)：身份验证和多租户访问控制
* [Server customization](/langsmith/custom-routes)：自定义路线、[middleware](/langsmith/custom-middleware)、[lifespan hooks](/langsmith/custom-lifespan)、[encryption](/langsmith/encryption)

## 操作

* [CI/CD pipelines](/langsmith/cicd-pipeline-example)
* [TTL configuration](/langsmith/configure-ttl) 用于状态和线程管理
* [Semantic search](/langsmith/semantic-search)

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server-overview.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>