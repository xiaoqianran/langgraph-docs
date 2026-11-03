<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Thinking in the Graph API | https://docs.langchain.com/oss/python/langgraph/thinking-in-graph-api -->

# 图 API 的思考

了解如何使用节点、边和共享状态通过 LangGraph Graph API 设计代理。

当您使用[Graph API](/oss/python/langgraph/graph-api)构建代理时，您可以将流程分解为称为**节点**的离散步骤。然后描述每个节点的决策和转换。最后，通过每个节点都可以读取和写入的共享**状态**连接节点。

本演练使用 Graph API 构建客户支持电子邮件代理。对于功能 API 的相同场景，请参阅[Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)。要在 API 之间进行选择，请参阅[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)。

## 从您想要自动化的流程开始

想象一下，您需要构建一个处理客户支持电子邮件的人工智能代理。您的产品团队向您提出了以下要求：

```txt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
The agent should:

- Read incoming customer emails
- Classify them by urgency and topic
- Search relevant documentation to answer questions
- Draft appropriate responses
- Escalate complex issues to human agents

Example scenarios to handle:

1. Simple product question: "How do I reset my password?"
2. Bug report: "The export feature crashes when I select PDF format"
3. Urgent billing issue: "I was charged twice for my subscription!"
4. Feature request: "Can you add dark mode to the mobile app?"
5. Complex technical issue: "Our API integration fails intermittently with 504 errors"
```

要使用 Graph API 实现代理，本指南向您展示了五个步骤。第 1 步和第 2 步是规划。步骤 3 到 5 将该计划转换为状态、节点和可以运行的编译图。

## 第 1 步：将您的工作流程规划为离散步骤

首先确定流程中的不同步骤。每个步骤都成为一个**节点**（执行一项特定操作的函数）。然后勾画出这些步骤是如何连接的。在编写代码之前执行此操作。

