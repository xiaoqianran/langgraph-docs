<!-- langgraph-docs: Agent Server | https://docs.langchain.com/langsmith/agent-server-overview -->

# Agent Server

> Configure and operate the LangSmith Agent Server runtime, including capabilities, application structure, auth, and customization.

Configure and build applications on the [Agent Server](https://docs.langchain.com/langsmith/agent-server.md) runtime. Once deployed, agents work with three primitives: [**assistants**](https://docs.langchain.com/langsmith/assistants.md) for configuration, [**threads**](https://docs.langchain.com/langsmith/use-threads.md) for state, and [**runs**](https://docs.langchain.com/langsmith/runs.md) for workloads. The pages in this tab cover the capabilities Agent Server provides, how to [structure your application](https://docs.langchain.com/langsmith/application-structure.md), and how to [secure](https://docs.langchain.com/langsmith/auth.md) and [customize](https://docs.langchain.com/langsmith/custom-routes.md) the server.

## Capabilities

> [card] [Develop your application](https://docs.langchain.com/langsmith/application-structure.md)
>
> Structure your app, configure dependencies for Python, JavaScript, and monorepos, and connect agents with RemoteGraph, semantic search, TTLs, and CI/CD.

> [card] [Agent Server runtime](https://docs.langchain.com/langsmith/agent-server.md)
>
> Work with assistants, threads, runs, and cron jobs. Stream to users, pause for human review, handle concurrent input, and connect via MCP and A2A.

> [card] [Auth & access control](https://docs.langchain.com/langsmith/auth.md)
>
> Authenticate users, enforce resource-level access, and connect external OAuth2 identity providers.

> [card] [Server customization](https://docs.langchain.com/langsmith/caching.md)
>
> Add caching, custom stores and checkpointers, lifespan hooks, middleware, custom routes, encryption, and configurable headers and logs.

> [card] [REST API](https://docs.langchain.com/langsmith/server-api-ref.md)
>
> Full REST API reference for assistants, threads, runs, crons, store, A2A, MCP, and system endpoints.

## Tutorials

* [Collect user feedback for Agent Server runs](https://docs.langchain.com/langsmith/agent-server-feedback.md): Attach end-user feedback to runs and traces
* [Deploy other frameworks (e.g., Strands, CrewAI)](https://docs.langchain.com/langsmith/deploy-other-frameworks.md): Wrap existing agents with Functional API and deploy
* [Implement generative user interfaces with LangGraph](https://docs.langchain.com/langsmith/generative-ui-react.md): Stream UI elements to a React client
* [Implement a CI/CD pipeline](https://docs.langchain.com/langsmith/cicd-pipeline-example.md): Automate tests, evaluations, and deployments with GitHub Actions

## Securing and customizing your server

* [Custom auth](https://docs.langchain.com/langsmith/auth.md): Authentication and multi-tenant access control
* [Server customization](https://docs.langchain.com/langsmith/custom-routes.md): Custom routes, [middleware](https://docs.langchain.com/langsmith/custom-middleware.md), [lifespan hooks](https://docs.langchain.com/langsmith/custom-lifespan.md), [encryption](https://docs.langchain.com/langsmith/encryption)

## Operations

* [CI/CD pipelines](https://docs.langchain.com/langsmith/cicd-pipeline-example.md)
* [TTL configuration](https://docs.langchain.com/langsmith/configure-ttl.md) for state and thread management
* [Semantic search](https://docs.langchain.com/langsmith/semantic-search.md)

***

[Connect these docs](https://docs.langchain.com/use-these-docs.md) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server-overview.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).