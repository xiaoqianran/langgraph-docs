<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Thinking in the Functional API | https://docs.langchain.com/oss/python/langgraph/thinking-in-functional-api -->

# 函数式 API 的思考

了解如何使用入口点、任务和普通控制流通过 LangGraph 功能 API 设计代理。

当您使用[Functional API](/oss/python/langgraph/functional-api)构建代理时，您可以将流程分解为称为**任务**的离散工作单元。您可以使用普通语言控制流（`if`/`else`、循环和函数调用）在 **入口点** 内编写这些任务。值作为返回值在任务之间传递，而不是通过共享图状态模式。

本演练使用功能 API 构建客户支持电子邮件代理。对于使用 Graph API 的相同场景，请参阅[Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)。要在 API 之间进行选择，请参阅[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)。

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

要使用功能 API 实现代理，请遵循以下五个步骤。第 1 步和第 2 步是规划。步骤 3 到 5 将该计划转变为类型、任务和可以运行的入口点。

## 第 1 步：将您的工作流程规划为离散步骤首先确定流程中的不同步骤。每个步骤都成为一个**任务**（执行一项特定操作的函数）。然后概述入口点如何调用这些任务和分支。在编写代码之前执行此操作。

![Functional API control flow: gather and draft on the left, review and send on the right](https://mintcdn.com/langchain-5e9cc07a/fVUPpLd2squx_ubj/images/langgraph-functional-thinking-flow.svg?fit=max\&auto=format\&n=fVUPpLd2squx_ubj\&q=85\&s=1909c205ed0b1d9932a59dc8a1714bac)

该草图反映了入口点：左侧是顺序调用和 `if`/`else`，然后是右侧的人工审核。 Graph API 会将相同的路径编码为节点和边。

现在已经确定了组件，请澄清每个步骤需要做什么：

* `Read Email`：提取并解析电子邮件内容
* `Classify Intent`：使用LLM对紧急程度和主题进行分类
* `Doc Search`：查询您的知识库以获取相关信息
* `Bug Track`：在跟踪系统中创建或更新问题
* `Draft Reply`：生成适当的响应
* `Human Review`：升级至人工代理以供批准或处理
* `Send Reply`：发送邮件回复

> [!提示]
>
> 某些步骤始终按顺序运行（`Read Email` 然后`Classify Intent`）。其他是有条件的（`Doc Search`适用于问题和功能请求，`Bug Track`仅适用于错误）。使用入口点中的普通控制流对这些分支进行编码。

## 步骤 2：确定每个步骤需要做什么对于第 1 步中的每个步骤，确定它是什么类型的工作以及它需要什么输入。使用下面的类别，然后展开具体字段的电子邮件代理示例并重试选择。

> [卡][LLM steps](#llm-steps)
>
> 当您需要理解、分析、生成文本或做出推理决策时使用

> [卡][Data steps](#data-steps)
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
> * 动态上下文（参数）：电子邮件内容、发件人信息
> * 期望的结果：驱动后续分支的结构化分类

> [手风琴] 草稿回复
>
> * 静态上下文（提示）：语气指南、公司政策、响应模板
> * 动态上下文（参数）：分类结果、搜索结果
> * 期望的结果：专业的电子邮件回复可供审核

### 数据步骤

当步骤需要从外部源检索信息时：> [手风琴] 文档搜索
>
> * 参数：根据意图和主题构建的查询
> * 重试策略：是的，针对瞬时故障采用指数退避
> * 缓存：可以缓存常见查询以减少API调用

### 行动步骤

当步骤需要执行外部操作时：

> [手风琴] 发送回复
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
> * 触发时：高度紧急、复杂的问题或质量问题

## 步骤 3：决定在任务之间传递哪些数据在Functional API中，没有共享的图状态模式。每个任务都接受参数并返回一个值。入口点将中间结果保存在局部变量中，并将它们传递给下一个任务。

针对每条数据问自己以下问题：

> [卡片]跨任务分享
>
> 后面的任务需要这个值吗？如果是，则从创建它的任务中**返回**它，将其存储在入口点局部变量中，然后**将**它作为参数传递给需要它的任务。

> [卡片] 将其放在一项任务中
>
> 它仅用于格式化提示或在一个任务内进行调用吗？如果是，请将其保留在该任务的本地。请勿退货。

对于电子邮件代理，入口点需要携带：

* 原始电子邮件和发件人信息（工作流程的输入）
* 分类结果（后续分支和草稿步骤需要）
* 搜索结果（重新获取的成本很高）
* 回复草稿（需要通过审核并发送）

> [!提示]
>
> 存储和传递原始数据，而不是格式化的提示文本。在调用模型的任务内格式化提示。这使得任务可重用，并使检查点更容易检查。定义任务交换值的类型。这些是普通的 TypedDict 或 TypeScript 类型，而不是 Graph API 状态模式。立即将它们添加到您的文件中；后续步骤中的任务和入口点将使用它们。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal, TypedDict


class EmailClassification(TypedDict):
    intent: Literal["question", "bug", "billing", "feature", "complex"]
    urgency: Literal["low", "medium", "high", "critical"]
    topic: str
    summary: str


class EmailInput(TypedDict):
    email_content: str
    sender_email: str
```

## 第 4 步：构建您的任务

将每个步骤 1 的工作单元转化为一项任务。任务独立检查点，可以在失败时重试，并返回入口点可以等待的值。

[⟦T20⟧](https://reference.langchain.com/python/langgraph/func/task) 是一个 Python 函数，它执行一个工作单元并返回结果。从入口点调用它并使用 `.result()`（或异步入口点中的 `await`）解析它。

### 适当地处理错误

在填写任务正文之前，请考虑每个任务可能会失败的原因。为暂时性错误附加任务重试。在人工输入的入口点使用`interrupt()`。使用此表作为指南：|错误类型 |谁修的|战略|何时使用 |
| - | - | - | - |
|瞬时错误（网络问题、速率限制）|系统（自动）|任务的重试策略 |通常重试即可解决的临时故障 |
| LLM 可恢复错误（工具故障、解析问题）|法学硕士 |返回错误并在入口点分支或重试 |该模型可以根据更多背景进行调整 |
|用户可修复的错误（信息缺失、说明不明确）|人类 |按 `interrupt()` 暂停 |需要用户输入才能继续 |
|意外错误 |开发商 |运行失败 |需要代码修复的错误 |

### 实现电子邮件代理任务

从步骤 1 开始，每个步骤添加一项任务（人工审核除外，人工审核在步骤 5 的入口点中使用 `interrupt()`）。下面的存根显示了电子邮件代理的函数签名、返回形状和重试策略。将占位符主体替换为您真正的 LLM 调用和 API 集成。将这些任务与步骤 3 中的类型放在同一文件中。

`read_email`是这里的一个passthrough。将其作为自己的任务仍然可以在分类之前为您提供一个检查点，并在以后添加真正的 MIME 解析。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.func import task
from langgraph.types import RetryPolicy


@task
def read_email(email_content: str, sender_email: str) -> dict:
    """Parse and normalize the incoming email."""
    return {
        "email_content": email_content,
        "sender_email": sender_email,
    }


@task
def classify_intent(email_content: str, sender_email: str) -> EmailClassification:
    """Classify intent and urgency with an LLM."""
    # Placeholder: replace with a real LLM call.
    # This heuristic matches the try-out sample so interrupt() runs.
    lowered = email_content.lower()
    if "charged" in lowered or "billing" in lowered:
        return {
            "intent": "billing",
            "urgency": "high",
            "topic": "billing",
            "summary": "Customer reports a billing problem",
        }
    if "crash" in lowered or "bug" in lowered:
        return {
            "intent": "bug",
            "urgency": "medium",
            "topic": "product bug",
            "summary": "Customer reports a bug",
        }
    return {
        "intent": "question",
        "urgency": "low",
        "topic": "general",
        "summary": "Customer question",
    }


@task(retry_policy=RetryPolicy(max_attempts=3))
def search_documentation(topic: str, summary: str) -> list[str]:
    """Query the knowledge base for relevant chunks."""
    return [f"Docs related to {topic}"]


@task(retry_policy=RetryPolicy(max_attempts=3))
def create_bug_ticket(
    email_content: str, sender_email: str, summary: str
) -> str:
    """Create a ticket and return its ID."""
    return "TICKET-123"


@task
def draft_response(
    email_content: str,
    classification: EmailClassification,
    context: list[str],
) -> str:
    """Draft a reply from the email, classification, and gathered context."""
    return f"Thanks for your email about {classification['topic']}."


@task
def send_reply(draft: str, sender_email: str) -> None:
    """Send the approved reply."""
    return None
```

您现在有了可调用的任务。接下来，将它们组合到入口点中。## 步骤 5：编写入口点

入口点是工作流程。将其添加到任务下方。它按顺序调用这些任务，使用`if`/`else`（步骤 1 中的控制流）进行分支，并使用`interrupt()` 为人类暂停。当您需要持久执行和人参与时，请提供[checkpointer](/oss/python/langgraph/persistence)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint
from langgraph.types import interrupt

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def email_agent(inputs: EmailInput) -> dict:
    parsed = read_email(inputs["email_content"], inputs["sender_email"]).result()
    classification = classify_intent(
        parsed["email_content"], parsed["sender_email"]
    ).result()

    context: list[str] = []
    if classification["intent"] in ("question", "feature"):
        context = search_documentation(
            classification["topic"], classification["summary"]
        ).result()
    elif classification["intent"] == "bug":
        ticket_id = create_bug_ticket(
            parsed["email_content"],
            parsed["sender_email"],
            classification["summary"],
        ).result()
        context = [f"Ticket created: {ticket_id}"]

    draft = draft_response(
        parsed["email_content"], classification, context
    ).result()

    # Pause for human review on billing, urgent, or complex issues
    if (
        classification["intent"] in ("billing", "complex")
        or classification["urgency"] in ("high", "critical")
    ):
        human_decision = interrupt(
            {
                "email_content": parsed["email_content"],
                "draft_response": draft,
                "classification": classification,
            }
        )
        if not human_decision.get("approved"):
            return {"status": "escalated", "draft": draft}
        draft = human_decision.get("edited_response", draft)

    send_reply(draft, parsed["sender_email"]).result()
    return {"status": "sent", "draft": draft, "classification": classification}
```

### 试试你的代理

定义入口点后，使用示例电子邮件调用它。使用上面的占位符分类器，此紧急计费消息被视为高度紧急，因此运行达到`interrupt()`，您可以练习恢复。对于第一次调用和恢复调用使用相同的`thread_id`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

config = {"configurable": {"thread_id": "customer_123"}}

result = email_agent.invoke(
    {
        "email_content": "I was charged twice for my subscription! This is urgent!",
        "sender_email": "customer@example.com",
    },
    config,
)
# The workflow pauses at interrupt() when urgency is high

# Resume with the human decision
email_agent.invoke(
    Command(
        resume={
            "approved": True,
            "edited_response": "We sincerely apologize for the double charge. I've initiated an immediate refund...",
        }
    ),
    config,
)
```

工作流在`interrupt()`暂停，将已完成的任务结果保存到检查指针，然后等待。当您使用 `Command(resume=...)` 恢复时，已完成的任务将从检查点重新加载，而不是重新运行。 `thread_id` 将该对话的状态保持在一起。

## 摘要和后续步骤

### 关键见解

构建此电子邮件代理展示了功能 API 的思维方式：

> [卡][Break into discrete tasks](#step-1-map-out-your-workflow-as-discrete-steps)
>
> 每项任务只做好一件事。任务边界是结果检查点，因此失败和恢复重做的工作较少。> [卡][Pass values, do not share graph state](#step-3-decide-what-data-to-pass-between-tasks)
>
> 从任务返回原始数据并将其作为参数传递。在需要它的任务中保留提示格式。

> [卡][Entrypoints own control flow](#step-5-compose-the-entrypoint)
>
> 使用`if`/`else`、循环和调用。您无需声明边或条件边映射。

> [卡][Errors are part of the flow](#handle-errors-appropriately)
>
> 瞬时失败会获取任务重试策略，用户可修复的问题会因 `interrupt()` 暂停，意外错误会导致运行失败。

> [卡][Human input is first-class](/oss/python/langgraph/interrupts)
>
> `interrupt()` 暂停执行，保存已完成的任务结果，并在您提供输入时恢复。

> [卡][Composition stays in code](#step-5-compose-the-entrypoint)
>
> 工作流程读起来就像一个普通函数。这适合现有的程序代码和快速迭代。

### 任务粒度权衡

大多数应用程序都可以使用上面的细分。当您决定是否合并或拆分任务时，请阅读本节。

LangGraph 在入口点内的**任务**边界处设置检查点。当运行在中断或失败后恢复时，已完成的任务结果将从检查点加载。位于任务外部的入口点主体中的工作可以再次运行。

为什么此细分适合电子邮件代理：* **外部服务的隔离：** 文档搜索和错误跟踪是单独的任务，因此重试和失败仅限于这些 API 调用。
* **可见性：** 分类是它自己的任务，因此您可以在分支之前检查结构化结果。
* **不同的故障模式：** LLM 调用、数据库查找和电子邮件发送获得不同的重试策略。
* **测试：** 较小的任务更容易进行单元测试和重用。

将 `read_email` 和 `classify_intent` 合并到一个任务中是有效的。你会失去它们之间的一个检查点，并在失败时重复这两个检查点。对于大多数智能体来说，单独任务的可观察性好处是值得的。

### 从这里到哪里去

本演练介绍了函数式 API 设计。扩展它：

> [卡][Build checklist](/oss/python/langgraph/use-functional-api)
>
> 工作流程、任务、流、中断和内存的决策指南

> [卡][Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)
>
> 具有节点、边和共享状态的相同电子邮件代理

> [卡][Compose workflows](/oss/python/langgraph/functional-api-workflows)
>
> 并行任务、调用图和嵌套入口点

> [卡][Configure tasks](/oss/python/langgraph/functional-api-tasks)
>
> 重试、超时、缓存和错误后恢复

> [卡][Human-in-the-loop](/oss/python/langgraph/functional-api-human-in-the-loop)
>
> 批准和工具审查的中断模式

> [卡][Add memory](/oss/python/langgraph/functional-api-memory)
>
> 短期检查点和长期存储

***[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/thinking-in-functional-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。