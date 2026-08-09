<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Interrupts | https://docs.langchain.com/oss/javascript/langgraph/human-in-the-loop -->

# 中断

中断允许您在特定点暂停图形执行并在继续之前等待外部输入。这可以实现需要外部输入才能继续的人机交互模式。当触发中断时，LangGraph 使用其[persistence](/oss/javascript/langgraph/persistence) 层保存图形状态，并无限期等待，直到恢复执行。

中断通过在图形节点中的任意点调用 `interrupt()` 函数来工作。该函数接受向调用者显示的任何 JSON 可序列化值。当您准备好继续时，您可以通过使用 `Command` 重新调用图形来恢复执行，然后该图将成为从节点内部调用 `interrupt()` 的返回值。

与静态断点（在特定节点之前或之后暂停）不同，中断是动态的：它们可以放置在代码中的任何位置，并且可以根据应用程序逻辑设置条件。* **检查点保留您的位置：** 检查点写入准确的图形状态，以便您可以稍后恢复，即使处于错误状态也是如此。
* **`thread_id` 是您的指针：** 使用 `{ configurable: { thread_id: ... } }` 作为 `invoke` 方法的选项来告诉检查指针要加载哪个状态。
* **中断有效负载表面为`__interrupt__`：**您传递给`interrupt()`的值返回到`__interrupt__`字段中的调用者，以便您知道图表正在等待什么。

您选择的 `thread_id` 实际上是您的持久光标。重用它会恢复相同的检查点；使用新值启动一个处于空状态的全新线程。

## 使用 `interrupt` 暂停

