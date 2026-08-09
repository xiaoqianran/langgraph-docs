<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Thinking in LangGraph | https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph -->

# LangGraph 中的思考

了解如何考虑使用 LangGraph 构建代理

当您使用 LangGraph 构建代理时，您首先将其分解为称为 **节点** 的离散步骤。然后，您将描述每个节点的不同决策和转换。最后，通过每个节点都可以读取和写入的共享**状态**将节点连接在一起。

在本演练中，我们将引导您完成使用 LangGraph 构建客户支持电子邮件代理的思维过程。

## 从您想要自动化的流程开始

想象一下，您需要构建一个处理客户支持电子邮件的人工智能代理。您的产品团队向您提出了以下要求：

```txt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
The agent should:

- Read incoming customer emails
- Classify them by urgency and topic
- Search relevant documentation to answer questions
- Draft appropriate responses
- Escalate complex issues to human agents
- Schedule follow-ups when needed

Example scenarios to handle:

1. Simple product question: "How do I reset my password?"
2. Bug report: "The export feature crashes when I select PDF format"
3. Urgent billing issue: "I was charged twice for my subscription!"
4. Feature request: "Can you add dark mode to the mobile app?"
5. Complex technical issue: "Our API integration fails intermittently with 504 errors"
```

要在 LangGraph 中实现代理，您通常会遵循相同的五个步骤。

## 第 1 步：将您的工作流程规划为离散步骤

