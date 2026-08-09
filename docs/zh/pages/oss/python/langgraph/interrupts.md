<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Interrupts | https://docs.langchain.com/oss/python/langgraph/interrupts -->

# 中断

中断允许您在特定点暂停图形执行并在继续之前等待外部输入。这可以实现需要外部输入才能继续的人机交互模式。当触发中断时，LangGraph 使用其 [persistence](/oss/python/langgraph/persistence) 层保存图形状态，并无限期等待，直到恢复执行。

中断通过在图形节点中的任意点调用 `interrupt()` 函数来工作。该函数接受向调用者显示的任何 JSON 可序列化值。当您准备好继续时，您可以通过使用 `Command` 重新调用图形来恢复执行，然后该图将成为从节点内部调用 `interrupt()` 的返回值。

与静态断点（在特定节点之前或之后暂停）不同，中断是动态的：它们可以放置在代码中的任何位置，并且可以根据应用程序逻辑设置条件。* **检查点保留您的位置：** 检查点写入准确的图形状态，以便您可以稍后恢复，即使处于错误状态也是如此。
* **`thread_id` 是你的指针：** 设置 `config={"configurable": {"thread_id": ...}}` 来告诉检查指针要加载哪个状态。
* **通过`stream.interrupts`表面中断负载：**使用[event streaming](/oss/python/langgraph/event-streaming)（`graph.stream_events(..., version="v3")`）时，传递给`interrupt()`的值出现在`stream.interrupts`上，当运行暂停输入时，`stream.interrupted`是`True`。

您选择的 `thread_id` 实际上是您的持久光标。重用它会恢复相同的检查点；使用新值启动一个处于空状态的全新线程。

## 使用 `interrupt` 暂停

