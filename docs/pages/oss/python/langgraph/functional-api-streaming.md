<!-- langgraph-docs: Stream with the Functional API | https://docs.langchain.com/oss/python/langgraph/functional-api-streaming -->

# Stream with the Functional API

Emit custom progress from Functional API entrypoints, or read state snapshots from the values stream.

Stream from a Functional API [entrypoint](/oss/python/langgraph/functional-api#entrypoint) in two ways. Custom data is a side channel: you push progress with a writer, then read `custom` chunks. Values are state snapshots the runtime records, including the entrypoint return value. You do not call a writer for values.

For concepts, see the [Functional API overview](/oss/python/langgraph/functional-api). For messages and other typed projections, see [event streaming](/oss/python/langgraph/event-streaming).

## Emit custom data

The Functional API uses the same stream as the [Graph API](/oss/python/langgraph/graph-api). Emit with a writer, then consume `custom` chunks. For stream modes, see [Streaming](/oss/python/langgraph/streaming).

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

> [card] [View example trace](https://smith.langchain.com/public/39b6ad85-7072-4290-8ae4-3f0f76c9c28a/r)
>
> Open a public LangSmith run for this example.

1. Import [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/get_stream_writer) from `langgraph.config`.
2. Call it inside the entrypoint to get a writer.
3. Emit custom data before and after the computation.
4. Call `stream(..., stream_mode="custom")` and iterate the chunks.

> [!WARNING]
>
> **Async with Python \< 3.11**
> In async code on Python \< 3.11, [`get_stream_writer`](https://reference.langchain.com/python/langgraph/config/get_stream_writer) does not work. Use the injectable `StreamWriter` parameter instead. See [Async with Python \< 3.11](/oss/python/langgraph/streaming#async).
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

## Stream values

Reuse the `main` entrypoint from [Emit custom data](#emit-custom-data). Iterate `stream.values` for state snapshots. For messages and other projections, see [event streaming](/oss/python/langgraph/event-streaming).

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
values_config = {"configurable": {"thread_id": str(uuid7())}}
stream = main.stream_events({"x": 5}, config=values_config, version="v3")
for snapshot in stream.values:
    print(snapshot)
# 10
```

## See also

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Event streaming](/oss/python/langgraph/event-streaming)
* [Streaming](/oss/python/langgraph/streaming)
* [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-streaming.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).