首先确定流程中的不同步骤。每个步骤都将成为一个**节点**（执行一项特定操作的函数）。然后，勾勒出这些步骤如何相互连接。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
flowchart TD
    A[START] --> B[Read Email]
    B --> C[Classify Intent]

    C -.-> D[Doc Search]
    C -.-> E[Bug Track]
    C -.-> F[Human Review]

    D --> G[Draft Reply]
    E --> G
    F --> G

    G -.-> H[Human Review]
    G -.-> I[Send Reply]

    H --> J[END]
    I --> J[END]

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    class A,B,C,D,E,F,G,H,I,J process
```

该图中的箭头显示了可能的路径，但实际选择哪条路径的决定发生在每个节点内部。现在我们已经确定了工作流程中的组件，让我们了解每个节点需要做什么：

* `Read Email`：提取并解析电子邮件内容
* `Classify Intent`：使用法学硕士对紧迫性和主题进行分类，然后采取适当的行动
* `Doc Search`：查询您的知识库以获取相关信息
* `Bug Track`：在跟踪系统中创建或更新问题
* `Draft Reply`：生成适当的响应
* `Human Review`：升级至人工代理以供批准或处理
* `Send Reply`：发送邮件回复

<Tip>
  请注意，某些节点决定下一步要去哪里（`Classify Intent`、`Draft Reply`、`Human Review`），而其他节点始终继续执行相同的下一步（`Read Email` 始终转到 `Classify Intent`，`Doc Search` 始终转到 `Draft Reply`）。
</Tip>

## 步骤 2：确定每个步骤需要做什么

对于图中的每个节点，确定它代表什么类型的操作以及它需要什么上下文才能正常工作。

<CardGroup>
  <Card title="LLM steps" icon="brain" href="#llm-steps">
    当您需要理解、分析、生成文本或做出推理决策时使用
  </Card>

  <Card title="Data steps" icon="database" href="#data-steps">
    当您需要从外部源检索信息时使用
  </Card>

  <Card title="Action steps" icon="bolt" href="#action-steps">
    当您需要执行外部操作时使用
  </Card>

  <Card title="User input steps" icon="user" href="#user-input-steps">
    当需要人工干预时使用
  </Card>
</CardGroup>### LLM步骤

当某个步骤需要理解、分析、生成文本或做出推理决策时：

<AccordionGroup>
  <Accordion title="Classify intent">
    * 静态上下文（提示）：分类类别、紧急程度定义、响应格式
    * 动态上下文（来自状态）：电子邮件内容、发件人信息
    * 期望的结果：确定路由的结构化分类
  </Accordion>

  <Accordion title="Draft reply">
    * 静态上下文（提示）：语气指南、公司政策、响应模板
    * 动态上下文（来自状态）：分类结果、搜索结果、客户历史记录
    * 期望的结果：专业的电子邮件回复可供审核
  </Accordion>
</AccordionGroup>

### 数据步骤

当步骤需要从外部源检索信息时：

<AccordionGroup>
  <Accordion title="Document search">
    * 参数：根据意图和主题构建的查询
    * 重试策略：是的，针对瞬时故障采用指数退避
    * 缓存：可以缓存常见查询以减少API调用
  </Accordion>

  <Accordion title="Customer history lookup">
    * 参数：来自州的客户电子邮件或 ID
    * 重试策略：是，但如果不可用，则回退到基本信息
    * 缓存：是的，通过生存时间来平衡新鲜度和性能
  </Accordion>
</AccordionGroup>

### 行动步骤当步骤需要执行外部操作时：

<AccordionGroup>
  <Accordion title="Send reply">
    * 何时执行节点：批准后（人工或自动）
    * 重试策略：是的，针对网络问题采用指数退避
    * 不应缓存：每次发送都是一个唯一的操作
  </Accordion>

  <Accordion title="Bug track">
    * 何时执行节点：总是当意图是“bug”时
    * 重试策略：是的，对于不丢失错误报告至关重要
    * 返回：响应中包含的票证 ID
  </Accordion>
</AccordionGroup>

### 用户输入步骤

当某个步骤需要人工干预时：

<AccordionGroup>
  <Accordion title="Human review node">
    * 决策背景：原始电子邮件、草稿回复、紧急程度、分类
    * 预期输入格式：批准布尔值加上可选的编辑响应
    * 触发时：高度紧急、复杂的问题或质量问题
  </Accordion>
</AccordionGroup>

## 步骤 3：设计你的状态

状态是代理中所有节点都可以访问的共享 [memory](/oss/javascript/concepts/memory)。将其视为您的代理用来跟踪其在整个过程中学习和做出决定的所有内容的笔记本。

### 什么属于状态？

针对每条数据问自己以下问题：

<CardGroup>
  <Card title="Include in state" icon="check">
    是否需要跨步骤坚持？如果是，则进入状态。
  </Card><Card title="Don't store" icon="code">
    你能从其他数据中得出它吗？如果是，请在需要时计算它，而不是将其存储在状态中。
  </Card>
</CardGroup>

对于我们的电子邮件代理，我们需要跟踪：

* 原始电子邮件和发件人信息（以后无法重建）
* 分类结果（多个后期/下游节点需要）
* 搜索结果和客户数据（重新获取的成本很高）
* 回复草稿（需继续审核）
* 执行元数据（用于调试和恢复）

### 保持状态原始，按需格式化提示

<Tip>
  一个关键原则：您的状态应该存储原始数据，而不是格式化文本。当您需要时，格式化节点内的提示。
</Tip>

这种分离意味着：

* 不同的节点可以根据自己的需要对相同的数据进行不同的格式化
* 您可以更改提示模板而不修改您的状态架构
* 调试更清晰——您可以准确地看到每个节点接收到的数据
* 你的代理可以在不破坏现有状态的情况下发展

让我们定义我们的状态：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema } from "@langchain/langgraph";
import * as z from "zod";

// Define the structure for email classification
const EmailClassificationSchema = z.object({
  intent: z.enum(["question", "bug", "billing", "feature", "complex"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  topic: z.string(),
  summary: z.string(),
});

const EmailAgentState = new StateSchema({
  // Raw email data
  emailContent: z.string(),
  senderEmail: z.string(),
  emailId: z.string(),

  // Classification result
  classification: EmailClassificationSchema.optional(),

  // Raw search/API results
  searchResults: z.array(z.string()).optional(),  // List of raw document chunks
  customerHistory: z.record(z.string(), z.any()).optional(),  // Raw customer data from CRM

  // Generated content
  responseText: z.string().optional(),
});

type EmailClassificationType = z.infer<typeof EmailClassificationSchema>;
```

请注意，状态仅包含原始数据 - 没有提示模板，没有格式化字符串，没有说明。分类输出直接来自法学硕士，存储为单个字典。

## 步骤 4：构建节点现在我们将每个步骤实现为一个函数。 LangGraph 中的节点只是一个 JavaScript 函数，它获取当前状态并返回更新。

### 适当地处理错误

不同的错误需要不同的处理策略：

