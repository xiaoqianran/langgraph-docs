<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Agent Server | https://docs.langchain.com/langsmith/agent-server -->

# 代理服务器

LangSmith 部署的 **代理服务器** 提供用于创建和管理基于代理的应用程序的 API。它建立在[assistants](/langsmith/assistants)的概念之上，[assistants](/langsmith/assistants)是为特定任务配置的代理，并包括内置的[persistence](/oss/python/langgraph/persistence#memory-store)和[task queue](#task-queue)。这种多功能 API 支持广泛的代理应用程序用例，从后台处理到实时交互。

使用代理服务器创建和管理：

<CardGroup cols={4}>
  <Card title="Assistants" icon="robot" href="/langsmith/assistants" />

  <Card title="Threads" icon="messages" href="/langsmith/use-threads" />

  <Card title="Runs" icon="player-play" href="/langsmith/runs" />

  <Card title="Cron jobs" icon="clock" href="/langsmith/cron-jobs" />
</CardGroup>

<Tip>
  **API参考**<br />
  有关API端点和数据模型的详细信息，请参阅[Agent Server API reference](/langsmith/server-api-ref)。
</Tip>

## 应用程序结构

要部署代理服务器应用程序，您需要指定要部署的图，以及任何相关的配置设置，例如依赖项和环境变量。

阅读 [application structure](/langsmith/application-structure) 指南，了解如何构建 LangGraph 应用程序以进行部署。

<Note>
  [LangSmith cloud](/langsmith/cloud) 为您管理数据库。如果您要在 [own infrastructure](/langsmith/self-hosted) 上部署，则需要自行设置。
</Note>

## 部署的各个部分

当您部署代理服务器时，您将部署一个或多个[graphs](#graphs)、[persistence](/oss/python/langgraph/persistence) 的数据库和[task queue](#task-queue)。

### 图表当您使用 Agent Server 部署图形时，您正在部署 [Assistant](/langsmith/assistants) 的“蓝图”。

图最常实现 [agent](/oss/python/langgraph/workflows-agents)，但并非必须如此。例如，图可以实现一个简单的聊天机器人，仅支持来回对话，而无法影响任何应用程序控制流。实际上，随着应用程序变得越来越复杂，图通常会实现更复杂的流程，可能会使用 [multiple agents](/oss/python/langchain/multi-agent) 协同工作。

图表不一定要用LangGraph来写。您还可以使用 LangGraph 功能 API 或 `deployments-wrap-sdk` 包来部署使用其他框架（例如 [Strands, Claude Agent SDK, and more](/langsmith/deploy-other-frameworks) 或 [Google ADK](/langsmith/deploy-google-adk)）构建的代理。

#### 图形加载和编译

图表的编译方式和时间取决于您在 [application structure](/langsmith/application-structure) 中的注册方式：1. **编译图**（推荐）：导出已编译的`CompiledGraph`实例。服务器在容器启动时加载一次，并在每次运行时重用它——每个请求没有编译开销。
2. **工厂函数**：导出服务器每次需要图时调用的代理工厂函数。仅当您需要每次运行图形自定义时才使用此选项（例如，根据助手配置选择不同的模型或工具）。保持工厂函数轻量级，因为它们在每次调用时运行。

<Tip>
  除非您特别需要每次运行自定义，否则请使用已编译的图表。工厂函数会增加每次调用的开销；编译的图表没有。
</Tip>

在这两种情况下，服务器都会在运行时自动注入为该部署配置的检查指针和内存存储。 **不要在图形代码中配置这些**，因为服务器需要管理它们以进行其他操作。

### 坚持

Agent Server 持久保存三种类型的数据，默认情况下均由 [PostgreSQL](https://www.postgresql.org/) 支持：* **核心资源数据**：助手、线程、运行和 cron 作业。始终存储在 PostgreSQL 中。
* **检查点（短期记忆）**：每一步写入的图执行状态的快照。它们使运行持久：如果工作线程被中断，运行可以从最后一个检查点而不是从头开始恢复。持久性模式控制检查点频率—`async`（默认）在每个步骤后写入； `exit` 仅存储最终状态。 LangSmith 默认将其存储在 PostgreSQL 中；但您可以切换到 [MongoDB](https://www.mongodb.com/) 或自定义实现。详情请参阅[Configure checkpointer backend](/langsmith/configure-checkpointer)。
* **存储（长期记忆）**：跨线程持续存在的内存，使代理能够保留单独对话之间的信息。默认存储在 PostgreSQL 中，但可以用自定义实现替换。详情请参阅[Add custom store](/langsmith/custom-store)。

### 任务队列

当客户端创建运行时，API 服务器将其放入队列，然后队列工作线程将其拾取以执行。还可以通知工作人员取消正在进行的运行，并发布打开 `/stream` 连接的输出事件，实时转发到客户端。[Redis](https://redis.io/) 处理 API 服务器和队列工作人员之间的信令、取消和流媒体发布/订阅。它仅存储临时数据 - Redis 中不会保留任何用户或运行数据。运行数据本身总是从 PostgreSQL 读取和写入。

有关如何设置和管理这些组件的更多信息，请查看 [hosting options](/langsmith/platform-setup) 指南。

## 运行时架构

### 部署模式

Agent Server 支持三种运行时配置：

* **单主机**：API 服务器直接管理任务队列，没有单独的队列工作人员。这是自托管部署的默认设置，适用于开发和低流量用例。
* **拆分 API 和队列**：专用队列工作程序在与 API 服务器不同的主机上处理运行执行。对于自托管部署，请通过在配置中设置 `queue.enabled: true` 来启用此功能。每个层都可以独立扩展 - API 服务器根据请求量进行扩展，队列工作线程根据挂起的运行计数进行扩展。* **分布式运行时**：API 和队列进程再次单独运行，但分布式运行时使用一个进程进行编排，一个进程用于执行，而不是使用单个队列进程来处理图形的编排和执行。将此用于具有高并发要求的大规模部署。

下面描述的容器架构和运行生命周期适用于单主机和拆分 API 和队列配置。

### 容器架构

典型的部署由两种长时间运行的容器组成，它们都是从同一个 Docker 映像（顶部安装了项目代码的基础映像）构建的：

* **API 服务器** 处理客户端请求（创建运行、读取线程状态、流结果），但本身不执行代理代码。
* **队列工作者**是执行引擎。他们监听持久任务队列，执行图形代码并写入检查点。

容器是**无状态**但持久的。任何时候至少有 1 个队列工作线程必须监听任务队列，以确保没有孤立的运行。容器在其生命周期内可以多次运行。API 服务器和队列工作线程是独立的容器池和 [scale independently](/langsmith/data-plane#autoscaling)。

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

当您调用运行时，请求会流经多个组件：

1. 客户端向 API 服务器发送请求，API 服务器在持久任务队列中创建待处理的运行。
2. 队列工作线程获取运行，获取其租约，加载适当的图形，然后开始执行。队列强制规定给定线程一次最多可以执行 1 次运行。
3. 当图执行时，工作线程将检查点写入持久层（频率取决于[durability mode](/oss/python/langgraph/persistence#durability-modes)）并通过配置的 pubsub 提供程序广播流事件。
4. 如果客户端打开了 `/stream` 连接，API 服务器会订阅 pubsub 通道，并通过服务器发送的事件实时将事件转发给客户端。
5. 执行完成后，worker 更新运行状态并释放其插槽以供下一次运行。每个工作线程最多同时执行 [⟦T8⟧](/langsmith/env-var-self-hosted) 次运行（默认值：10），因此单个工作线程容器可并行运行多个运行。这限制了并发运行执行，而不是部署可以服务的 API 请求的数量。 API 服务器独立处理请求并单独扩展，因此请求服务能力不受`N_JOBS_PER_WORKER` 的限制。请参阅 [Configure Agent Server for scale](/langsmith/agent-server-scale) 获取调整指南。

## 了解更多

* [Application Structure](/langsmith/application-structure) 指南解释了如何构建您的应用程序以进行部署。
* [API Reference](https://docs.langchain.com/langsmith/server-api-ref) 提供有关 API 端点和数据模型的详细信息。

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/agent-server.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>