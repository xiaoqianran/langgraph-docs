<!-- langgraph-docs: Agent Server | https://docs.langchain.com/langsmith/agent-server-overview -->

# Agent Server

> Configure and operate the LangSmith Agent Server runtime, including capabilities, application structure, auth, and customization.

Configure and build applications on the [Agent Server](/langsmith/agent-server.md) runtime. Once deployed, agents work with three primitives: [**assistants**](/langsmith/assistants.md) for configuration, [**threads**](/langsmith/use-threads.md) for state, and [**runs**](/langsmith/runs.md) for workloads. The pages in this tab cover the capabilities Agent Server provides, how to [structure your application](/langsmith/application-structure.md), and how to [secure](/langsmith/auth.md) and [customize](/langsmith/custom-routes.md) the server.

## Capabilities

> **[Develop your application](/langsmith/application-structure.md)**
>
> Structure your app, configure dependencies for Python, JavaScript, and monorepos, and connect agents with RemoteGraph, semantic search, TTLs, and CI/CD.

> **[Agent Server runtime](/langsmith/agent-server.md)**
>
> Work with assistants, threads, runs, and cron jobs. Stream to users, pause for human review, handle concurrent input, and connect via MCP and A2A.

> **[Auth & access control](/langsmith/auth.md)**
>
> Authenticate users, enforce resource-level access, and connect external OAuth2 identity providers.

> **[Server customization](/langsmith/caching.md)**
>
> Add caching, custom stores and checkpointers, lifespan hooks, middleware, custom routes, encryption, and configurable headers and logs.

> **[REST API](/langsmith/server-api-ref.md)**
>
> Full REST API reference for assistants, threads, runs, crons, store, A2A, MCP, and system endpoints.

## Tutorials

* [Collect user feedback for Agent Server runs](/langsmith/agent-server-feedback.md): Attach end-user feedback to runs and traces
* [Deploy other frameworks (e.g., Strands, CrewAI)](/langsmith/deploy-other-frameworks.md): Wrap existing agents with Functional API and deploy
* [Implement generative user interfaces with LangGraph](/langsmith/generative-ui-react.md): Stream UI elements to a React client
* [Implement a CI/CD pipeline](/langsmith/cicd-pipeline-example.md): Automate tests, evaluations, and deployments with GitHub Actions

## Securing and customizing your server

* [Custom auth](/langsmith/auth.md): Authentication and multi-tenant access control
* [Server customization](/langsmith/custom-routes.md): Custom routes, [middleware](/langsmith/custom-middleware.md), [lifespan hooks](/langsmith/custom-lifespan.md), [encryption](/langsmith/encryption)

## Operations

* [CI/CD pipelines](/langsmith/cicd-pipeline-example.md)
* [TTL configuration](/langsmith/configure-ttl.md) for state and thread management
* [Semantic search](/langsmith/semantic-search.md)

***

[Connect these docs](/use-these-docs.md) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server-overview.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).