|错误类型|谁来解决这个问题？战略|何时使用 |
| --------------------------------------------------------------------------- | ----------------------- | ---------------------------------- | -------------------------------------------------------------------- |
|瞬时错误（网络问题、速率限制）|系统（自动）|重试政策 |通常重试即可解决的临时故障 |
| LLM 可恢复错误（工具故障、解析问题）|法学硕士 |将错误存储在状态中并循环返回 | LLM可以看到错误并调整其方法|
|用户可修复的错误（信息缺失、说明不明确）|人类 |按 `interrupt()` 暂停 |需要用户输入才能继续 ||重试后可恢复的故障 |开发人员（声明性）| `error_handler` |重试耗尽后运行补偿/恢复分支 |
|意外错误 |开发商|让它们冒泡|需要调试的未知问题 |

<Tabs>
  <Tab title="Transient errors" icon="rotate">
    添加重试策略以自动重试网络问题和速率限制。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import type { RetryPolicy } from "@langchain/langgraph";

    workflow.addNode(
      "searchDocumentation",
      searchDocumentation,
      {
        retryPolicy: { maxAttempts: 3, initialInterval: 1.0 },
      },
    );
    ```
  </Tab>

  <Tab title="LLM-recoverable" icon="brain">
    将错误存储在状态中并循环返回，以便 LLM 可以看到出了什么问题并重试：

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Command, GraphNode } from "@langchain/langgraph";

    const executeTool: GraphNode<typeof State> = async (state, config) => {
      try {
        const result = await runTool(state.toolCall);
        return new Command({
          update: { toolResult: result },
          goto: "agent",
        });
      } catch (error) {
        // Let the LLM see what went wrong and try again
        return new Command({
          update: { toolResult: `Tool error: ${error}` },
          goto: "agent"
        });
      }
    }
    ```
  </Tab>

  <Tab title="User-fixable" icon="user">
    需要时暂停并收集用户信息（例如帐户 ID、订单号或说明）：

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Command, GraphNode, interrupt } from "@langchain/langgraph";

    const lookupCustomerHistory: GraphNode<typeof State> = async (state, config) => {
      if (!state.customerId) {
        const userInput = interrupt({
          message: "Customer ID needed",
          request: "Please provide the customer's account ID to look up their subscription history",
        });
        return new Command({
          update: { customerId: userInput.customerId },
          goto: "lookupCustomerHistory",
        });
      }
      // Now proceed with the lookup
      const customerData = await fetchCustomerHistory(state.customerId);
      return new Command({
        update: { customerHistory: customerData },
        goto: "draftResponse",
      });
    }
    ```
  </Tab>

  <Tab title="Unexpected" icon="alert-triangle">
    让它们冒泡进行调试。不要抓住你无法处理的东西：

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Command, GraphNode } from "@langchain/langgraph";

    const sendReply: GraphNode<typeof EmailAgentState> = async (state, config) => {
      try {
        await emailService.send(state.responseText);
      } catch (error) {
        throw error;  // Surface unexpected errors
      }
    }
    ```
  </Tab>

  <Tab title="Saga / compensation" icon="arrows-exchange">
    重试次数耗尽后，运行恢复功能来更新状态并路由到补偿分支。
  </Tab>
</Tabs>

### 实现我们的电子邮件代理节点

我们将把每个节点实现为一个简单的函数。请记住：节点获取状态、工作并返回更新。

