<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Compose Functional API workflows | https://docs.langchain.com/oss/python/langgraph/functional-api-workflows -->

# 编写函数式 API 工作流程

构建入口点和任务、并行运行工作以及调用图或其他入口点。

使用这些配方从 [entrypoint](https://reference.langchain.com/python/langgraph/func/entrypoint) 和 [task](https://reference.langchain.com/python/langgraph/func/task) 构建块组成功能 API 工作流程。

有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。对于有序的构建路径，请参阅[Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)。

这些示例使用内存中的 [checkpointer](/oss/python/langgraph/persistence)，因此结果会保留在线程上。

## 创建一个简单的工作流程

这是来自 [Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis) 的偶数/奇数流。这个版本添加了一个检查指针，因此运行有一个线程。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task


@task
def is_even(number: int) -> bool:
    return number % 2 == 0


@task
def format_message(is_even: bool) -> str:
    return "The number is even." if is_even else "The number is odd."


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: dict) -> str:
    even = is_even(inputs["number"]).result()
    return format_message(even).result()


config = {"configurable": {"thread_id": str(uuid7())}}
result = workflow.invoke({"number": 7}, config=config)
print(result)
```

入口点采用一个位置参数作为输入。要传递多个字段，请使用字典：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def my_workflow(inputs: dict) -> dict:
    value = inputs["value"]
    another_value = inputs["another_value"]
    return {"sum": value + another_value}


config = {"configurable": {"thread_id": "1"}}
my_workflow.invoke({"value": 1, "another_value": 2}, config)
```

## 并行运行任务

任务一调用就会开始并返回 future。首先收集这些期货，然后等待`.result()`，这样工作就会重叠。

此模式有助于 I/O 密集型工作，例如 LLM API 调用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task

checkpointer = InMemorySaver()


@task
def add_one(number: int) -> int:
    return number + 1


@entrypoint(checkpointer=checkpointer)
def workflow(numbers: list[int]) -> list[int]:
    futures = [add_one(i) for i in numbers]
    return [f.result() for f in futures]
```

> [accordion] 扩展示例：并行 LLM 调用
>
> 每个任务都会生成一个关于不同主题的段落。结果连接成一个字符串。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.chat_models import init_chat_model
> from langchain_core.utils.uuid import uuid7
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint, task
>
> model = init_chat_model("claude-sonnet-4-6")
>
>
> @task
> def generate_paragraph(topic: str) -> str:
>     response = model.invoke([
>         {"role": "system", "content": "You are a helpful assistant that writes educational paragraphs."},
>         {"role": "user", "content": f"Write a paragraph about {topic}."}
>     ])
>     return response.text
>
>
> checkpointer = InMemorySaver()
>
>
> @entrypoint(checkpointer=checkpointer)
> def workflow(topics: list[str]) -> str:
>     futures = [generate_paragraph(topic) for topic in topics]
>     paragraphs = [f.result() for f in futures]
>     return "\n\n".join(paragraphs)
>
>
> config = {"configurable": {"thread_id": str(uuid7())}}
> result = workflow.invoke(["quantum computing", "climate change", "history of aviation"], config=config)
> print(result)
> ```

## 调用图表

功能 API 和 [Graph API](/oss/python/langgraph/graph-api) 共享相同的运行时。编译图是另一种可调用的：像任何其他函数一样从入口点调用它。除非将 `config` 传递到 `invoke`，否则嵌套图不会共享外线程。在入口点请求注入的`config`并转发它。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import TypedDict

from langchain_core.runnables import RunnableConfig
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint
from langgraph.graph import START, StateGraph


class State(TypedDict):
    foo: int


def double(state: State) -> State:
    return {"foo": state["foo"] * 2}


builder = StateGraph(State)
builder.add_node("double", double)
builder.add_edge(START, "double")
graph = builder.compile()

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(x: int, *, config: RunnableConfig) -> dict:
    result = graph.invoke({"foo": x}, config)
    return {"bar": result["foo"]}


config = {"configurable": {"thread_id": str(uuid7())}}
print(workflow.invoke(5, config=config))  # {'bar': 10}
```

## 调用其他入口点

您可以从入口点或任务内调用其他入口点。

当定义的子级没有检查指针时，从具有检查指针的父级调用它会使用父级的检查指针。除非您通过检查点，否则单独调用子进程不会持续存在。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint

checkpointer = InMemorySaver()


@entrypoint()  # Inherits the checkpointer when invoked from my_workflow
def some_other_workflow(inputs: dict) -> int:
    return inputs["value"]


@entrypoint(checkpointer=checkpointer)
def my_workflow(inputs: dict) -> int:
    value = some_other_workflow.invoke({"value": 1})
    return value
```

> [accordion] 扩展示例：调用另一个入口点
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain_core.utils.uuid import uuid7
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
>
> checkpointer = InMemorySaver()
>
>
> @entrypoint()
> def multiply(inputs: dict) -> int:
>     return inputs["a"] * inputs["b"]
>
>
> @entrypoint(checkpointer=checkpointer)
> def main(inputs: dict) -> dict:
>     result = multiply.invoke({"a": inputs["x"], "b": inputs["y"]})
>     return {"product": result}
>
>
> config = {"configurable": {"thread_id": str(uuid7())}}
> print(main.invoke({"x": 6, "y": 7}, config=config))  # {'product': 42}
> ```

## 另请参阅

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Workflows and agents](/oss/python/langgraph/workflows-agents)
* [Add LangGraph's features to other frameworks using the Functional API](/langsmith/deploy-other-frameworks)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-workflows.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。