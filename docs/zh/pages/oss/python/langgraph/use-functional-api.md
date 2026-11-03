<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Build checklist for the Functional API | https://docs.langchain.com/oss/python/langgraph/use-functional-api -->

# 构建功能 API 的清单

决定如何使用功能 API 组合入口点、任务、流、中断和内存。

本指南将详细介绍您在使用功能 API 进行构建时所做的决策。有关安装和端到端代理示例，请参阅 [LangGraph quickstart](/oss/python/langgraph/quickstart)。有关设计演练，请参阅[Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)。有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。要在图形 API 和功能 API 之间进行选择，请参阅[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)。

## 构建您的工作流程

按顺序完成这些决定。每个步骤都链接到完整食谱的操作方法。

**1.编写工作流程**

定义入口点，将工作单元包装在任务中，并选择步骤的连接方式。

* 从单个入口点开始并将输入作为一个参数（通常是一个字典）传递。
* 使用任务进行离散工作，应独立检查点和重试。
* 当步骤独立时，以并行任务扇出。
* 当需要组合时，调用已编译的[Graph API](/oss/python/langgraph/graph-api)图或其他入口点。

参见[Compose Functional API workflows](/oss/python/langgraph/functional-api-workflows)。

**2.配置任务**

当步骤可能失败、挂起或重复时添加可靠性控制。* 暂时失败时重试
* 慢速任务或入口点的超时
* 缓存昂贵的重复工作
* 出错后继续，无需重做已完成的任务

参见[Configure Functional API tasks](/oss/python/langgraph/functional-api-tasks)。

**3.直播进度**

在工作流程运行时流式传输更新、模型令牌或自定义数据。

参见[Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)。

**4.添加人机交互**

暂停批准或工具调用审查并中断，然后使用 `Command` 恢复。

参见[Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)。

**5.添加内存**

使用检查指针保存短期线程状态，使用存储保存长期数据。

参见[Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)。

## 后续步骤

* [Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)
* [Functional API overview](/oss/python/langgraph/functional-api)
* [Compose Functional API workflows](/oss/python/langgraph/functional-api-workflows)
* [Configure Functional API tasks](/oss/python/langgraph/functional-api-tasks)
* [Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)
* [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)
* [Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)
* [LangGraph quickstart](/oss/python/langgraph/quickstart)
* [Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。