<AccordionGroup>
  <Accordion title="Read and classify nodes" icon="brain">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { StateGraph, START, END, GraphNode, Command } from "@langchain/langgraph";
    import { HumanMessage } from "@langchain/core/messages";
    import { ChatAnthropic } from "@langchain/anthropic";

    const llm = new ChatAnthropic({ model: "claude-sonnet-4-6" });

    const readEmail: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Extract and parse email content
      // In production, this would connect to your email service
      console.log(`Processing email: ${state.emailContent}`);
      return {};
    }

    const classifyIntent: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Use LLM to classify email intent and urgency, then route accordingly

      // Create structured LLM that returns EmailClassification object
      const structuredLlm = llm.withStructuredOutput(EmailClassificationSchema);

      // Format the prompt on-demand, not stored in state
      const classificationPrompt = `
      Analyze this customer email and classify it:

      Email: ${state.emailContent}
      From: ${state.senderEmail}

      Provide classification including intent, urgency, topic, and summary.
      `;

      // Get structured response directly as object
      const classification = await structuredLlm.invoke(classificationPrompt);

      // Determine next node based on classification
      let nextNode: "searchDocumentation" | "humanReview" | "draftResponse" | "bugTracking";

      if (classification.intent === "billing" || classification.urgency === "critical") {
        nextNode = "humanReview";
      } else if (classification.intent === "question" || classification.intent === "feature") {
        nextNode = "searchDocumentation";
      } else if (classification.intent === "bug") {
        nextNode = "bugTracking";
      } else {
        nextNode = "draftResponse";
      }

      // Store classification as a single object in state
      return new Command({
        update: { classification },
        goto: nextNode,
      });
    }
    ```
  </Accordion>

  <Accordion title="Search and tracking nodes" icon="database">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Command, GraphNode } from "@langchain/langgraph";

    const searchDocumentation: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Search knowledge base for relevant information

      // Build search query from classification
      const classification = state.classification!;
      const query = `${classification.intent} ${classification.topic}`;

      let searchResults: string[];

      try {
        // Implement your search logic here
        // Store raw search results, not formatted text
        searchResults = [
          "Reset password via Settings > Security > Change Password",
          "Password must be at least 12 characters",
          "Include uppercase, lowercase, numbers, and symbols",
        ];
      } catch (error) {
        // For recoverable search errors, store error and continue
        searchResults = [`Search temporarily unavailable: ${error}`];
      }

      return new Command({
        update: { searchResults },  // Store raw results or error
        goto: "draftResponse",
      });
    }

    const bugTracking: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Create or update bug tracking ticket

      // Create ticket in your bug tracking system
      const ticketId = "BUG-12345";  // Would be created via API

      return new Command({
        update: { searchResults: [`Bug ticket ${ticketId} created`] },
        goto: "draftResponse",
      });
    }
    ```
  </Accordion><Accordion title="Response nodes" icon="edit">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { Command, interrupt } from "@langchain/langgraph";

    const draftResponse: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Generate response using context and route based on quality

      const classification = state.classification!;

      // Format context from raw state data on-demand
      const contextSections: string[] = [];

      if (state.searchResults) {
        // Format search results for the prompt
        const formattedDocs = state.searchResults.map(doc => `- ${doc}`).join("\n");
        contextSections.push(`Relevant documentation:\n${formattedDocs}`);
      }

      if (state.customerHistory) {
        // Format customer data for the prompt
        contextSections.push(`Customer tier: ${state.customerHistory.tier ?? "standard"}`);
      }

      // Build the prompt with formatted context
      const draftPrompt = `
      Draft a response to this customer email:
      ${state.emailContent}

      Email intent: ${classification.intent}
      Urgency level: ${classification.urgency}

      ${contextSections.join("\n\n")}

      Guidelines:
      - Be professional and helpful
      - Address their specific concern
      - Use the provided documentation when relevant
      `;

      const response = await llm.invoke([new HumanMessage(draftPrompt)]);

      // Determine if human review needed based on urgency and intent
      const needsReview = (
        classification.urgency === "high" ||
        classification.urgency === "critical" ||
        classification.intent === "complex"
      );

      // Route to appropriate next node
      const nextNode = needsReview ? "humanReview" : "sendReply";

      return new Command({
        update: { responseText: response.content.toString() },  // Store only the raw response
        goto: nextNode,
      });
    }

    const humanReview: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Pause for human review using interrupt and route based on decision
      const classification = state.classification!;

      // interrupt() must come first - any code before it will re-run on resume
      const humanDecision = interrupt({
        emailId: state.emailId,
        originalEmail: state.emailContent,
        draftResponse: state.responseText,
        urgency: classification.urgency,
        intent: classification.intent,
        action: "Please review and approve/edit this response",
      });

      // Now process the human's decision
      if (humanDecision.approved) {
        return new Command({
          update: { responseText: humanDecision.editedResponse || state.responseText },
          goto: "sendReply",
        });
      } else {
        // Rejection means human will handle directly
        return new Command({ update: {}, goto: END });
      }
    }

    const sendReply: GraphNode<typeof EmailAgentState> = async (state, config) => {
      // Send the email response
      // Integrate with email service
      console.log(`Sending reply: ${state.responseText!.substring(0, 100)}...`);
      return {};
    }
    ```
  </Accordion>
</AccordionGroup>

## 步骤 5：将其连接在一起

现在我们将节点连接到工作图中。由于我们的节点处理自己的路由决策，因此我们只需要一些必要的边。

要使用 `interrupt()` 启用 [human-in-the-loop](/oss/javascript/langgraph/interrupts)，我们需要使用 [checkpointer](/oss/javascript/langgraph/persistence) 进行编译以保存运行之间的状态：

<Accordion title="Graph compilation code" icon="sitemap">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { MemorySaver, RetryPolicy } from "@langchain/langgraph";

  // Create the graph
  const workflow = new StateGraph(EmailAgentState)
    // Add nodes with appropriate error handling
    .addNode("readEmail", readEmail)
    .addNode("classifyIntent", classifyIntent)
    // Add retry policy for nodes that might have transient failures
    .addNode(
      "searchDocumentation",
      searchDocumentation,
      { retryPolicy: { maxAttempts: 3 } },
    )
    .addNode("bugTracking", bugTracking)
    .addNode("draftResponse", draftResponse)
    .addNode("humanReview", humanReview)
    .addNode("sendReply", sendReply)
    // Add only the essential edges
    .addEdge(START, "readEmail")
    .addEdge("readEmail", "classifyIntent")
    .addEdge("sendReply", END);

  // Compile with checkpointer for persistence
  const memory = new MemorySaver();
  const app = workflow.compile({ checkpointer: memory });
  ```