![Graph API control flow: START through classify and draft, then human review or send, to END](https://mintcdn.com/langchain-5e9cc07a/fVUPpLd2squx_ubj/images/langgraph-graph-thinking-flow.svg?fit=max\&auto=format\&n=fVUPpLd2squx_ubj\&q=85\&s=76cebca75b2c16990b7f0dc883b4a050)实线箭头是固定边：您在构建图形时声明它们，因为下一个节点在运行之前是已知的。虚线箭头是运行时在具有 [⟦T6⟧](https://reference.langchain.com/python/langgraph/types/Command) 的节点内选择的路由。

现在组件已经确定，接下来澄清每个节点需要做什么：

* `Read Email`：提取并解析电子邮件内容
* `Classify Intent`：使用法学硕士对紧急程度和主题进行分类，然后路由到搜索、错误跟踪或草稿
* `Doc Search`：查询您的知识库以获取相关信息
* `Bug Track`：在跟踪系统中创建或更新问题
* `Draft Reply`：生成适当的响应，然后路由至人工审核或发送
* `Human Review`：升级至人工代理以供批准或处理
* `Send Reply`：发送邮件回复

> [!提示]
>
> 某些节点始终在固定边上延续（`Read Email` 到 `Classify Intent`）。其他人选择具有`Command`（`Classify Intent`，`Draft Reply`，`Human Review`）的下一个节点。

## 步骤 2：确定每个步骤需要做什么

对于步骤 1 中的每个节点，确定它是什么类型的工作以及它需要什么上下文。使用下面的类别，然后展开具体字段的电子邮件代理示例并重试选择。

> [卡][LLM steps](#llm-steps)
>
> 当您需要理解、分析、生成文本或做出推理决策时使用> [卡][Data steps](#data-steps)
>
> 当您需要从外部来源检索信息时使用

> [卡][Action steps](#action-steps)
>
> 当您需要执行外部操作时使用

> [卡][User input steps](#user-input-steps)
>
> 当需要人工干预时使用

### LLM步骤

当某个步骤需要理解、分析、生成文本或做出推理决策时：

> [手风琴] 分类意图
>
> * 静态上下文（提示）：分类类别、紧急程度定义、响应格式
> * 动态上下文（来自状态）：电子邮件内容、发件人信息
> * 期望的结果：确定路由的结构化分类

> [手风琴] 草稿回复
>
> * 静态上下文（提示）：语气指南、公司政策、响应模板
> * 动态上下文（来自状态）：分类结果、搜索结果
> * 期望的结果：专业的电子邮件回复可供审核

### 数据步骤

当步骤需要从外部源检索信息时：

> [手风琴] 文档搜索
>
> * 参数：根据意图和主题构建的查询
> * 重试策略：是的，针对瞬时故障采用指数退避
> * 缓存：可以缓存常见查询以减少API调用

### 行动步骤

当步骤需要执行外部操作时：> [手风琴] 发送回复
>
> * 何时执行：批准后（人工或自动）
> * 重试策略：是的，针对网络问题采用指数退避
> * 不应缓存：每次发送都是一个唯一的操作

> [手风琴] Bug 轨迹
>
> * 何时执行：总是当意图是“bug”时
> * 重试策略：是的，对于不丢失错误报告至关重要
> * 返回：要包含在响应中的票证 ID

### 用户输入步骤

当某个步骤需要人工干预时：

> [手风琴] 人工审查
>
> * 决策背景：原始电子邮件、草稿回复、紧急程度、分类
> * 预期输入格式：批准布尔值加上可选的编辑响应
> * 触发时：高度紧急、计费或复杂问题
> * 拒绝时：结束运行而不发送（人工处理图表外的电子邮件）

## 步骤 3：设计你的状态

状态是代理中所有节点都可以访问的共享 [memory](/oss/python/concepts/memory)。将其视为您的代理用来跟踪其在整个过程中学习和做出决定的所有内容的笔记本。

### 什么属于状态？

针对每条数据问自己以下问题：

> [卡] 包含在状态中
>
> 是否需要跨步骤坚持？如果是，则进入状态。> [卡]请勿储存
>
> 你能从其他数据中得出它吗？如果是，请在需要时计算它，而不是将其存储在状态中。

对于电子邮件代理，跟踪：

* 原始电子邮件和发件人信息（以后无法重建）
* 分类结果（后面节点需要）
* 搜索结果或工单上下文（重新获取成本高昂）
* 回复草稿（需继续审核）
* 执行元数据（用于调试和恢复）

### 保持状态原始，按需格式化提示

> [!提示]
>
> 以状态存储原始数据，而不是格式化提示文本。当您需要时，格式化节点内的提示。

这种分离意味着：

* 不同的节点可以对相同的数据进行不同的格式化
* 您可以更改提示模板而不更改状态架构
* 调试显示每个节点收到的数据，而不是内置的提示字符串

现在定义状态。后续步骤中的节点将使用这些字段。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal, TypedDict


class EmailClassification(TypedDict):
    intent: Literal["question", "bug", "billing", "feature", "complex"]
    urgency: Literal["low", "medium", "high", "critical"]
    topic: str
    summary: str


class EmailAgentState(TypedDict):
    email_content: str
    sender_email: str
    email_id: str
    classification: EmailClassification | None
    search_results: list[str] | None  # Docs or ticket context
    draft_response: str | None
```

## 步骤 4：构建节点

节点是一个 Python 函数，它获取当前状态并返回更新。当节点也选择下一步时，返回一个[⟦T20⟧](https://reference.langchain.com/python/langgraph/types/Command)。

### 适当地处理错误在填写节点主体之前，请考虑每个节点如何会发生故障。在调用外部 API 的节点上附加重试。使用`interrupt()`进行人工输入。使用此表作为指南：

|错误类型 |谁修的|战略|何时使用 |
| - | - | - | - |
|瞬时错误（网络问题、速率限制）|系统（自动）|节点上的重试策略 |通常重试即可解决的临时故障 |
| LLM 可恢复错误（工具故障、解析问题）|法学硕士 |将错误存储在状态中并返回 |该模型可以根据更多背景进行调整 |
|用户可修复的错误（信息缺失、说明不明确）|人类 |按 `interrupt()` 暂停 |需要用户输入才能继续 |
|重试后可恢复的故障 |开发商 | `error_handler` (Python) / `errorHandler` (TypeScript) |重试耗尽后运行补偿分支 |
|意外错误 |开发商 |运行失败 |需要代码修复的错误 |

有关重试策略、超时、补偿处理程序、LLM 可恢复循环、何时让错误冒泡以及图范围默认值，请参阅[Fault tolerance](/oss/python/langgraph/fault-tolerance#recovery-strategies)。

对于此示例，当您添加可能发生暂时性故障的节点时，请附加重试策略：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import RetryPolicy

workflow.add_node(
    "search_documentation",
    search_documentation,
    retry_policy=RetryPolicy(max_attempts=3),
)
```

### 实现电子邮件代理节点将每个工作单元变成一个节点。每个节点读取共享状态，执行一项工作，然后返回更新。当下一步取决于结果时，返回包含更新和目的地的`Command`。人工审查仍然是一个节点：它在函数内部调用`interrupt()`，而不是单独的图元。

下面的存根显示了电子邮件代理的签名、状态更新和路由。将占位符主体替换为您真正的 LLM 调用和 API 集成。将这些节点放入与步骤 3 中的状态相同的文件中。

`read_email`是本演练中的一个穿越。保留它作为自己的节点仍然可以在分类之前为您提供一个检查点，并在以后添加真正的 MIME 解析。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal

from langgraph.graph import END
from langgraph.types import Command, interrupt


def read_email(state: EmailAgentState) -> dict:
    """Parse and normalize the incoming email."""
    return {}


def classify_intent(
    state: EmailAgentState,
) -> Command[Literal["search_documentation", "bug_tracking", "draft_response"]]:
    """Classify intent and urgency, then route to gather context or draft."""
    # Placeholder: replace with a real LLM call.
    # This heuristic matches the try-out sample so interrupt() runs.
    lowered = state["email_content"].lower()
    if "charged" in lowered or "billing" in lowered:
        classification: EmailClassification = {
            "intent": "billing",
            "urgency": "high",
            "topic": "billing",
            "summary": "Customer reports a billing problem",
        }
    elif "crash" in lowered or "bug" in lowered:
        classification = {
            "intent": "bug",
            "urgency": "medium",
            "topic": "product bug",
            "summary": "Customer reports a bug",
        }
    else:
        classification = {
            "intent": "question",
            "urgency": "low",
            "topic": "general",
            "summary": "Customer question",
        }

    if classification["intent"] in ("question", "feature"):
        goto = "search_documentation"
    elif classification["intent"] == "bug":
        goto = "bug_tracking"
    else:
        goto = "draft_response"

    return Command(update={"classification": classification}, goto=goto)


def search_documentation(
    state: EmailAgentState,
) -> Command[Literal["draft_response"]]:
    """Search knowledge base for relevant information."""
    classification = state.get("classification") or {}
    topic = classification.get("topic", "general")
    return Command(
        update={"search_results": [f"Docs related to {topic}"]},
        goto="draft_response",
    )


def bug_tracking(state: EmailAgentState) -> Command[Literal["draft_response"]]:
    """Create or update a bug tracking ticket."""
    ticket_id = "BUG-12345"
    return Command(
        update={"search_results": [f"Bug ticket {ticket_id} created"]},
        goto="draft_response",
    )


def draft_response(
    state: EmailAgentState,
) -> Command[Literal["human_review", "send_reply"]]:
    """Draft a reply, then route to review or send."""
    classification = state.get("classification") or {}
    context = state.get("search_results") or []
    draft = f"Thanks for your email about {classification.get('topic', 'your request')}."
    if context:
        draft += f" Context: {context[0]}"

    needs_review = (
        classification.get("intent") in ("billing", "complex")
        or classification.get("urgency") in ("high", "critical")
    )
    goto = "human_review" if needs_review else "send_reply"
    return Command(update={"draft_response": draft}, goto=goto)


def human_review(
    state: EmailAgentState,
) -> Command[Literal["send_reply", END]]:
    """Pause for human review, then send or end."""
    classification = state.get("classification") or {}

    # Nodes re-run from the start on resume. Keep work before interrupt() idempotent.
    human_decision = interrupt(
        {
            "email_id": state.get("email_id", ""),
            "original_email": state.get("email_content", ""),
            "draft_response": state.get("draft_response", ""),
            "urgency": classification.get("urgency"),
            "intent": classification.get("intent"),
            "action": "Please review and approve/edit this response",
        }
    )

    if human_decision.get("approved"):
        return Command(
            update={
                "draft_response": human_decision.get(
                    "edited_response", state.get("draft_response", "")
                )
            },
            goto="send_reply",
        )
    # Rejection: human handles the email outside the graph
    return Command(update={}, goto=END)


def send_reply(state: EmailAgentState) -> dict:
    """Send the email response."""
    return {}
```

您现在拥有节点功能。接下来，将它们连接到编译的图中。

## 步骤 5：将其连接在一起

将节点连接成图表。因为路由位于 `Command` 节点内部，所以您只需要一些固定边。使用 [checkpointer](/oss/python/langgraph/persistence) 进行编译，这是 `interrupt()` 暂停和恢复所必需的。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy

workflow = StateGraph(EmailAgentState)

workflow.add_node("read_email", read_email)
workflow.add_node("classify_intent", classify_intent)
workflow.add_node(
    "search_documentation",
    search_documentation,
    retry_policy=RetryPolicy(max_attempts=3),
)
workflow.add_node(
    "bug_tracking",
    bug_tracking,
    retry_policy=RetryPolicy(max_attempts=3),
)
workflow.add_node("draft_response", draft_response)
workflow.add_node("human_review", human_review)
workflow.add_node("send_reply", send_reply)

workflow.add_edge(START, "read_email")
workflow.add_edge("read_email", "classify_intent")
workflow.add_edge("send_reply", END)

checkpointer = InMemorySaver()
app = workflow.compile(checkpointer=checkpointer)
```

返回 `Command[Literal[...]]` 的 Python 节点在类型提示中声明其目的地。 LangGraph 使用它来了解有效边。

### 试试你的代理编译图表后，使用示例电子邮件调用它。使用上面的占位符分类器，这条紧急计费消息被视为高度紧急，因此运行起草回复，点击`interrupt()`，然后您可以练习恢复。对于第一次调用和恢复调用使用相同的`thread_id`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

config = {"configurable": {"thread_id": "customer_123"}}

result = app.invoke(
    {
        "email_content": "I was charged twice for my subscription! This is urgent!",
        "sender_email": "customer@example.com",
        "email_id": "email_123",
    },
    config,
)
# The graph pauses at human_review when urgency is high

app.invoke(
    Command(
        resume={
            "approved": True,
            "edited_response": "We sincerely apologize for the double charge. I've initiated an immediate refund...",
        }
    ),
    config,
)
```

该图在`interrupt()`处暂停，将状态保存到检查指针，然后等待。当您使用 `Command(resume=...)` 恢复时，`human_review` 节点从头开始重新运行，`interrupt()` 返回您的恢复值，并且图表继续。 `thread_id` 将该对话的状态保持在一起。

## 摘要和后续步骤

### 关键见解

构建这个电子邮件代理展示了 Graph API 的思维方式：

> [卡][Break into discrete steps](#step-1-map-out-your-workflow-as-discrete-steps)
>
> 每个节点只做好一件事。节点边界是图检查点的位置，因此故障和恢复重做的工作较少。

> [卡][State is shared memory](#step-3-design-your-state)
>
> 存储原始数据，而不是格式化文本。不同的节点可以以不同的方式使用相同的信息。

> [卡][Nodes are functions](#step-4-build-your-nodes)
>
> 它们获取状态、工作并返回更新。当他们路由时，他们会返回更新和下一个目的地与`Command`。

> [卡][Errors are part of the flow](#handle-errors-appropriately)
>
> 瞬时故障获取节点重试策略，用户可修复的问题以 `interrupt()` 暂停，意外错误导致运行失败。> [卡][Human input is first-class](/oss/python/langgraph/interrupts)
>
> `interrupt()` 暂停执行并保存状态。恢复时，节点从头开始重新运行，因此请在 `interrupt()` 幂等之前保持工作。

> [卡][Graph structure stays minimal](#step-5-wire-it-together)
>
> 您声明必要的优势。需要动态路由的节点返回`Command`，这使得控制流保持明确且可追踪。

### 节点粒度权衡

大多数应用程序都可以使用上面的细分。当您决定是否合并或拆分节点时，请阅读本节。

**节点**边界处的LangGraph检查点。当运行在中断或失败后恢复时，它将从执行停止的节点的开头重新启动。较小的节点意味着更频繁的检查点和更少的重复工作。

为什么此细分适合电子邮件代理：

* **外部服务的隔离：** 文档搜索和错误跟踪是单独的节点，因此重试的范围仅限于这些 API 调用。
* **可见性：** 分类是它自己的节点，因此您可以在下一步操作之前检查结构化结果。
* **不同的失败模式：** LLM 调用、查找和电子邮件发送获得不同的重试策略。
* **测试：** 较小的节点更容易进行单元测试和重用。将`Read Email`和`Classify Intent`合并到一个节点是有效的。你会失去它们之间的一个检查点，并在失败时重复这两个检查点。对于大多数代理来说，单独节点的可观察性优势是值得的。

缓存搜索结果是节点函数内的应用程序级选择。 LangGraph 没有为此规定缓存 API。更多节点并不一定意味着运行速度更慢：默认情况下，检查点在后台写入（[async durability mode](/oss/python/langgraph/checkpointers#durability-modes)）。

### 从这里到哪里去

本演练介绍了 Graph API 设计。通过操作方法和相关指南来扩展它：

> [卡][Build checklist](/oss/python/langgraph/use-graph-api)
>
> 状态、控制流、发送、命令和节点的决策指南

> [卡][Define and update state](/oss/python/langgraph/graph-api-state)
>
> 模式、减速器、消息和私有通道

> [卡][Control flow](/oss/python/langgraph/graph-api-control-flow)
>
> 序列、分支、循环和递归限制

> [卡][Send and Command](/oss/python/langgraph/graph-api-send-command)
>
> 一步完成映射减少扇出和更新及布线

> [卡][Configure nodes](/oss/python/langgraph/graph-api-nodes)
>
> 重试、超时、运行时上下文和缓存

> [卡][Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api)
>
> 具有入口点和任务的相同电子邮件代理

> [卡][Human-in-the-loop patterns](/oss/python/langgraph/interrupts)
>
> 刀具审批、批量审批以及其他中断模式

> [卡][Add memory](/oss/python/langgraph/add-memory)
>
> 短期检查点和长期存储

> [卡][Fault tolerance](/oss/python/langgraph/fault-tolerance)
>
> 重试、超时、错误处理程序和图表默认值> [卡][Subgraphs](/oss/python/langgraph/use-subgraphs)
>
> 用于复杂多步骤操作的嵌套图

> [卡][Streaming](/oss/python/langgraph/streaming)
>
> 为用户实时更新进度

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/thinking-in-graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。