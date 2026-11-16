<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangSmith Agent Server | https://docs.langchain.com/langsmith/agent-server -->

# LangSmith 代理服务器

> 了解 LangSmith 代理服务器运行时的工作原理，从助手、线程和运行到持久性、任务队列、身份验证和服务器自定义。

**LangSmith 代理服务器** 是代理工作负载的工作流编排运行时。它提供了用于创建和管理基于代理的应用程序的 API。它建立在[assistants](https://docs.langchain.com/langsmith/assistants.md)的概念之上，[assistants](https://docs.langchain.com/langsmith/assistants.md)是为特定任务配置的代理，并包括内置的[persistence](https://docs.langchain.com/oss/python/langgraph/persistence.md#memory-store)和[task queue](#task-queue)。这种多功能 API 支持广泛的代理应用程序用例，从后台处理到实时交互。

> [!注意]
>
> LangSmith 部署现在为 **LangSmith 代理服务器**。

> [!提示]
>
> 要选择代理服务器运行的位置，例如LangSmith 云、混合或您自己的基础架构，请参阅[Deploy agents](https://docs.langchain.com/langsmith/deploy-overview.md)。

使用代理服务器创建和管理：

> [卡][Assistants](https://docs.langchain.com/langsmith/assistants.md)

> [卡][Threads](https://docs.langchain.com/langsmith/use-threads.md)

> [卡][Runs](https://docs.langchain.com/langsmith/runs.md)

> [卡][Cron jobs](https://docs.langchain.com/langsmith/cron-jobs.md)

代理服务器还[streams](https://docs.langchain.com/langsmith/streaming.md)输出到客户端，暂停运行[human review](https://docs.langchain.com/langsmith/add-human-in-the-loop.md)，处理[concurrent input on a thread](https://docs.langchain.com/langsmith/double-texting.md)，运行完成时调用[webhooks](https://docs.langchain.com/langsmith/use-webhooks.md)，并通过[MCP](https://docs.langchain.com/langsmith/server-mcp.md)和[A2A](https://docs.langchain.com/langsmith/server-a2a.md)公开代理。

> [!提示]
>
> **API参考**\\
>
> 有关助手、线程、运行、crons、存储、A2A、MCP 和系统操作的端点和数据模型，请参阅[Agent Server API reference](https://docs.langchain.com/langsmith/server-api-ref.md)。## 应用程序结构

要部署代理服务器应用程序，您需要指定要部署的图，以及任何相关的配置设置，例如依赖项和环境变量。

阅读 [application structure](https://docs.langchain.com/langsmith/application-structure.md) 指南，了解如何构建 LangGraph 应用程序以进行部署。要声明依赖项，请使用 [⟦T1⟧](https://docs.langchain.com/langsmith/setup-app-requirements-txt)、[⟦T2⟧](https://docs.langchain.com/langsmith/setup-pyproject) 或 [⟦T3⟧](https://docs.langchain.com/langsmith/setup-javascript)。对于更复杂的构建，[customize the Dockerfile](https://docs.langchain.com/langsmith/custom-docker.md)或[deploy from a monorepo](https://docs.langchain.com/langsmith/monorepo-support.md)。

## 您部署的内容

当您部署代理服务器时，您将部署一个或多个[graphs](#graphs)、[persistence](https://docs.langchain.com/oss/python/langgraph/persistence.md) 的数据库和[task queue](#task-queue)。

### 图表

当您使用 Agent Server 部署图形时，您正在部署 [Assistant](https://docs.langchain.com/langsmith/assistants.md) 的“蓝图”。

图最常实现 [agent](https://docs.langchain.com/oss/python/langgraph/workflows-agents.md)，但并非必须如此。例如，图可以实现一个简单的聊天机器人，仅支持来回对话，而无法影响任何应用程序控制流。实际上，随着应用程序变得越来越复杂，图通常会实现更复杂的流程，可能会使用 [multiple agents](https://docs.langchain.com/oss/python/langchain/multi-agent.md) 协同工作。图表不一定要用LangGraph来写。要部署使用其他框架构建的代理，请使用 LangGraph 功能 API 或 `deployments-wrap-sdk` 包对其进行包装。例如，请参阅 [Deploy Google ADK agents](https://docs.langchain.com/langsmith/deploy-google-adk.md) 和 [Deploy other frameworks](https://docs.langchain.com/langsmith/deploy-other-frameworks.md)，其中涵盖了 Strands、Claude Agent SDK、CrewAI 和 AutoGen。

#### 图形加载和编译

图表的编译方式和时间取决于您在 [application structure](https://docs.langchain.com/langsmith/application-structure.md) 中的注册方式：

1. **编译图**（推荐）：导出已编译的`CompiledGraph`实例。服务器在容器启动时加载一次，并在每次运行时重用它——每个请求没有编译开销。
2. **工厂函数**：导出服务器每次需要图时调用的代理工厂函数。仅当您需要每次运行图形自定义时才使用此选项（例如，根据助手配置选择不同的模型或工具）。保持工厂函数轻量级，因为它们在每次调用时运行。

> [!提示]
>
> 除非您特别需要每次运行自定义，否则请使用已编译的图表。工厂函数会增加每次调用的开销；编译的图表没有。在这两种情况下，服务器都会在运行时自动注入为该部署配置的检查指针和内存存储。 **不要在图形代码中配置这些**，因为服务器需要管理它们以进行其他操作。

### 坚持

Agent Server 保存三种类型的数据，默认情况下均由 [PostgreSQL](https://www.postgresql.org/) 支持：

* **核心资源数据**：助手、线程、运行和 cron 作业。始终存储在 PostgreSQL 中。
* **检查点（短期记忆）**：每一步写入的图执行状态的快照。它们使运行持久：如果工作线程被中断，运行可以从最后一个检查点而不是从头开始恢复。持久性模式控制检查点频率—`async`（默认）在每个步骤后写入； `exit` 仅存储最终状态。 LangSmith 默认将其存储在 PostgreSQL 中；但您可以切换到 [MongoDB](https://www.mongodb.com/) 或自定义实现。详情请参阅[Configure checkpointer backend](https://docs.langchain.com/langsmith/configure-checkpointer.md)。
* **存储（长期记忆）**：跨线程持续存在的内存，使代理能够保留单独对话之间的信息。默认存储在 PostgreSQL 中，但可以用自定义实现替换。详情请参阅[Add custom store](https://docs.langchain.com/langsmith/custom-store.md)。在 [LangSmith Cloud](https://docs.langchain.com/langsmith/cloud-platform-features.md#database-provisioning) 和[self-hosted control plane](https://docs.langchain.com/langsmith/deploy-with-control-plane.md) 上，控制平面为每个代理服务器创建 PostgreSQL 数据库。自托管设置可以用 [use their own PostgreSQL instance](https://docs.langchain.com/langsmith/self-hosted-platform-features.md#custom-postgresql) 代替。 [standalone Agent Server](https://docs.langchain.com/langsmith/deploy-standalone-server.md)（包括 [Hybrid](https://docs.langchain.com/langsmith/hybrid.md) 设置中的一个）没有控制平面，因此您提供数据库并在 `DATABASE_URI` 中传递其连接字符串。

使旧线程、检查点和存储项目过期，[add TTLs](https://docs.langchain.com/langsmith/configure-ttl.md)。要通过含义而不是确切的键来搜索商店，[add semantic search](https://docs.langchain.com/langsmith/semantic-search.md)。

### 任务队列

当客户端创建运行时，API 服务器将其放入队列，然后队列工作线程将其拾取以执行。还可以通知工作人员取消正在进行的运行，并发布打开 `/stream` 连接的输出事件，实时转发到客户端。

[Redis](https://redis.io/) 处理 API 服务器和队列工作人员之间的信令、取消和流媒体发布/订阅。它仅存储临时数据——Redis 中不会保留任何用户或运行数据。运行数据本身始终从 PostgreSQL 读取和写入。

控制平面与数据库一起创建一个 Redis 实例，并且自托管设置可以使用 [use their own Redis instance](https://docs.langchain.com/langsmith/self-hosted-platform-features.md#custom-redis) 来代替。使用独立的代理服务器，您可以提供 Redis 并在 `REDIS_URI` 中传递其连接字符串。有关 Agent Server 如何使用 PostgreSQL 和 Redis 的更多信息，请参阅[Data plane](https://docs.langchain.com/langsmith/data-plane.md)。

## 运行时架构代理服务器作为共享 PostgreSQL 和 Redis 的 API 服务器和队列工作线程运行。部署模式决定这些进程如何跨主机拆分。本节介绍部署模式、它们运行的​​容器以及运行如何在它们之间移动。

### 部署模式

Agent Server 支持三种运行时配置：

* **单主机**：API 服务器直接管理任务队列，没有单独的队列工作人员。这是自托管部署的默认设置，适用于开发和低流量用例。
* **拆分 API 和队列**：专用队列工作程序在与 API 服务器不同的主机上处理运行执行。对于自托管部署，请通过在配置中设置 `queue.enabled: true` 来启用此功能。每个层都可以独立扩展 - API 服务器根据请求量进行扩展，队列工作线程根据挂起的运行计数进行扩展。
* **分布式运行时**：API 和队列进程再次单独运行，但分布式运行时使用一个进程进行编排，一个进程用于执行，而不是使用单个队列进程来处理图形的编排和执行。将此用于具有高并发要求的大规模部署。下面描述的容器架构和运行生命周期适用于单主机和拆分 API 和队列配置。

### 容器架构

典型的部署由两种长时间运行的容器组成，它们都是从同一个 Docker 映像（顶部安装了项目代码的基础映像）构建的：

* **API 服务器** 处理客户端请求（创建运行、读取线程状态、流结果），但本身不执行代理代码。
* **队列工作者**是执行引擎。他们监听持久任务队列，执行图形代码并写入检查点。

容器是**无状态**但持久的。任何时候至少有 1 个队列工作线程必须监听任务队列，以确保没有孤立的运行。容器在其生命周期内可以多次运行。

API 服务器和队列工作线程是独立的容器池和 [scale independently](https://docs.langchain.com/langsmith/data-plane.md#autoscaling)。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
flowchart TB
    User["User"]

    API["API Servers"]

    subgraph WorkerContainer["Worker Containers"]
        QueueLoop["Queue Loop"]
        W1["Worker"]
        W2["Worker"]
        Wn["..."]
        QueueLoop -->|dispatch| W1
        QueueLoop -->|dispatch| W2
    end

    DB[(Postgres)]
    Redis[(Redis)]

    User -->|request| API
    API -->|create run| DB
    API -->|notify| Redis

    Redis -->|wake| QueueLoop
    QueueLoop -->|claim next run| DB

    WorkerContainer -->|save checkpoints / update status| DB
    WorkerContainer -->|publish events| Redis

    Redis -->|stream events| API
    API -->|SSE response| User

    style User fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#2F4B68
    style API fill:#EBD0F0,stroke:#885270,stroke-width:2px,color:#441E33
    style DB fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    style Redis fill:#F8E8E6,stroke:#B27D75,stroke-width:2px,color:#634643
    style WorkerContainer fill:#F6FFDB,stroke:#6E8900,stroke-width:2px,color:#2E3900
    style QueueLoop fill:#FDF3FF,stroke:#7E65AE,stroke-width:2px,color:#504B5F
    style W1 fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#2F4B68
    style W2 fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#2F4B68
    style Wn fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#2F4B68
```

### 运行执行生命周期

当您调用运行时，请求会流经多个组件：1. 客户端向 API 服务器发送请求，API 服务器在持久任务队列中创建待处理的运行。
2. 队列工作线程获取运行，获取其租约，加载适当的图形，然后开始执行。队列强制规定给定线程一次最多可以执行 1 次运行。
3. 当图执行时，工作线程将检查点写入持久层（频率取决于[durability mode](https://docs.langchain.com/oss/python/langgraph/persistence.md#durability-modes)）并通过配置的 pubsub 提供程序广播流事件。
4. 如果客户端打开了 `/stream` 连接，API 服务器会订阅 pubsub 通道，并通过服务器发送的事件实时将事件转发给客户端。
5. 执行完成后，worker 更新运行状态并释放其插槽以供下一次运行。

每个工作线程最多同时执行 [⟦T13⟧](https://docs.langchain.com/langsmith/env-var-self-hosted) 次运行（默认值：10），因此单个工作线程容器可以并行运行多个运行。这限制了并发运行执行，而不是部署可以服务的 API 请求的数量。 API 服务器独立处理请求并单独扩展，因此请求服务能力不受`N_JOBS_PER_WORKER` 的限制。请参阅 [Configure Agent Server for scale](https://docs.langchain.com/langsmith/agent-server-scale.md) 获取调优指南。

## 保护并定制服务器> [卡][Auth & access control](https://docs.langchain.com/langsmith/auth.md)
>
> 对用户进行身份验证、强制实施资源级访问并连接外部 OAuth2 身份提供商。

> [卡][Server customization](https://docs.langchain.com/langsmith/caching.md)
>
> 添加缓存、自定义存储和检查点、生命周期挂钩、中间件、自定义路由、加密以及可配置标头和日志。

## 教程

* [Collect user feedback for Agent Server runs](https://docs.langchain.com/langsmith/agent-server-feedback.md)：将最终用户反馈附加到运行和跟踪中。
* [Implement generative user interfaces](https://docs.langchain.com/langsmith/generative-ui-react.md)：将 UI 元素流式传输到 React 客户端。
* [Implement a CI/CD pipeline](https://docs.langchain.com/langsmith/cicd-pipeline-example.md)：使用 GitHub Actions 自动化测试、评估和部署。

***

[Connect these docs](https://docs.langchain.com/use-these-docs.md) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。