</Accordion>

图结构很小，因为路由通过 `Command` 对象在节点内部发生。每个节点都声明它可以去哪里，使流程明确且可追踪。

### 试试你的代理

让我们的代理处理一个需要人工审核的紧急计费问题：

<Accordion title="Testing the agent" icon="flask">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  // Test with an urgent billing issue
  const initialState: EmailAgentStateType = {
    emailContent: "I was charged twice for my subscription! This is urgent!",
    senderEmail: "customer@example.com",
    emailId: "email_123"
  };

  // Run with a thread_id for persistence
  const config = { configurable: { thread_id: "customer_123" } };
  const result = await app.invoke(initialState, config);
  // The graph will pause at human_review
  console.log(`Draft ready for review: ${result.responseText?.substring(0, 100)}...`);
  ```

  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { Command } from "@langchain/langgraph";

  // When ready, provide human input to resume
  const humanResponse = new Command({
    resume: {
      approved: true,
      editedResponse: "We sincerely apologize for the double charge. I've initiated an immediate refund...",
    }
  });

  // Resume execution
  const finalResult = await app.invoke(humanResponse, config);
  console.log("Email sent successfully!");
  ```
</Accordion>

当到达 `interrupt()` 时，图表会暂停，将所有内容保存到检查指针，然后等待。它可以在几天后恢复，从上次中断的地方继续。 `thread_id` 确保此会话的所有状态都保存在一起。

## 摘要和后续步骤

### 关键见解

构建这个电子邮件代理向我们展示了 LangGraph 的思维方式：

<CardGroup>
  <Card title="Break into discrete steps" icon="sitemap" href="#step-1-map-out-your-workflow-as-discrete-steps">
    每个节点只做好一件事。这种分解可以实现流式进度更新、可以暂停和恢复的持久执行以及清晰的调试，因为您可以检查步骤之间的状态。
  </Card><Card title="State is shared memory" icon="database" href="#step-3-design-your-state">
    存储原始数据，而不是格式化文本。这使得不同的节点以不同的方式使用相同的信息。
  </Card>

  <Card title="Nodes are functions" icon="code" href="#step-4-build-your-nodes">
    它们获取状态、工作并返回更新。当他们需要做出路由决策时，他们会指定状态更新和下一个目的地。
  </Card>

  <Card title="Errors are part of the flow" icon="alert-triangle" href="#handle-errors-appropriately">
    瞬时故障会重试，LLM 可恢复错误会与上下文一起循环，用户可修复的问题会暂停以进行输入，意外错误会冒泡以进行调试。
  </Card>

  <Card title="Human input is first-class" icon="user" href="/oss/javascript/langgraph/interrupts">
    `interrupt()` 函数无限期地暂停执行，保存所有状态，并在您提供输入时从中断处准确恢复。当与节点中的其他操作结合时，它必须先出现。
  </Card>

  <Card title="Graph structure emerges naturally" icon="sitemap" href="#step-5-wire-it-together">
    您定义必要的连接，并且您的节点处理它们自己的路由逻辑。这使控制流保持明确和可追踪 - 您始终可以通过查看当前节点来了解代理接下来要做什么。
  </Card>
