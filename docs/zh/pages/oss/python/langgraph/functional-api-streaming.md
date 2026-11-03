<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Stream with the Functional API | https://docs.langchain.com/oss/python/langgraph/functional-api-streaming -->

# 使用函数式 API 进行流式传输

从功能 API 入口点发出自定义进度，或从值流读取状态快照。

通过两种方式从功能 API [entrypoint](/oss/python/langgraph/functional-api#entrypoint) 进行流式传输。自定义数据是一个侧通道：您使用写入器推送进度，然后读取 `custom` 块。值是运行时记录的状态快照，包括入口点返回值。你不会打电话给作家来询问价值观。

有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。对于消息和其他类型的投影，请参阅[event streaming](/oss/python/langgraph/event-streaming)。

## 发出自定义数据

功能 API 使用与 [Graph API](/oss/python/langgraph/graph-api) 相同的流。使用 writer 发出，然后消耗 `custom` 块。对于流模式，请参阅[Streaming](/oss/python/langgraph/streaming)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.config import get_stream_writer
from langgraph.func import entrypoint

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def main(inputs: dict) -> int:
    writer = get_stream_writer()
    writer("Started processing")
    result = inputs["x"] * 2
    writer(f"Result is {result}")
    return result


config = {"configurable": {"thread_id": str(uuid7())}}

for chunk in main.stream({"x": 5}, config, stream_mode="custom"):
    print(chunk)
# Started processing
# Result is 10
```

> [卡][View example trace](https://smith.langchain.com/public/39b6ad85-7072-4290-8ae4-3f0f76c9c28a/r)
>
> 为此示例打开公共 LangSmith 运行。

1. 从`langgraph.config`导入[⟦T5⟧](https://reference.langchain.com/python/langgraph/config/get_stream_writer)。
2. 在入口点内调用它来获取写入器。
3. 在计算之前和之后发出自定义数据。
4. 调用`stream(..., stream_mode="custom")`并迭代块。

> [!警告]
>
> **与 Python 异步 \< 3.11**
> 在 Python 上的异步代码中 \< 3.11, ⟦T19⟧ does not work. Use the injectable ⟦T9⟧ parameter instead. See ⟦T20⟧.
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langgraph.checkpoint.memory import InMemorySaver
> from langgraph.func import entrypoint
> from langgraph.types import StreamWriter
>
> checkpointer = InMemorySaver()
>
> @entrypoint(checkpointer=checkpointer)
> async def main(inputs: dict, writer: StreamWriter) -> int:  # [!code highlight]
>     writer("Started processing")
>     return inputs["x"] * 2
> ```

## 流值

重用 [Emit custom data](#emit-custom-data) 中的 `main` 入口点。迭代 `stream.values` 以获得状态快照。有关消息和其他预测，请参阅[event streaming](/oss/python/langgraph/event-streaming)。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
values_config = {"configurable": {"thread_id": str(uuid7())}}
stream = main.stream_events({"x": 5}, config=values_config, version="v3")
for snapshot in stream.values:
    print(snapshot)
# 10
```

## 另请参阅

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Event streaming](/oss/python/langgraph/event-streaming)
* [Streaming](/oss/python/langgraph/streaming)
* [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)

***[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-streaming.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。