[⟦T45⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 函数暂停图形执行并向调用者返回一个值。当您在节点内调用 [⟦T46⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 时，LangGraph 会保存当前图形状态并等待您通过输入恢复执行。

要使用[⟦T47⟧](https://reference.langchain.com/python/langgraph/types/interrupt)，您需要：

1. 用于持久化图形状态的**检查点**（在生产中使用持久检查点）
2. 配置中的 **线程 ID**，以便运行时知道从哪个状态恢复
3. 在要暂停的地方调用`interrupt()`（有效负载必须是JSON可序列化的）

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import interrupt

def approval_node(state: State):
    # Pause and ask for approval
    approved = interrupt("Do you approve this action?")

    # When you resume, Command(resume=...) returns that value here
    return {"approved": approved}
```

当您拨打 [⟦T49⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 时，会发生以下情况：

1. **图形执行在调用 [⟦T50⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 的确切位置暂停**2. **使用检查指针保存状态**，以便稍后可以恢复执行，在生产中，这应该是持久检查指针（例如由数据库支持）

3. 当使用[event streaming](/oss/python/langgraph/event-streaming)（`graph.stream_events(..., version="v3")`）时，**在`stream.interrupts`上将值返回**给调用者，或者在`__interrupt__`下使用默认的`invoke()` API；它可以是任何 JSON 可序列化的值（字符串、对象、数组等）

4. **Graph 无限期地等待**，直到您通过响应恢复执行

5. 当您恢复时，**响应会被传回**节点，成为`interrupt()`调用的返回值

## 恢复中断

中断暂停执行后，您可以通过使用包含恢复值的 `Command` 再次调用它来恢复图表。恢复值被传递回`interrupt`调用，允许节点继续使用外部输入执行。

驱动可能中断的图的推荐方法是[event streaming](/oss/python/langgraph/event-streaming)——它通过`stream.interrupts`和`stream.interrupted`表面中断，并通过`stream.output`公开最终状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

# Initial run - hits the interrupt and pauses
# thread_id is the persistent pointer (stores a stable ID in production)
config = {"configurable": {"thread_id": "thread-1"}}
stream = graph.stream_events({"input": "data"}, config=config, version="v3")

# Drain the stream to drive the run; stream.output awaits the final state.
final = stream.output

# stream.interrupted is True when the run paused for human input, and
# stream.interrupts contains the payloads passed to interrupt().
if stream.interrupted:
    print(stream.interrupts)
    # > (Interrupt(value='Do you approve this action?'),)

# Resume with the human's response
# The resume payload becomes the return value of interrupt() inside the node
resumed = graph.stream_events(Command(resume=True), config=config, version="v3")
final = resumed.output
```

<Note>
  默认的 `graph.invoke(...)` API 仍然可以工作并在 `result["__interrupt__"]` 下显示中断。当您不需要流式投影时使用它；否则更喜欢`graph.stream_events(..., version="v3")`。
</Note>

**恢复要点：*** 恢复时必须使用与中断发生时使用的**相同的线程 ID**
* 传递给`Command(resume=...)`的值成为[⟦T65⟧](https://reference.langchain.com/python/langgraph/types/interrupt)调用的返回值
* 节点从恢复时调用[⟦T66⟧](https://reference.langchain.com/python/langgraph/types/interrupt)的节点开始重新启动，因此[⟦T67⟧](https://reference.langchain.com/python/langgraph/types/interrupt)之前的任何代码都会再次运行
* 您可以传递任何 JSON 可序列化值作为恢复值

<Warning>
  `Command(resume=...)` 是**唯一** `Command` 模式，旨在作为 `invoke()`/`stream()`/`stream_events()` 的输入。其他`Command`参数（`update`、`goto`、`graph`）是为[returning from node functions](/oss/python/langgraph/graph-api#command)设计的。不要传递 `Command(update=...)` 作为输入来继续多轮对话 - 而是传递一个简单的输入字典。
</Warning>

## 常见模式

中断解锁的关键是能够暂停执行并等待外部输入。这对于各种用例都很有用，包括：* <Icon icon="circle-check" /> [Approval workflows](#approve-or-reject)：在执行关键操作（API 调用、数据库更改、金融交易）之前暂停
* <Icon icon="link" /> [Handling multiple interrupts](#handling-multiple-interrupts)：在单次调用中恢复多个中断时将中断 ID 与恢复值配对
* <Icon icon="pencil" /> [Review and edit](#review-and-edit-state)：让人们在继续之前检查和修改LLM输出或工具调用
* <Icon icon="tool" /> [Interrupting tool calls](#interrupts-in-tools)：执行工具调用前暂停，以便在执行前查看和编辑工具调用
* <Icon icon="shield-check" /> [Validating human input](#validating-human-input)：在继续下一步验证人工输入之前暂停

### 具有人机参与循环 (HITL) 中断的流

当使用人机交互工作流程构建交互式代理时，您可以使用[event streaming](/oss/python/langgraph/event-streaming)在处理中断时同时使用消息块和状态快照。

循环使用 `graph.stream_events(..., version="v3")` 返回的类型化投影，直到运行完成：

* 通过`stream.messages`逐个流式传输 AI 响应
* 通过`stream.values`观察每步状态快照
* 通过`stream.interrupted`检测中断并从`stream.interrupts`读取中断负载
* 通过使用`Command(resume=...)`再次调用`stream_events`来恢复执行，并重复直到`stream.interrupted`为假

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

stream_input: dict | Command = initial_input

while True:
    stream = graph.stream_events(stream_input, config=config, version="v3")

    # Stream LLM message chunks (including any in subgraphs) as they arrive.
    for message in stream.messages:
        for token in message.text:
            display_streaming_content(token)

    # After the run finishes (or pauses), check for interrupts and resume.
    if not stream.interrupted:
        final_state = stream.output
        break

    interrupt_info = stream.interrupts[0].value
    user_response = get_user_input(interrupt_info)
    stream_input = Command(resume=user_response)
```* **`stream.messages`**：聊天模型输出为内容块；迭代每个`message.text`以获得代币增量。对于嵌套子图，从`stream.subgraphs[*].messages`读取消息块。
* **`stream.values`**：每一步后的完整状态快照
* **`stream.interrupted` / `stream.interrupts`**：每次运行后，检查图形是否暂停；从`stream.interrupts`读取有效负载
* **`Command(resume=...)`**：作为下一个`stream_events`输入进行恢复；循环直到运行完成而不中断

### 处理多个中断

当并行分支同时中断时（例如，扇出到多个节点，每个节点都调用`interrupt()`），您可能需要在单次调用中恢复多个中断。
当通过一次调用恢复多个中断时，将每个中断 ID 映射到其恢复值。
这可确保每个响应在运行时与正确的中断配对。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated, TypedDict
import operator

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class State(TypedDict):
    vals: Annotated[list[str], operator.add]


def node_a(state):
    answer = interrupt("question_a")
    return {"vals": [f"a:{answer}"]}


def node_b(state):
    answer = interrupt("question_b")
    return {"vals": [f"b:{answer}"]}


graph = (
    StateGraph(State)
    .add_node("a", node_a)
    .add_node("b", node_b)
    .add_edge(START, "a")
    .add_edge(START, "b")
    .add_edge("a", END)
    .add_edge("b", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "1"}}

# Step 1: stream events to drive the run; both parallel nodes hit interrupt() and pause
stream = graph.stream_events({"vals": []}, config, version="v3")
_ = stream.output  # drive the stream to completion
# stream.interrupts contains the pending Interrupt payloads
print(stream.interrupts)
# > (Interrupt(value='question_a', id='...'), Interrupt(value='question_b', id='...'))

# Step 2: resume all pending interrupts at once
resume_map = {
    i.id: f"answer for {i.value}" for i in stream.interrupts
}
resumed = graph.stream_events(Command(resume=resume_map), config, version="v3")

print("Final state:", resumed.output)
# Final state: {'vals': ['a:answer for question_a', 'b:answer for question_b']}
```

### 批准或拒绝

中断最常见的用途之一是在关键操作之前暂停并请求批准。例如，您可能想要请求人工批准 API 调用、数据库更改或任何其他重要决策。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Literal
from langgraph.types import interrupt, Command

def approval_node(state: State) -> Command[Literal["proceed", "cancel"]]:
    # Pause execution; payload shows up on stream.interrupts (with stream_events) or result["__interrupt__"] (with invoke)
    is_approved = interrupt({
        "question": "Do you want to proceed with this action?",
        "details": state["action_details"]
    })

    # Route based on the response
    if is_approved:
        return Command(goto="proceed")  # Runs after the resume payload is provided
    else:
        return Command(goto="cancel")
```

当您恢复图表时，通过 `True` 批准或 `False` 拒绝：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# To approve
graph.stream_events(Command(resume=True), config=config, version="v3").output

# To reject
graph.stream_events(Command(resume=False), config=config, version="v3").output
```

<Accordion title="Full example">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing import Literal, Optional, TypedDict

  from langgraph.checkpoint.memory import InMemorySaver
  from langgraph.graph import END, START, StateGraph
  from langgraph.types import Command, interrupt


  class ApprovalState(TypedDict):
      action_details: str
      status: Optional[Literal["pending", "approved", "rejected"]]


  def approval_node(state: ApprovalState) -> Command[Literal["proceed", "cancel"]]:
      # Expose details so the caller can render them in a UI
      decision = interrupt(
          {
              "question": "Approve this action?",
              "details": state["action_details"],
          }
      )

      # Route to the appropriate node after resume
      return Command(goto="proceed" if decision else "cancel")


  def proceed_node(state: ApprovalState):
      return {"status": "approved"}


  def cancel_node(state: ApprovalState):
      return {"status": "rejected"}


  builder = StateGraph(ApprovalState)
  builder.add_node("approval", approval_node)
  builder.add_node("proceed", proceed_node)
  builder.add_node("cancel", cancel_node)
  builder.add_edge(START, "approval")
  builder.add_edge("proceed", END)
  builder.add_edge("cancel", END)

  # Use a more durable checkpointer in production
  checkpointer = InMemorySaver()
  graph = builder.compile(checkpointer=checkpointer)

  config = {"configurable": {"thread_id": "approval-123"}}
  initial = graph.stream_events(
      {"action_details": "Transfer $500", "status": "pending"},
      config=config,
      version="v3",
  )
  _ = initial.output  # drive the stream to completion
  print(initial.interrupts)  # -> (Interrupt(value={'question': ..., 'details': ...}),)

  # Resume with the decision; True routes to proceed, False to cancel
  resumed = graph.stream_events(Command(resume=True), config=config, version="v3")
  print(resumed.output["status"])
  ```
</Accordion>

### 查看和编辑状态有时您希望在继续之前让人工检查并编辑部分图形状态。这对于纠正法学硕士、添加缺失的信息或进行调整非常有用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import interrupt

def review_node(state: State):
    # Pause and show the current content for review (payload surfaces on stream.interrupts)
    edited_content = interrupt({
        "instruction": "Review and edit this content",
        "content": state["generated_text"]
    })

    # Update the state with the edited version
    return {"generated_text": edited_content}
```

恢复时，提供编辑后的内容：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.stream_events(
    Command(resume="The edited and improved text"),  # Value becomes the return from interrupt()
    config=config,
    version="v3",
).output
```

<Accordion title="Full example">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing import TypedDict

  from langgraph.checkpoint.memory import MemorySaver
  from langgraph.graph import END, START, StateGraph
  from langgraph.types import Command, interrupt


  class ReviewState(TypedDict):
      generated_text: str


  def review_node(state: ReviewState):
      # Ask a reviewer to edit the generated content
      updated = interrupt(
          {
              "instruction": "Review and edit this content",
              "content": state["generated_text"],
          }
      )
      return {"generated_text": updated}


  builder = StateGraph(ReviewState)
  builder.add_node("review", review_node)
  builder.add_edge(START, "review")
  builder.add_edge("review", END)

  checkpointer = MemorySaver()
  graph = builder.compile(checkpointer=checkpointer)

  config = {"configurable": {"thread_id": "review-42"}}
  initial = graph.stream_events(
      {"generated_text": "Initial draft"}, config=config, version="v3"
  )
  _ = initial.output  # drive the stream to completion
  print(initial.interrupts)  # -> (Interrupt(value={'instruction': ..., 'content': ...}),)

  # Resume with the edited text from the reviewer
  final_state = graph.stream_events(
      Command(resume="Improved draft after review"),
      config=config,
      version="v3",
  )
  print(final_state.output["generated_text"])  # -> "Improved draft after review"
  ```
</Accordion>

### 工具中断

您还可以将中断直接放置在工具函数中。这使得工具本身在调用时暂停以等待批准，并允许在执行工具调用之前进行人工审查和编辑。

首先，定义一个使用[⟦T98⟧](https://reference.langchain.com/python/langgraph/types/interrupt)的工具：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.tools import tool
from langgraph.types import interrupt

@tool
def send_email(to: str, subject: str, body: str):
    """Send an email to a recipient."""

    # Pause before sending; payload surfaces on stream.interrupts when using event streaming
    response = interrupt({
        "action": "send_email",
        "to": to,
        "subject": subject,
        "body": body,
        "message": "Approve sending this email?"
    })

    if response.get("action") == "approve":
        # Resume value can override inputs before executing
        final_to = response.get("to", to)
        final_subject = response.get("subject", subject)
        final_body = response.get("body", body)
        return f"Email sent to {final_to} with subject '{final_subject}'"
    return "Email cancelled by user"
```

当您希望批准逻辑与工具本身一起存在时，这种方法非常有用，使其可以在图表的不同部分中重复使用。 LLM 可以自然地调用该工具，每当调用该工具时中断就会暂停执行，允许您批准、编辑或取消操作。

<Accordion title="Full example">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import sqlite3
  import operator
  from typing import TypedDict, Annotated, Literal
  from langchain.tools import tool
  from langchain_anthropic import ChatAnthropic
  from langgraph.checkpoint.sqlite import SqliteSaver
  from langgraph.graph import StateGraph, START, END
  from langgraph.types import Command, interrupt
  from langchain.messages import AnyMessage, SystemMessage, ToolMessage


  class AgentState(TypedDict):
      messages: Annotated[list[AnyMessage], operator.add]


  @tool
  def send_email(to: str, subject: str, body: str):
      """Send an email to a recipient."""

      # Pause before sending; payload surfaces on stream.interrupts when using event streaming
      response = interrupt({
          "action": "send_email",
          "to": to,
          "subject": subject,
          "body": body,
          "message": "Approve sending this email?",
      })

      if response.get("action") == "approve":
          final_to = response.get("to", to)
          final_subject = response.get("subject", subject)
          final_body = response.get("body", body)

          # Actually send the email (your implementation here)
          print(f"[send_email] to={final_to} subject={final_subject} body={final_body}")
          return f"Email sent to {final_to}"

      return "Email cancelled by user"


  model = ChatAnthropic(model="claude-sonnet-4-6").bind_tools([send_email])
  tools_by_name = {"send_email": send_email}


  def agent_node(state: AgentState):
      # LLM may decide to call the tool; interrupt pauses before sending
      result = model.invoke(state["messages"])
      return {"messages": [result]}

  def tool_node(state: AgentState):
      """Performs the tool call"""
      result = []
      for tool_call in state["messages"][-1].tool_calls:
          tool = tools_by_name[tool_call["name"]]
          observation = tool.invoke(tool_call["args"])
          result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
      return {"messages": result}

  def should_continue(state: AgentState) -> Literal["tool_node", END]:
      """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
      messages = state["messages"]
      last_message = messages[-1]

      if last_message.tool_calls:
          return "tool_node"
      return END

  builder = StateGraph(AgentState)
  builder.add_node("agent", agent_node)
  builder.add_node("tool_node", tool_node)

  builder.add_edge(START, "agent")
  builder.add_conditional_edges("agent", should_continue, ["tool_node", END])  # Routes to "tools" or END
  builder.add_edge("tool_node", "agent")  # Loop back after tools

  checkpointer = SqliteSaver(
      sqlite3.connect("tool-approval.db", check_same_thread=False)
  )
  graph = builder.compile(checkpointer=checkpointer)

  config = {"configurable": {"thread_id": "email-workflow"}}
  initial = graph.stream_events(
      {
          "messages": [
              {"role": "user", "content": "Send an email to alice@example.com about the meeting"}
          ]
      },
      config=config,
      version="v3",
  )
  initial.output  # drive the stream to completion
  print(initial.interrupts)  # -> (Interrupt(value={'action': 'send_email', ...}),)

  # Resume with approval and optionally edited arguments
  resumed = graph.stream_events(
      Command(resume={"action": "approve", "subject": "Updated subject"}),
      config=config,
      version="v3",
  )
  print(resumed.output["messages"][-1])  # -> Tool result returned by send_email
  ```
</Accordion>

### 验证人工输入有时您需要验证人类的输入并重新提示该值是否无效。推荐的方法是调用`interrupt()` **每个节点调用一次**，从状态中存储错误消息的节点返回，并使用**条件边**循环回节点，直到提供有效值。

<Warning>
  **避免 `while True` + `interrupt()` 在单个节点内循环。** 因为节点在每次恢复时都从头重新运行（请参阅 [Rules of interrupts](#rules-of-interrupts)），所以多次调用 `interrupt()` 的循环会导致每个恢复重播所有先前的迭代：第一个恢复重播 1 次迭代，第二次重播 2 次迭代，依此类推。结果是循环体内任何代码的指数重新执行。
</Warning>

正确的模式：

1. 将重新提示的问题存储在状态中（例如`pending_question`）。
2. 在节点中，调用`interrupt()` **恰好一次**，从状态传递当前问题。
3. 如果答案无效，则返回更新后的`pending_question`，以便下次调用重新提示。
4. 使用`add_conditional_edges`路由回节点，直到收集到有效值。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt


class FormState(TypedDict):
    age: int | None
    pending_question: str | None


def get_age_node(state: FormState):
    question = state.get("pending_question") or "What is your age?"
    answer = interrupt(question)  # called exactly once per invocation
    if isinstance(answer, int) and answer > 0:
        return {"age": answer, "pending_question": None}
    return {"pending_question": f"'{answer}' is not a valid age. Please enter a positive number."}


def route(state: FormState):
    return END if state.get("age") is not None else "collect_age"


builder = StateGraph(FormState)
builder.add_node("collect_age", get_age_node)
builder.add_edge(START, "collect_age")
builder.add_conditional_edges("collect_age", route)
```每个恢复调用 `get_age_node` 一次，运行 `interrupt()` 调用一次，然后退出。当答案无效时，条件边沿循环返回，并且下一个中断会重新提示更新的问题。每个简历中没有代码运行超过一次。

<Accordion title="Full example">
  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing import TypedDict

  from langgraph.checkpoint.memory import InMemorySaver
  from langgraph.graph import END, START, StateGraph
  from langgraph.types import Command, interrupt


  class FormState(TypedDict):
      age: int | None
      pending_question: str | None


  def get_age_node(state: FormState):
      question = state.get("pending_question") or "What is your age?"
      answer = interrupt(question)  # called exactly once per node invocation
      print(f"I got {answer}")  # runs exactly once per resume
      if isinstance(answer, int) and answer > 0:
          return {"age": answer, "pending_question": None}
      return {"pending_question": f"'{answer}' is not a valid age. Please enter a positive number."}


  def route(state: FormState):
      # Loop back to collect_age until we have a valid age
      return END if state.get("age") is not None else "collect_age"


  builder = StateGraph(FormState)
  builder.add_node("collect_age", get_age_node)
  builder.add_edge(START, "collect_age")
  builder.add_conditional_edges("collect_age", route)

  checkpointer = InMemorySaver()
  graph = builder.compile(checkpointer=checkpointer)

  config = {"configurable": {"thread_id": "form-1"}}
  first = graph.stream_events({"age": None, "pending_question": None}, config=config, version="v3")
  _ = first.output  # drive the stream to completion
  print(first.interrupts)  # -> (Interrupt(value='What is your age?', ...),)

  # Provide invalid data; the node re-prompts via the conditional edge
  retry = graph.stream_events(Command(resume="thirty"), config=config, version="v3")
  _ = retry.output
  print(retry.interrupts)  # -> (Interrupt(value="'thirty' is not a valid age...", ...),)

  # Provide valid data; route() returns END and the graph finishes
  final = graph.stream_events(Command(resume=30), config=config, version="v3")
  print(final.output["age"])  # -> 30
  ```
</Accordion>

## 中断规则

当您在节点内调用 [⟦T109⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 时，LangGraph 会通过引发异常来指示运行时暂停来暂停执行。该异常通过调用堆栈向上传播并被运行时捕获，通知图保存当前状态并等待外部输入。

当执行恢复时（在提供请求的输入之后），运行时会从头开始重新启动整个节点 - 它不会从调用 [⟦T110⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 的确切行恢复。这意味着在 [⟦T111⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 之前运行的任何代码都将再次执行。因此，在处理中断时需要遵循一些重要规则，以确保它们按预期运行。

### 不要将 `interrupt` 调用包装在 try/ except 中[⟦T113⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 在调用点暂停执行的方法是抛出一个特殊的异常。如果将 [⟦T114⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用包装在 try/ except 块中，您将捕获此异常，并且中断将不会传递回图表。

* ✅ 将 [⟦T115⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用与容易出错的代码分开
* ✅ 在 try/ except 块中使用特定的异常类型

<CodeGroup>
  ```python Separating logic theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: interrupting first, then handling
      # error conditions separately
      interrupt("What's your name?")
      try:
          fetch_data()  # This can fail
      except Exception as e:
          print(e)
      return state
  ```

  ```python Explicit exception handling theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: catching specific exception types
      # will not catch the interrupt exception
      try:
          name = interrupt("What's your name?")
          fetch_data()  # This can fail
      except NetworkException as e:
          print(e)
      return state
  ```
</CodeGroup>

* 🔴 不要将 [⟦T116⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用包装在裸露的 try/ except 块中

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def node_a(state: State):
    # ❌ Bad: wrapping interrupt in bare try/except
    # will catch the interrupt exception
    try:
        interrupt("What's your name?")
    except Exception as e:
        print(e)
    return state
```

### 不要在节点内重新排序 `interrupt` 调用

在单个节点中使用多个中断是很常见的，但是如果处理不仔细，这可能会导致意外的行为。

当一个节点包含多个中断调用时，LangGraph 会保留一个特定于执行该节点的任务的恢复值列表。每当执行恢复时，它都会从节点的开头开始。对于遇到的每个中断，LangGraph 都会检查任务的恢复列表中是否存在匹配的值。匹配**严格基于索引**，因此节点内中断调用的顺序很重要。

* ✅ 保持 [⟦T118⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用在节点执行之间保持一致

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def node_a(state: State):
    # ✅ Good: interrupt calls happen in the same order every time
    name = interrupt("What's your name?")
    age = interrupt("What's your age?")
    city = interrupt("What's your city?")

    return {
        "name": name,
        "age": age,
        "city": city
    }
```* 🔴 不要有条件地跳过节点内的 [⟦T119⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用
* 🔴 不要使用跨执行不确定的逻辑来循环 [⟦T120⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用，包括 `while True` 验证循环。使用条件边（参见[Validating human input](#validating-human-input)）

<CodeGroup>
  ```python Skipping interrupts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ❌ Bad: conditionally skipping interrupts changes the order
      name = interrupt("What's your name?")

      # On first run, this might skip the interrupt
      # On resume, it might not skip it - causing index mismatch
      if state.get("needs_age"):
          age = interrupt("What's your age?")

      city = interrupt("What's your city?")

      return {"name": name, "city": city}
  ```

  ```python Looping interrupts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ❌ Bad: looping based on non-deterministic data
      # The number of interrupts changes between executions
      results = []
      for item in state.get("dynamic_list", []):  # List might change between runs
          result = interrupt(f"Approve {item}?")
          results.append(result)

      return {"results": results}
  ```
</CodeGroup>

### 不要在 `interrupt` 调用中返回复数值

根据使用的检查指针，复杂值可能无法序列化（例如，您无法序列化函数）。为了使您的图表适应任何部署，最佳实践是仅使用可以合理序列化的值。

* ✅ 将简单的 JSON 可序列化类型传递给 [⟦T123⟧](https://reference.langchain.com/python/langgraph/types/interrupt)
* ✅ 传递具有简单值的字典/对象

<CodeGroup>
  ```python Simple values theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: passing simple types that are serializable
      name = interrupt("What's your name?")
      count = interrupt(42)
      approved = interrupt(True)

      return {"name": name, "count": count, "approved": approved}
  ```

  ```python Structured data theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: passing dictionaries with simple values
      response = interrupt({
          "question": "Enter user details",
          "fields": ["name", "email", "age"],
          "current_values": state.get("user", {})
      })

      return {"user": response}
  ```
</CodeGroup>

* 🔴不要将函数、类实例或其他复杂对象传递给[⟦T124⟧](https://reference.langchain.com/python/langgraph/types/interrupt)

<CodeGroup>
  ```python Functions theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def validate_input(value):
      return len(value) > 0

  def node_a(state: State):
      # ❌ Bad: passing a function to interrupt
      # The function cannot be serialized
      response = interrupt({
          "question": "What's your name?",
          "validator": validate_input  # This will fail
      })
      return {"name": response}
  ```

  ```python Class instances theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  class DataProcessor:
      def __init__(self, config):
          self.config = config

  def node_a(state: State):
      processor = DataProcessor({"mode": "strict"})

      # ❌ Bad: passing a class instance to interrupt
      # The instance cannot be serialized
      response = interrupt({
          "question": "Enter data to process",
          "processor": processor  # This will fail
      })
      return {"result": response}
  ```
</CodeGroup>

### 在`interrupt`之前调用的副作用必须是幂等的

因为中断是通过重新运行调用它们的节点来工作的，所以在 [⟦T126⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 之前调用的副作用应该（理想情况下）是幂等的。对于上下文来说，幂等性意味着可以多次应用相同的操作，而不会改变初始执行之外的结果。例如，您可能有一个 API 调用来更新节点内的记录。如果在调用之后调用[⟦T127⟧](https://reference.langchain.com/python/langgraph/types/interrupt)，则当节点恢复时它将重新运行多次，可能会覆盖初始更新或创建重复记录。

* ✅ 在[⟦T128⟧](https://reference.langchain.com/python/langgraph/types/interrupt)之前使用幂等操作
* ✅ 在 [⟦T129⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 调用之后放置副作用
* ✅ 如果可能的话，将副作用分离到单独的节点中

<CodeGroup>
  ```python Idempotent operations theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: using upsert operation which is idempotent
      # Running this multiple times will have the same result
      db.upsert_user(
          user_id=state["user_id"],
          status="pending_approval"
      )

      approved = interrupt("Approve this change?")

      return {"approved": approved}
  ```

  ```python Side effects after interrupt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ✅ Good: placing side effect after the interrupt
      # This ensures it only runs once after approval is received
      approved = interrupt("Approve this change?")

      if approved:
          db.create_audit_log(
              user_id=state["user_id"],
              action="approved"
          )

      return {"approved": approved}
  ```

  ```python Separating into different nodes theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def approval_node(state: State):
      # ✅ Good: only handling the interrupt in this node
      approved = interrupt("Approve this change?")

      return {"approved": approved}

  def notification_node(state: State):
      # ✅ Good: side effect happens in a separate node
      # This runs after approval, so it only executes once
      if (state.approved):
          send_notification(
              user_id=state["user_id"],
              status="approved"
          )

      return state
  ```
</CodeGroup>

* 🔴[⟦T130⟧](https://reference.langchain.com/python/langgraph/types/interrupt)之前不要进行非幂等操作
* 🔴 在未检查记录是否存在的情况下不要创建新记录

<CodeGroup>
  ```python Creating records theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ❌ Bad: creating a new record before interrupt
      # This will create duplicate records on each resume
      audit_id = db.create_audit_log({
          "user_id": state["user_id"],
          "action": "pending_approval",
          "timestamp": datetime.now()
      })

      approved = interrupt("Approve this change?")

      return {"approved": approved, "audit_id": audit_id}
  ```

  ```python Appending to lists theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  def node_a(state: State):
      # ❌ Bad: appending to a list before interrupt
      # This will add duplicate entries on each resume
      db.append_to_history(state["user_id"], "approval_requested")

      approved = interrupt("Approve this change?")

      return {"approved": approved}
  ```
</CodeGroup>

## 与称为函数的子图一起使用

当调用节点内的子图时，父图将从调用子图并触发[⟦T131⟧](https://reference.langchain.com/python/langgraph/types/interrupt)的**节点**开始处恢复执行。同样，**子图**也会从调用 [⟦T132⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 的节点的开头开始恢复。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
def node_in_parent_graph(state: State):
    some_code()  # <-- This will re-execute when resumed
    # Invoke a subgraph as a function.
    # The subgraph contains an `interrupt` call.
    subgraph_result = subgraph.invoke(some_input)
    # ...

def node_in_subgraph(state: State):
    some_other_code()  # <-- This will also re-execute when resumed
    result = interrupt("What's your name?")
    # ...
```

## 使用中断进行调试要调试和测试图形，您可以使用静态中断作为断点，一次单步执行一个节点的图形执行。静态中断在节点执行之前或之后的定义点触发。您可以在编译图表时通过指定 `interrupt_before` 和 `interrupt_after` 来设置这些。

<Note>
  **不**建议将静态中断用于人机交互工作流程。请改用 [⟦T135⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 函数。
</Note>

<Tabs>
  <Tab title="At compile time">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    graph = builder.compile(
        interrupt_before=["node_a"],  # [!code highlight]
        interrupt_after=["node_b", "node_c"],  # [!code highlight]
        checkpointer=checkpointer,
    )

    # Pass a thread ID to the graph
    config = {
        "configurable": {
            "thread_id": "some_thread"
        }
    }

    # Run the graph until the breakpoint
    graph.invoke(inputs, config=config)  # [!code highlight]

    # Resume the graph
    graph.invoke(None, config=config)  # [!code highlight]
    ```

    1. 断点设置在`compile`时间内。
    2. `interrupt_before` 指定执行该节点之前应暂停执行的节点。
    3. `interrupt_after` 指定该节点执行完毕后应暂停执行的节点。
    4. 需要一个检查点来启用断点。
    5. 运行图表直至遇到第一个断点。
    6. 通过传入 `None` 作为输入来恢复图表。这将运行图表直到遇到下一个断点。
  </Tab>

  <Tab title="At run time">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    config = {
        "configurable": {
            "thread_id": "some_thread"
        }
    }

    # Run the graph until the breakpoint
    graph.invoke(
        inputs,
        interrupt_before=["node_a"],  # [!code highlight]
        interrupt_after=["node_b", "node_c"],  # [!code highlight]
        config=config,
    )

    # Resume the graph
    graph.invoke(None, config=config)  # [!code highlight]
    ```1. 使用`interrupt_before`和`interrupt_after`参数调用`graph.invoke`。这是一个运行时配置，可以在每次调用时更改。
    2. `interrupt_before` 指定执行该节点之前应暂停执行的节点。
    3. `interrupt_after` 指定该节点执行完毕后应暂停执行的节点。
    4. 运行图表直到遇到第一个断点。
    5. 通过传入 `None` 作为输入来恢复图表。这将运行图表直到遇到下一个断点。
  </Tab>
</Tabs>

<Tip>
  要调试中断，请使用[LangSmith](/langsmith/observability)。
</Tip>

### 使用 LangSmith Studio

在运行图表之前，您可以使用 [LangSmith Studio](/langsmith/studio) 在 UI 中的图表中设置静态中断。您还可以使用 UI 在执行过程中的任意时刻检查图形状态。

<img alt="image" />

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/interrupts.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>