</CardGroup>

### 高级注意事项

<Accordion title="Node granularity trade-offs" icon="adjustments">
  <Info>
    本节探讨节点粒度设计中的权衡。大多数应用程序可以跳过此步骤并使用上面显示的模式。
  </Info>你可能会想：为什么不将 `Read Email` 和 `Classify Intent` 组合成一个节点呢？

  或者为什么要将文档搜索与草稿回复分开？

  答案涉及弹性和可观察性之间的权衡。

  **弹性考虑：** LangGraph的[persistence layer](/oss/javascript/langgraph/persistence)在节点边界创建检查点。当工作流在中断或失败后恢复时，它将从执行停止的节点的开头开始。较小的节点意味着更频繁的检查点，这意味着出现问题时需要重复的工作更少。如果将多个操作合并到一个大节点中，则临近结束时发生故障意味着从该节点开始处重新执行所有操作。

  为什么我们为电子邮件代理选择此细分：

  * **外部服务的隔离：** Doc Search 和 Bug Track 是单独的节点，因为它们调用外部 API。如果搜索服务缓慢或失败，我们希望将其与 LLM 调用隔离。我们可以为这些特定节点添加重试策略，而不影响其他节点。* **中等可见性：** 将 `Classify Intent` 作为自己的节点，让我们可以在采取行动之前检查 LLM 的决定。这对于调试和监控非常有价值 - 您可以准确地了解代理何时以及为何路由至人工审核。

  * **不同的失败模式：** LLM调用、数据库查找和电子邮件发送有不同的重试策略。单独的节点允许您独立配置它们。

  * **可重用性和测试：** 较小的节点更容易单独测试并在其他工作流程中重用。

  一种不同的有效方法：您可以将 `Read Email` 和 `Classify Intent` 组合到单个节点中。您将无法在分类之前检查原始电子邮件，并且会在该节点出现任何故障时重复这两个操作。对于大多数应用程序来说，单独节点的可观察性和调试优势值得权衡。

  应用程序级问题：步骤 2 中的缓存讨论（是否缓存搜索结果）是应用程序级决策，而不是 LangGraph 框架功能。您可以根据您的具体要求在节点函数中实现缓存 - LangGraph 没有规定这一点。性能注意事项：更多节点并不意味着执行速度更慢。 LangGraph 默认在后台写入检查点 ([async durability mode](/oss/javascript/langgraph/checkpointers#durability-modes))，因此您的图表会继续运行，而无需等待检查点完成。这意味着您可以获得频繁的检查点，同时对性能的影响最小。如果需要，您可以调整此行为 - 使用 `"exit"` 模式仅在完成时检查点，或使用 `"sync"` 模式阻止执行，直到写入每个检查点。
</Accordion>

### 从这里到哪里去

这是对使用 LangGraph 构建代理的思考的介绍。您可以通过以下方式扩展此基础：

<CardGroup>
  <Card title="Human-in-the-loop patterns" icon="user-check" href="/oss/javascript/langgraph/interrupts">
    了解如何添加执行前工具审批、批量审批和其他模式
  </Card>

  <Card title="Subgraphs" icon="hierarchy" href="/oss/javascript/langgraph/use-subgraphs">
    为复杂的多步骤操作创建子图
  </Card>

  <Card title="Streaming" icon="broadcast" href="/oss/javascript/langgraph/streaming">
    添加流式传输以向用户显示实时进度
  </Card>

  <Card title="Observability" icon="chart-line" href="/oss/javascript/langgraph/observability">
    使用 LangSmith 添加可观察性以进行调试和监控
  </Card>

  <Card title="Tool Integration" icon="tool" href="/oss/javascript/langchain/tools">
    集成更多用于网络搜索、数据库查询和 API 调用的工具
  </Card>

  <Card title="Retry Logic" icon="rotate" href="/oss/javascript/langgraph/use-graph-api#add-retry-policies">
    对失败的操作实施指数退避的重试逻辑
  </Card>
</CardGroup>

***<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/thinking-in-langgraph.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>