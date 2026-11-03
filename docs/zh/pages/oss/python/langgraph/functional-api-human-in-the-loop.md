<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Add human-in-the-loop with the Functional API | https://docs.langchain.com/oss/python/langgraph/functional-api-human-in-the-loop -->

# 使用功能 API 添加人机交互

暂停功能 API 工作流程以进行批准和审查带有中断的工具调用。

使用 [⟦T3⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 暂停功能 API [entrypoint](/oss/python/langgraph/functional-api#entrypoint)，并使用 [⟦T4⟧](/oss/python/langgraph/interrupts#resuming-interrupts) 恢复。

有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。有关中断有效负载和恢复形状，请参阅[Interrupts](/oss/python/langgraph/interrupts)。持久性需要[checkpointer](/oss/python/langgraph/persistence)和`thread_id`。

## 暂停以获取反馈

创建三个[tasks](/oss/python/langgraph/functional-api#task)：

1. 追加`"bar"`。
2. 暂停以等待人工输入。恢复时，附加该输入。
3. 追加`"qux"`。

将它们组合在入口点中。 `step_1` 完成后，`interrupt` 在`human_feedback` 内运行。这些结果将被保留，因此恢复后`step_1`不会再次运行。

使用 `thread_id` 识别运行。驱动流直到暂停，打印中断有效负载，然后恢复。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.types import Command, interrupt


@task
def step_1(input_query):
    """Append bar."""
    return f"{input_query} bar"


@task
def human_feedback(input_query):
    """Append user input."""
    feedback = interrupt(f"Please provide feedback: {input_query}")
    return f"{input_query} {feedback}"


@task
def step_3(input_query):
    """Append qux."""
    return f"{input_query} qux"


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(input_query):
    result_1 = step_1(input_query).result()
    result_2 = human_feedback(result_1).result()
    result_3 = step_3(result_2).result()
    return result_3


config = {"configurable": {"thread_id": "1"}}

stream = workflow.stream_events("foo", config, version="v3")
_ = stream.output
print(stream.interrupts[0].value)
# -> 'Please provide feedback: foo bar'

stream = workflow.stream_events(Command(resume="baz"), config, version="v3")
print(stream.output)
# -> 'foo bar baz qux'
```

`Command` `resume` 值是`human_feedback` 期望的数据。恢复后，运行继续通过`step_3`并返回`foo bar baz qux`。

## 查看工具调用

要在执行前检查工具调用，请从助手中调用 `interrupt`。执行将暂停，直到您使用 `Command` 恢复。

给定一个工具调用，选择以下之一：

* 接受工具调用
* 修改工具调用并继续
* 生成自定义工具消息（例如，指示模型重新格式化其工具调用）

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Any, Literal, TypedDict, Union

from langchain.messages import ToolMessage
from langgraph.types import interrupt


class ToolCallReview(TypedDict, total=False):
    action: Literal["continue", "update", "feedback"]
    data: Any


def review_tool_call(tool_call: dict) -> Union[dict, ToolMessage]:
    """Review a tool call, returning a validated version."""
    human_review: ToolCallReview = interrupt(
        {
            "question": "Is this correct?",
            "tool_call": tool_call,
        }
    )
    review_action = human_review["action"]
    review_data = human_review.get("data")
    if review_action == "continue":
        return tool_call
    if review_action == "update":
        return {**tool_call, "args": review_data}
    if review_action == "feedback":
        return ToolMessage(
            content=review_data, name=tool_call["name"], tool_call_id=tool_call["id"]
        )
    raise ValueError(f"Unknown review action: {review_action}")
```将助手连接到入口点。接受或修改的呼叫通过`call_tool`运行。反馈变成[⟦T21⟧](https://reference.langchain.com/python/langchain-core/messages/tool/ToolMessage)并跳过执行。先前的任务结果，这里是第一个模型调用，在中断后留在线程上。

下面的`call_model`和`call_tool`是替身。将它们替换为您的模型和工具。有关更多信息，请参阅[Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)。

入口点使用`previous`从检查点恢复先前的消息。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.messages import AIMessage, HumanMessage, ToolMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages
from langgraph.types import Command


checkpointer = InMemorySaver()


@task
def call_model(messages: list) -> AIMessage:
    last = messages[-1]
    if isinstance(last, ToolMessage):
        return AIMessage(content="Search complete.")
    return AIMessage(
        content="",
        tool_calls=[
            {
                "name": "search",
                "args": {"query": "weather"},
                "id": "call_1",
                "type": "tool_call",
            }
        ],
    )


@task
def call_tool(tool_call: dict) -> ToolMessage:
    return ToolMessage(
        content=f"result for {tool_call['args']}",
        name=tool_call["name"],
        tool_call_id=tool_call["id"],
    )


@entrypoint(checkpointer=checkpointer)
def agent(messages, *, previous=None):
    if previous is not None:
        messages = add_messages(previous, messages)

    model_response = call_model(messages).result()
    while True:
        if not model_response.tool_calls:
            break

        # Review tool calls
        tool_results = []
        tool_calls = []
        updated_tool_calls = list(model_response.tool_calls)
        for i, tool_call in enumerate(model_response.tool_calls):
            review = review_tool_call(tool_call)
            if isinstance(review, ToolMessage):
                tool_results.append(review)
            else:  # is a validated tool call
                tool_calls.append(review)
                updated_tool_calls[i] = review

        if updated_tool_calls != list(model_response.tool_calls):
            model_response = model_response.model_copy(
                update={"tool_calls": updated_tool_calls}
            )

        # Execute remaining tool calls
        tool_result_futures = [call_tool(tool_call) for tool_call in tool_calls]
        remaining_tool_results = [fut.result() for fut in tool_result_futures]

        # Append to message list
        messages = add_messages(
            messages,
            [model_response, *tool_results, *remaining_tool_results],
        )

        # Call model again
        model_response = call_model(messages).result()

    # Generate final response
    messages = add_messages(messages, model_response)
    return entrypoint.final(value=model_response, save=messages)


config = {"configurable": {"thread_id": "2"}}

stream = agent.stream_events(
    [HumanMessage("What's the weather?")], config, version="v3"
)
_ = stream.output
print(stream.interrupts[0].value)
# -> {'question': 'Is this correct?', 'tool_call': {'name': 'search', ...}}

result = agent.invoke(Command(resume={"action": "continue"}), config)
print(result)
```

## 另请参阅

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Interrupts](/oss/python/langgraph/interrupts)
* [Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)
* [Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-human-in-the-loop.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。