[⟦T43⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 函数暂停图形执行并向调用者返回一个值。当您在节点内调用 [⟦T44⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 时，LangGraph 会保存当前图形状态并等待您通过输入恢复执行。

要使用[⟦T45⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)，您需要：

1. 用于持久化图形状态的**检查点**（在生产中使用持久检查点）
2. 配置中的 **线程 ID**，以便运行时知道从哪个状态恢复
3. 在要暂停的地方调用`interrupt()`（有效负载必须是JSON可序列化的）

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { interrupt } from "@langchain/langgraph";

async function approvalNode(state: State) {
    // Pause and ask for approval
    const approved = interrupt("Do you approve this action?");

    // Command({ resume: ... }) provides the value returned into this variable
    return { approved };
}
```

当您拨打 [⟦T47⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 时，会发生以下情况：1. **图形执行在调用 [⟦T48⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 的确切位置暂停**

2. **使用检查指针保存状态**，以便稍后可以恢复执行，在生产中，这应该是持久检查指针（例如由数据库支持）

3. **值在`__interrupt__`下返回**给调用者；它可以是任何 JSON 可序列化的值（字符串、对象、数组等）

4. **Graph 无限期地等待**，直到您通过响应恢复执行

5. 当您恢复时，**响应会被传回**节点，成为`interrupt()`调用的返回值

## 恢复中断

中断暂停执行后，您可以通过使用包含恢复值的 `Command` 再次调用它来恢复图表。恢复值被传递回`interrupt`调用，允许节点继续使用外部输入执行。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

// Initial run - hits the interrupt and pauses
// thread_id is the durable pointer back to the saved checkpoint
const config = { configurable: { thread_id: "thread-1" } };
const result = await graph.invoke({ input: "data" }, config);

// Check what was interrupted
// __interrupt__ mirrors every payload you passed to interrupt()
console.log(result.__interrupt__);
// [{ value: 'Do you approve this action?', ... }]

// Resume with the human's response
// Command({ resume }) returns that value from interrupt() in the node
await graph.invoke(new Command({ resume: true }), config);
```

**恢复要点：*** 恢复时必须使用与中断发生时使用的**相同的线程 ID**
* 传递给`new Command({ resume: ... })`的值成为[⟦T54⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)调用的返回值
* 节点从恢复时调用[⟦T55⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)的节点开始重新启动，因此[⟦T56⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)之前的任何代码都会再次运行
* 您可以传递任何 JSON 可序列化值作为恢复值

<Warning>
  `new Command({ resume: ... })` 是**唯一** `Command` 模式，旨在作为 `invoke()`/`stream()`/`stream_events()` 的输入。其他`Command`参数（`update`、`goto`、`graph`）是为[returning from node functions](/oss/javascript/langgraph/graph-api#command)设计的。不要传递 `new Command({ update: ... })` 作为输入来继续多轮对话，而是传递一个普通的输入对象。
</Warning>

## 常见模式

中断解锁的关键是能够暂停执行并等待外部输入。这对于各种用例都很有用，包括：* <Icon icon="circle-check" /> [Approval workflows](#approve-or-reject)：在执行关键操作（API 调用、数据库更改、金融交易）之前暂停
* <Icon icon="link" /> [Handling multiple interrupts](#handling-multiple-interrupts)：在单次调用中恢复多个中断时，将中断 ID 与恢复值配对
* <Icon icon="pencil" /> [Review and edit](#review-and-edit-state)：让人们在继续之前检查和修改LLM输出或工具调用
* <Icon icon="tool" /> [Interrupting tool calls](#interrupts-in-tools)：执行工具调用前暂停，以在执行前查看和编辑工具调用
* <Icon icon="shield-check" /> [Validating human input](#validating-human-input)：在继续下一步验证人工输入之前暂停

### 具有人机参与循环 (HITL) 中断的流

在使用人机交互工作流程构建交互式代理时，您可以使用[event streaming](/oss/javascript/langgraph/event-streaming)在处理中断时同时使用消息块和状态快照。

循环使用 `graph.stream_events(..., version="v3")` 返回的类型化投影，直到运行完成：

* 通过`stream.messages`逐个流式传输 AI 响应
* 通过`stream.values`观察每步状态快照
* 通过`stream.interrupted`检测中断并从`stream.interrupts`读取中断负载
* 通过使用`Command(resume=...)`再次调用`stream_events`来恢复执行，并重复直到`stream.interrupted`为假

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

let streamInput: Record<string, unknown> | Command = initialInput;

while (true) {
  const stream = await graph.streamEvents(streamInput, {
    ...config,
    version: "v3",
  });

  // Stream LLM message chunks (including any in subgraphs) as they arrive.
  for await (const message of stream.messages) {
    for await (const token of message.text) {
      displayStreamingContent(token);
    }
  }

  // After the run finishes (or pauses), check for interrupts and resume.
  if (!stream.interrupted) {
    const finalState = await stream.output;
    break;
  }

  const interruptInfo = stream.interrupts[0].payload;
  const userResponse = await getUserInput(interruptInfo);
  streamInput = new Command({ resume: userResponse });
}
```* **`stream.messages`**：聊天模型输出为内容块；迭代 `message.text` 以获得代币增量。对于嵌套子图，从`stream.subgraphs[*].messages`读取消息块。
* **`stream.values`**：每一步后的完整状态快照
* **`stream.interrupted` / `stream.interrupts`**：每次运行后，检查图形是否暂停；从`stream.interrupts`读取有效负载
* **`Command(resume=...)`**：作为下一个`streamEvents`输入进行恢复；循环直到运行完成而不中断

### 处理多个中断

当并行分支同时中断时（例如，扇出到多个节点，每个节点都调用`interrupt()`），您可能需要在单次调用中恢复多个中断。
当通过一次调用恢复多个中断时，将每个中断 ID 映射到其恢复值。
这可确保每个响应在运行时与正确的中断配对。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  Annotation,
  Command,
  END,
  INTERRUPT,
  MemorySaver,
  START,
  StateGraph,
  interrupt,
  isInterrupted,
} from "@langchain/langgraph";

const State = Annotation.Root({
  vals: Annotation<string[]>({
    reducer: (left, right) =>
      left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
});

function nodeA(_state: typeof State.State) {
  const answer = interrupt("question_a") as string;
  return { vals: [`a:${answer}`] };
}

function nodeB(_state: typeof State.State) {
  const answer = interrupt("question_b") as string;
  return { vals: [`b:${answer}`] };
}

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addEdge(START, "a")
  .addEdge(START, "b")
  .addEdge("a", END)
  .addEdge("b", END)
  .compile({ checkpointer: new MemorySaver() });

const config = { configurable: { thread_id: "1" } };

async function main() {
  // Step 1: invoke - both parallel nodes hit interrupt() and pause
  const interruptedResult = await graph.invoke({ vals: [] }, config);
  console.log(interruptedResult);
  /*
  {
    vals: [],
    __interrupt__: [
      { id: '...', value: 'question_a' },
      { id: '...', value: 'question_b' }
    ]
  }
  */

  // Step 2: resume all pending interrupts at once
  const resumeMap: Record<string, string> = {};
  if (isInterrupted(interruptedResult)) {
    for (const i of interruptedResult[INTERRUPT]) {
      if (i.id != null) {
        resumeMap[i.id] = `answer for ${i.value}`;
      }
    }
  }
  const result = await graph.invoke(new Command({ resume: resumeMap }), config);

  console.log("Final state:", result);
  //> Final state: { vals: ['a:answer for question_a', 'b:answer for question_b'] }
}

main().catch(console.error);
```

### 批准或拒绝

中断最常见的用途之一是在关键操作之前暂停并请求批准。例如，您可能想要请求人工批准 API 调用、数据库更改或任何其他重要决策。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { interrupt, Command } from "@langchain/langgraph";

const approvalNode: typeof State.Node = (state) => {
  // Pause execution; payload surfaces in result.__interrupt__
  const isApproved = interrupt({
    question: "Do you want to proceed?",
    details: state.actionDetails
  });

  // Route based on the response
  if (isApproved) {
    return new Command({ goto: "proceed" }); // Runs after the resume payload is provided
  } else {
    return new Command({ goto: "cancel" });
  }
}
```

当您恢复图表时，通过 `true` 批准或 `false` 拒绝：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// To approve
await graph.invoke(new Command({ resume: true }), config);

// To reject
await graph.invoke(new Command({ resume: false }), config);
```

<Accordion title="Full example">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import {
    Command,
    MemorySaver,
    START,
    END,
    StateGraph,
    StateSchema,
    interrupt,
  } from "@langchain/langgraph";
  import * as z from "zod";

  const State = new StateSchema({
    actionDetails: z.string(),
    status: z.enum(["pending", "approved", "rejected"]).nullable(),
  });

  const graphBuilder = new StateGraph(State)
    .addNode("approval", async (state) => {
      // Expose details so the caller can render them in a UI
      const decision = interrupt({
        question: "Approve this action?",
        details: state.actionDetails,
      });
      return new Command({ goto: decision ? "proceed" : "cancel" });
    }, { ends: ['proceed', 'cancel'] })
    .addNode("proceed", () => ({ status: "approved" }))
    .addNode("cancel", () => ({ status: "rejected" }))
    .addEdge(START, "approval")
    .addEdge("proceed", END)
    .addEdge("cancel", END);

  // Use a more durable checkpointer in production
  const checkpointer = new MemorySaver();
  const graph = graphBuilder.compile({ checkpointer });

  const config = { configurable: { thread_id: "approval-123" } };
  const initial = await graph.invoke(
    { actionDetails: "Transfer $500", status: "pending" },
    config,
  );
  console.log(initial.__interrupt__);
  // [{ value: { question: ..., details: ... } }]

  // Resume with the decision; true routes to proceed, false to cancel
  const resumed = await graph.invoke(new Command({ resume: true }), config);
  console.log(resumed.status); // -> "approved"
  ```
</Accordion>

### 查看和编辑状态有时您希望在继续之前让人工检查并编辑部分图形状态。这对于纠正法学硕士、添加缺失的信息或进行调整非常有用。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { interrupt } from "@langchain/langgraph";

const reviewNode: typeof State.Node = (state) => {
  // Pause and show the current content for review (surfaces in result.__interrupt__)
  const editedContent = interrupt({
    instruction: "Review and edit this content",
    content: state.generatedText
  });

  // Update the state with the edited version
  return { generatedText: editedContent };
}
```

恢复时，提供编辑后的内容：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await graph.invoke(
  new Command({ resume: "The edited and improved text" }), // Value becomes the return from interrupt()
  config
);
```

<Accordion title="Full example">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import {
    Command,
    MemorySaver,
    START,
    END,
    StateGraph,
    StateSchema,
    interrupt,
  } from "@langchain/langgraph";
  import * as z from "zod";

  const State = new StateSchema({
    generatedText: z.string(),
  });

  const builder = new StateGraph(State)
    .addNode("review", async (state) => {
      // Ask a reviewer to edit the generated content
      const updated = interrupt({
        instruction: "Review and edit this content",
        content: state.generatedText,
      });
      return { generatedText: updated };
    })
    .addEdge(START, "review")
    .addEdge("review", END);

  const checkpointer = new MemorySaver();
  const graph = builder.compile({ checkpointer });

  const config = { configurable: { thread_id: "review-42" } };
  const initial = await graph.invoke({ generatedText: "Initial draft" }, config);
  console.log(initial.__interrupt__);
  // [{ value: { instruction: ..., content: ... } }]

  // Resume with the edited text from the reviewer
  const finalState = await graph.invoke(
    new Command({ resume: "Improved draft after review" }),
    config,
  );
  console.log(finalState.generatedText); // -> "Improved draft after review"
  ```
</Accordion>

### 工具中断

您还可以将中断直接放置在工具函数中。这使得工具本身在调用时暂停以等待批准，并允许在执行工具调用之前进行人工审查和编辑。

首先，定义一个使用[⟦T87⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)的工具：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { tool } from "@langchain/core/tools";
import { interrupt } from "@langchain/langgraph";
import * as z from "zod";

const sendEmailTool = tool(
  async ({ to, subject, body }) => {
    // Pause before sending; payload surfaces in result.__interrupt__
    const response = interrupt({
      action: "send_email",
      to,
      subject,
      body,
      message: "Approve sending this email?",
    });

    if (response?.action === "approve") {
      // Resume value can override inputs before executing
      const finalTo = response.to ?? to;
      const finalSubject = response.subject ?? subject;
      const finalBody = response.body ?? body;
      return `Email sent to ${finalTo} with subject '${finalSubject}'`;
    }
    return "Email cancelled by user";
  },
  {
    name: "send_email",
    description: "Send an email to a recipient",
    schema: z.object({
      to: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
  },
);
```

当您希望批准逻辑与工具本身一起存在时，这种方法非常有用，使其可以在图表的不同部分中重复使用。 LLM 可以自然地调用该工具，每当调用该工具时中断就会暂停执行，允许您批准、编辑或取消操作。

<Accordion title="Full example">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { tool } from "@langchain/core/tools";
  import { ChatAnthropic } from "@langchain/anthropic";
  import {
    Command,
    MemorySaver,
    START,
    END,
    StateGraph,
    StateSchema,
    MessagesValue,
    GraphNode,
    interrupt,
  } from "@langchain/langgraph";
  import * as z from "zod";

  const sendEmailTool = tool(
    async ({ to, subject, body }) => {
      // Pause before sending; payload surfaces in result.__interrupt__
      const response = interrupt({
        action: "send_email",
        to,
        subject,
        body,
        message: "Approve sending this email?",
      });

      if (response?.action === "approve") {
        const finalTo = response.to ?? to;
        const finalSubject = response.subject ?? subject;
        const finalBody = response.body ?? body;
        console.log("[sendEmailTool]", finalTo, finalSubject, finalBody);
        return `Email sent to ${finalTo}`;
      }
      return "Email cancelled by user";
    },
    {
      name: "send_email",
      description: "Send an email to a recipient",
      schema: z.object({
        to: z.string(),
        subject: z.string(),
        body: z.string(),
      }),
    },
  );

  const model = new ChatAnthropic({ model: "claude-sonnet-4-6" }).bindTools([sendEmailTool]);

  const State = new StateSchema({
    messages: MessagesValue,
  });

  const agent: typeof State.Node = async (state) => {
    // LLM may decide to call the tool; interrupt pauses before sending
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  };

  const graphBuilder = new StateGraph(State)
    .addNode("agent", agent)
    .addEdge(START, "agent")
    .addEdge("agent", END);

  const checkpointer = new MemorySaver();
  const graph = graphBuilder.compile({ checkpointer });

  const config = { configurable: { thread_id: "email-workflow" } };
  const initial = await graph.invoke(
    {
      messages: [
        { role: "user", content: "Send an email to alice@example.com about the meeting" },
      ],
    },
    config,
  );
  console.log(initial.__interrupt__); // -> [{ value: { action: 'send_email', ... } }]

  // Resume with approval and optionally edited arguments
  const resumed = await graph.invoke(
    new Command({
      resume: { action: "approve", subject: "Updated subject" },
    }),
    config,
  );
  console.log(resumed.messages.at(-1)); // -> Tool result returned by send_email
  ```
</Accordion>

### 验证人工输入有时您需要验证人类的输入并重新提示该值是否无效。推荐的方法是调用`interrupt()` **每次节点调用一次**，从状态中存储错误消息的节点返回，并使用**条件边**循环回节点，直到提供有效值。

<Warning>
  **避免 `while True` + `interrupt()` 在单个节点内循环。** 因为节点在每次恢复时都从头开始重新运行（请参阅 [Rules of interrupts](#rules-of-interrupts)），多次调用 `interrupt()` 的循环会导致每个恢复重播所有先前的迭代：第一个恢复重播 1 次迭代，第二次重播 2 次迭代，依此类推。结果是循环体内任何代码的指数重新执行。
</Warning>

正确的模式：

1. 将重新提示的问题存储在状态中（例如`pendingQuestion`）。
2. 在节点中，调用`interrupt()` **恰好一次**，从状态传递当前问题。
3. 如果答案无效，则返回更新后的`pendingQuestion`，以便下次调用重新提示。
4. 使用`addConditionalEdges`路由回节点，直到收集到有效值。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { interrupt } from "@langchain/langgraph";

const getAgeNode: typeof State.Node = (state) => {
  const question = state.pendingQuestion ?? "What is your age?";
  const answer = interrupt(question); // called exactly once per invocation

  if (typeof answer === "number" && answer > 0) {
    return { age: answer, pendingQuestion: null };
  }
  return {
    pendingQuestion: `'${answer}' is not a valid age. Please enter a positive number.`,
  };
};

// builder.addConditionalEdges("collectAge", (state) =>
//   state.age !== null ? END : "collectAge"
// );
```每个恢复都会调用 `getAgeNode` 一次，运行 `interrupt()` 调用一次，然后退出。当答案无效时，条件边沿循环返回，并且下一个中断会重新提示更新的问题。

<Accordion title="Full example">
  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import {
    Command,
    MemorySaver,
    START,
    END,
    StateGraph,
    StateSchema,
    interrupt,
  } from "@langchain/langgraph";
  import * as z from "zod";

  const State = new StateSchema({
    age: z.number().nullable(),
    pendingQuestion: z.string().nullable(),
  });

  const builder = new StateGraph(State)
    .addNode("collectAge", (state) => {
      const question = state.pendingQuestion ?? "What is your age?";
      const answer = interrupt(question); // called exactly once per invocation

      if (typeof answer === "number" && answer > 0) {
        return { age: answer, pendingQuestion: null };
      }
      return { pendingQuestion: `'${answer}' is not a valid age. Please enter a positive number.` };
    })
    .addEdge(START, "collectAge")
    .addConditionalEdges("collectAge", (state) =>
      state.age !== null ? END : "collectAge"
    );

  const checkpointer = new MemorySaver();
  const graph = builder.compile({ checkpointer });

  const config = { configurable: { thread_id: "form-1" } };
  const first = await graph.invoke({ age: null, pendingQuestion: null }, config);
  console.log(first.__interrupt__); // -> [{ value: "What is your age?", ... }]

  // Provide invalid data; the node re-prompts via the conditional edge
  const retry = await graph.invoke(new Command({ resume: "thirty" }), config);
  console.log(retry.__interrupt__); // -> [{ value: "'thirty' is not a valid age...", ... }]

  // Provide valid data; route returns END and the graph finishes
  const final = await graph.invoke(new Command({ resume: 30 }), config);
  console.log(final.age); // -> 30
  ```
</Accordion>

## 中断规则

当您在节点内调用 [⟦T98⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 时，LangGraph 会通过引发异常来指示运行时暂停来暂停执行。该异常通过调用堆栈向上传播并被运行时捕获，通知图保存当前状态并等待外部输入。

当执行恢复时（在您提供请求的输入之后），运行时会从头开始重新启动整个节点 - 它不会从调用 [⟦T99⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 的确切行恢复。这意味着在 [⟦T100⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 之前运行的任何代码都将再次执行。因此，在处理中断时需要遵循一些重要规则，以确保它们按预期运行。

### 不要将 `interrupt` 调用包装在 try/catch 中

[⟦T102⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 在调用点暂停执行的方法是抛出一个特殊的异常。如果将 [⟦T103⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用包装在 try/catch 块中，您将捕获此异常，并且中断将不会传递回图表。* ✅ 将 [⟦T104⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用与容易出错的代码分开
* ✅ 如果需要有条件地捕获错误

<CodeGroup>
  ```typescript Separating logic theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: interrupting first, then handling error conditions separately
    const name = interrupt("What's your name?");
    try {
      await fetchData(); // This can fail
    } catch (err) {
      console.error(error);
    }
    return state;
  }
  ```

  ```typescript Conditionally handling errors theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: re-throwing the exception will
    // allow the interrupt to be passed back to
    // the graph
    try {
      const name = interrupt("What's your name?");
      await fetchData(); // This can fail
    } catch (err) {
      if (error instanceof NetworkError) {
        console.error(error);
      }
      throw error;
    }
    return state;
  }
  ```
</CodeGroup>

* 🔴 不要将 [⟦T105⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用包装在裸露的 try/catch 块中

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
async function nodeA(state: State) {
    // ❌ Bad: wrapping interrupt in bare try/catch will catch the interrupt exception
    try {
        const name = interrupt("What's your name?");
    } catch (err) {
        console.error(error);
    }
    return state;
}
```

### 不要在节点内重新排序 `interrupt` 调用

在单个节点中使用多个中断是很常见的，但是如果处理不仔细，这可能会导致意外的行为。

当一个节点包含多个中断调用时，LangGraph 会保留一个特定于执行该节点的任务的恢复值列表。每当执行恢复时，它都会从节点的开头开始。对于遇到的每个中断，LangGraph 都会检查任务的恢复列表中是否存在匹配的值。匹配**严格基于索引**，因此节点内中断调用的顺序很重要。

* ✅ 保持 [⟦T107⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用在节点执行之间保持一致

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
async function nodeA(state: State) {
    // ✅ Good: interrupt calls happen in the same order every time
    const name = interrupt("What's your name?");
    const age = interrupt("What's your age?");
    const city = interrupt("What's your city?");

    return {
        name,
        age,
        city
    };
}
```

* 🔴 不要有条件地跳过节点内的 [⟦T108⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用
* 🔴 不要使用在执行过程中不确定的逻辑来循环 [⟦T109⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用，包括 `while True` 验证循环。使用条件边（参见[Validating human input](#validating-human-input)）

<CodeGroup>
  ```typescript Skipping interrupts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ❌ Bad: conditionally skipping interrupts changes the order
    const name = interrupt("What's your name?");

    // On first run, this might skip the interrupt
    // On resume, it might not skip it - causing index mismatch
    if (state.needsAge) {
      const age = interrupt("What's your age?");
    }

    const city = interrupt("What's your city?");

    return { name, city };
  }
  ```

  ```typescript Looping interrupts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ❌ Bad: looping based on non-deterministic data
    // The number of interrupts changes between executions
    const results = [];
    for (const item of state.dynamicList || []) {  // List might change between runs
      const result = interrupt(`Approve ${item}?`);
      results.push(result);
    }

    return { results };
  }
  ```
</CodeGroup>

### 不要在 `interrupt` 调用中返回复数值根据使用的检查指针，复杂值可能无法序列化（例如，您无法序列化函数）。为了使您的图表适应任何部署，最佳实践是仅使用可以合理序列化的值。

* ✅ 将简单的 JSON 可序列化类型传递给 [⟦T112⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)
* ✅ 传递具有简单值的字典/对象

<CodeGroup>
  ```typescript Simple values theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: passing simple types that are serializable
    const name = interrupt("What's your name?");
    const count = interrupt(42);
    const approved = interrupt(true);

    return { name, count, approved };
  }
  ```

  ```typescript Structured data theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: passing objects with simple values
    const response = interrupt({
      question: "Enter user details",
      fields: ["name", "email", "age"],
      currentValues: state.user || {}
    });

    return { user: response };
  }
  ```
</CodeGroup>

* 🔴 不要将函数、类实例或其他复杂对象传递给[⟦T113⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)

<CodeGroup>
  ```typescript Functions theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  function validateInput(value: string): boolean {
      return value.length > 0;
  }

  const nodeA: GraphNode<typeof State> = async (state) => {
    // ❌ Bad: passing a function to interrupt
    // The function cannot be serialized
    const response = interrupt({
      question: "What's your name?",
      validator: validateInput  // This will fail
    });
    return { name: response };
  }
  ```

  ```typescript Class instances theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  class DataProcessor {
      constructor(private config: any) {}
  }

  const nodeA: GraphNode<typeof State> = async (state) => {
    const processor = new DataProcessor({ mode: "strict" });

    // ❌ Bad: passing a class instance to interrupt
    // The instance cannot be serialized
    const response = interrupt({
      question: "Enter data to process",
      processor: processor  // This will fail
    });
    return { result: response };
  }
  ```
</CodeGroup>

### 在`interrupt`之前调用的副作用必须是幂等的

因为中断是通过重新运行调用它们的节点来工作的，所以在 [⟦T115⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 之前调用的副作用应该（理想情况下）是幂等的。对于上下文来说，幂等性意味着可以多次应用相同的操作，而不会改变初始执行之外的结果。

例如，您可能有一个 API 调用来更新节点内的记录。如果在调用之后调用[⟦T116⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)，则当节点恢复时它将重新运行多次，可能会覆盖初始更新或创建重复记录。* ✅ 在[⟦T117⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)之前使用幂等操作
* ✅ 在 [⟦T118⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 调用之后放置副作用
* ✅ 如果可能的话，将副作用分离到单独的节点中

<CodeGroup>
  ```typescript Idempotent operations theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: using upsert operation which is idempotent
    // Running this multiple times will have the same result
    await db.upsertUser({
      userId: state.userId,
      status: "pending_approval"
    });

    const approved = interrupt("Approve this change?");

    return { approved };
  }
  ```

  ```typescript Side effects after interrupt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ✅ Good: placing side effect after the interrupt
    // This ensures it only runs once after approval is received
    const approved = interrupt("Approve this change?");

    if (approved) {
      await db.createAuditLog({
        userId: state.userId,
        action: "approved"
      });
    }

    return { approved };
  }
  ```

  ```typescript Separating into different nodes theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const approvalNode: GraphNode<typeof State> = async (state) => {
    // ✅ Good: only handling the interrupt in this node
    const approved = interrupt("Approve this change?");

    return { approved };
  }

  const notificationNode: GraphNode<typeof State> = async (state) => {
    // ✅ Good: side effect happens in a separate node
    // This runs after approval, so it only executes once
    if (state.approved) {
      await sendNotification({
        userId: state.userId,
        status: "approved",
      });
    }

    return state;
  }
  ```
</CodeGroup>

* 🔴[⟦T119⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)之前不要进行非幂等操作
* 🔴 在未检查记录是否存在的情况下不要创建新记录

<CodeGroup>
  ```typescript Creating records theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ❌ Bad: creating a new record before interrupt
    // This will create duplicate records on each resume
    const auditId = await db.createAuditLog({
      userId: state.userId,
      action: "pending_approval",
      timestamp: new Date()
    });

    const approved = interrupt("Approve this change?");

    return { approved, auditId };
  }
  ```

  ```typescript Appending to arrays theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const nodeA: GraphNode<typeof State> = async (state) => {
    // ❌ Bad: appending to an array before interrupt
    // This will add duplicate entries on each resume
    await db.appendToHistory(state.userId, "approval_requested");

    const approved = interrupt("Approve this change?");

    return { approved };
  }
  ```
</CodeGroup>

## 与称为函数的子图一起使用

当调用节点内的子图时，父图将从调用子图并触发 [⟦T120⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 的**节点**开始处恢复执行。同样，**子图**也会从调用 [⟦T121⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 的节点的开头开始恢复。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
async function nodeInParentGraph(state: State) {
    someCode(); // <-- This will re-execute when resumed
    // Invoke a subgraph as a function.
    // The subgraph contains an `interrupt` call.
    const subgraphResult = await subgraph.invoke(someInput);
    // ...
}

async function nodeInSubgraph(state: State) {
    someOtherCode(); // <-- This will also re-execute when resumed
    const result = interrupt("What's your name?");
    // ...
}
```

## 使用中断进行调试

要调试和测试图形，您可以使用静态中断作为断点，一次单步执行一个节点的图形执行。静态中断在节点执行之前或之后的定义点触发。您可以在编译图表时通过指定 `interruptBefore` 和 `interruptAfter` 来设置这些。

<Note>
  **不**建议将静态中断用于人机交互工作流程。请改用 [⟦T124⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 函数。
</Note>

<Tabs>
  <Tab title="At compile time">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    const graph = builder.compile({
        interruptBefore: ["node_a"],  // [!code highlight]
        interruptAfter: ["node_b", "node_c"],  // [!code highlight]
        checkpointer,
    });

    // Pass a thread ID to the graph
    const config = {
        configurable: {
            thread_id: "some_thread"
        }
    };

    // Run the graph until the breakpoint
    await graph.invoke(inputs, config);# [!code highlight]

    await graph.invoke(null, config);  # [!code highlight]
    ```1. 断点设置在`compile`时间内。
    2. `interruptBefore` 指定执行该节点之前应暂停执行的节点。
    3. `interruptAfter` 指定该节点执行完毕后应暂停执行的节点。
    4. 需要一个检查点来启用断点。
    5. 运行图表直至遇到第一个断点。
    6. 通过传入 `null` 作为输入来恢复图表。这将运行图表直到遇到下一个断点。
  </Tab>

  <Tab title="At run time">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    // Run the graph until the breakpoint
    graph.invoke(inputs, {
        interruptBefore: ["node_a"],  // [!code highlight]
        interruptAfter: ["node_b", "node_c"],  // [!code highlight]
        configurable: {
            thread_id: "some_thread"
        }
    });

    // Resume the graph
    await graph.invoke(null, config);  // [!code highlight]
    ```

    1. 使用`interruptBefore`和`interruptAfter`参数调用`graph.invoke`。这是一个运行时配置，可以在每次调用时更改。
    2. `interruptBefore` 指定执行该节点之前应暂停执行的节点。
    3. `interruptAfter` 指定该节点执行完毕后应暂停执行的节点。
    4. 运行图表直到遇到第一个断点。
    5. 通过传入 `null` 作为输入来恢复图表。这将运行图表直到遇到下一个断点。
  </Tab>
</Tabs>

<Tip>
  要调试中断，请使用[LangSmith](/langsmith/observability)。
</Tip>

### 使用 LangSmith Studio在运行图表之前，您可以使用 [LangSmith Studio](/langsmith/studio) 在 UI 中的图表中设置静态中断。您还可以使用 UI 在执行过程中的任意时刻检查图形状态。

<img src="https://mintcdn.com/langchain-5e9cc07a/dL5Sn6Cmy9pwtY0V/oss/images/static-interrupt.png?fit=max&auto=format&n=dL5Sn6Cmy9pwtY0V&q=85&s=5aa4e7cea2ab147cef5b4e210dd6c4a1" alt="image" width="1252" height="1040" data-path="oss/images/static-interrupt.png" />

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/interrupts.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>