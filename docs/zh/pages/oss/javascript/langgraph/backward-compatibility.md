<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Backward compatibility | https://docs.langchain.com/oss/javascript/langgraph/backward-compatibility -->

# 向后兼容性

更新生产中的 LangGraph 图形代码，而不会中断运行中的运行。

软件需要在生产中改变。新的需求、错误修复和重构最终都会出现在您的图形代码中。由于 LangGraph 针对现有线程的 [persisted](/oss/javascript/langgraph/persistence) 状态运行最新部署的图，因此您发布的每个更改实际上都是相对于现有检查点的向后兼容的 API 更改。

与将运行固定到其开始的代码版本的工作流引擎不同，LangGraph 立即将最新的图形应用于*每个*线程，包括新线程和从检查点恢复的线程。这很方便：错误修复无需仪式即可传播到飞行中的对话和代理。这还意味着您必须推断每个更改如何与在先前版本的代码下启动的运行交互。

需要注意三类兼容性问题，大致按照您遇到的顺序排列：1. [Technical compatibility](#technical-compatibility)：最常见；新代码仍然必须针对现有状态加载和执行。
2. [Business compatibility](#business-compatibility)：不太常见；即使代码已更改，现有运行也应继续遵循旧的业务逻辑。
3. [Non-determinism](#non-determinism)：仅适用于[Functional API](/oss/javascript/langgraph/functional-api)。

<Tip>
  有关运行时默认支持的图形拓扑和状态更改的简短摘要，请参阅[Graph migrations](/oss/javascript/langgraph/graph-api#graph-migrations)。本页的其余部分介绍了当更改超出支持集时可以应用的模式。
</Tip>

## 技术兼容性

技术兼容性相当于微服务中 API 的重大更改。这里的“API”是图形代码和现有线程的[checkpointer](/oss/javascript/langgraph/checkpointers#checkpointer-libraries)已经保存的数据之间的契约。当线程恢复时，LangGraph 反序列化保存的状态，按名称将其分派到节点，并期望该节点返回适合状态模式的值。

常见技术故障：* **重命名或删除节点**，当线程暂停或即将进入该节点时，例如在 [⟦T0⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 处或通过仍路由到旧名称的检查点条件边。恢复时，LangGraph 无法通过保存的名称找到该节点，并且运行失败。恢复运行的起点是执行停止的节点的开头，因此丢失的节点无处可恢复。
* **重命名或删除旧检查点仍然包含的或下游节点仍然读取的状态密钥**。
* **收紧状态字段**，例如将 `Optional` 字段设为必填、缩小类型范围或添加新的不带默认值的必填字段。现有检查点将无法满足新模式。

边缘拓扑本身*不*保留在检查点中。在仍然存在的节点之间添加、删除或重新路由边对于运行中的线程来说是安全的。根据 [Graph migrations](/oss/javascript/langgraph/graph-api#graph-migrations) 总结，唯一可以破坏中断线程的拓扑更改是重命名或删除节点。

### 推荐模式* 将新状态字段标记为可选（`z.string().optional()` 或 `.nullish()`），以便旧检查点仍然有效。
* 将删除视为弃用：将字段保留在架构上至少一个耗尽周期，以便现有检查点继续加载。
* 通过“添加然后删除”重命名：将新字段或节点与旧字段或节点一起添加，双重写入或路由到两者以形成弃用窗口，然后在没有运行中线程依赖旧字段或节点时删除旧字段或节点。
* 在推出之前，使用 [time travel](/oss/javascript/langgraph/use-time-travel) 和 [⟦T4⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#getState) 根据暂存部署中的新代码抽查现有线程。

### 检测运行中的线程

在删除节点、重命名 State 键或以其他方式进行旧线程无法容忍的更改之前，您需要了解当前是否有任何线程停放在您要删除的代码版本上。 LangGraph 本身不维护线程状态的搜索索引，因此答案取决于图的运行位置。

**如果您部署到[LangSmith](/langsmith/deployment)。**使用代理服务器的线程搜索按状态进行过滤。 `status` 字段接受 `idle`、`busy`、`interrupted` 和 `error`，因此您可以批量查询 `interrupted` 或 `busy` 线程，可以选择使用元数据过滤器缩小范围。参见[Filter by thread status](/langsmith/use-threads#filter-by-thread-status)和[List threads](/langsmith/use-threads#list-threads)。**LangGraph 运行的任何地方。** 使用 [LangSmith tracing](/oss/javascript/langgraph/observability) 监控生产中哪些节点正在进入和退出。这是最可靠的信号，表明节点或状态字段在任何活动代码路径中都不再可达。

**当您已经拥有 `thread_id` 时。** 直接检查该单线程：

* [⟦T13⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#getState) 返回最新的检查点，包括线程暂停在哪个节点以及任何挂起的中断。
* [⟦T14⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#getStateHistory) 返回线程检查点的完整时间顺序列表。

如有疑问，请将已弃用的节点或字段保留在适当的位置，直到代理服务器线程列表和跟踪显示其上不再有任何活动。

## 业务兼容性

有时，更改在技术上是有效的（每个现有检查点仍然加载并且每个节点仍然解析），但新图的*含义*与旧图不同。新行为对于新线程来说是正确的，并且您不希望将其追溯应用到在旧逻辑下启动的线程。

例如，假设您的图运行 `intake → triage → respond`，并且您决定在 `triage` 和 `respond` 之间插入一个新的 `policy_check` 步骤：* 已经通过`triage`的线程应该直接继续到`respond`（旧流程）。
* 新线程应该运行完整的新流程。

推荐的模式是在线程启动时记录状态上的相关*行为版本*，然后使用[conditional edge](/oss/javascript/langgraph/graph-api#conditional-edges)进行分支：

在`triage`之后恢复的旧线程从其保存的状态读取`flow_version`（或下降到v1默认值）并跳过`policy_check`。新线程从`intake`开始，带有`flow_version=2`标记，并运行新路径。所有 v1 线程完成后，您可以删除版本标志和条件边缘。

仅当您在需要版本控制的任何分支之前*在线程启动时*设置版本时，此模式才有效。稍后设置意味着现有线程在需要时不会设置它。

## 非决定论

此类别仅适用于 [Functional API](/oss/javascript/langgraph/functional-api) 以及 [Graph API](/oss/javascript/langgraph/graph-api) **节点** 内的 [**tasks**](/oss/javascript/langgraph/functional-api#task) 或 [⟦T26⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用。 Plain Graph API **节点** [re-run from the start of the node function](/oss/javascript/langgraph/graph-api#re-execution-and-idempotency) 简历；将副作用设计为幂等的，但您不需要保留任务调用顺序，除非您在该 **节点** 中使用 **任务** 或 [⟦T27⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)。功能 API **入口点** 编译为单个 **节点**，该节点在运行恢复时从头开始重播入口点主体，使用缓存的 [⟦T28⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/task) 结果来跳过已完成的工作。有两种变化打破了这个模型：

* **添加、删除或重新排序在恢复点*之前*发生的 `@task` 调用或 [⟦T30⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用**。 LangGraph 根据重播中的位置将缓存结果和恢复值与调用进行匹配，因此移动该位置可能会导致针对不同的调用重播错误的缓存值。
* **在`@task`**之外引入非确定性操作，例如`time.time()`、`random.random()`，或内联在入口点主体中的网络调用。重播时，这些会产生与第一次运行时不同的值，这可能会改变控制流。

有关示例的更深入处理，请参阅功能 API 指南中的 [Determinism](/oss/javascript/langgraph/functional-api#determinism) 和 [Common pitfalls](/oss/javascript/langgraph/functional-api#common-pitfalls)。

如果您需要对正在运行的 `@entrypoint` 进行重要的代码更改，最安全的选项是：* 在部署变更之前让正在进行的运行耗尽。
* 将任何新逻辑包装在新的`@task`中，以便其结果独立检查点。
* 在`langgraph.json`中以新的图名称注册一个新的入口点以实现新的行为，并将新的线程路由到它。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/backward-compatibility.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>