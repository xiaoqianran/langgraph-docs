<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Configure Functional API tasks | https://docs.langchain.com/oss/python/langgraph/functional-api-tasks -->

# 配置功能API任务

向功能 API 任务和入口点添加重试、超时、缓存和错误恢复。

[task](/oss/python/langgraph/functional-api#task) 是一个离散的工作单元，其结果可以单独为 [checkpointed](/oss/python/langgraph/persistence)。当 [entrypoint](/oss/python/langgraph/functional-api#entrypoint) 或 [Graph API node](/oss/python/langgraph/graph-api#using-tasks-in-nodes) 运行多个操作时，请将每个操作包装在一个任务中，而不是将所有工作放在一个函数体中。使用检查指针，可以保存已完成的任务结果，因此恢复的线程可以跳过已完成的工作并继续下一个任务。

本页介绍任务的重试、超时、缓存和错误恢复。有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。对于有序的构建路径，请参阅 [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)。共享重试和超时生命周期请参见[Fault tolerance](/oss/python/langgraph/fault-tolerance)。

## 添加重试策略

通过 `@task` 上的 `retry_policy`。默认 `RetryPolicy` 重试选定的网络和 HTTP 5xx 错误。它不会重试 `ValueError`。此示例重试 `ValueError`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.func import entrypoint, task
from langgraph.types import RetryPolicy

# Used only to simulate a transient failure. Do not use a global like this in production.
attempts = 0

retry_policy = RetryPolicy(retry_on=ValueError)


@task(retry_policy=retry_policy)
def get_info():
    global attempts
    attempts += 1

    if attempts < 2:
        raise ValueError("Failure")
    return "OK"


@entrypoint()
def main(inputs):
    return get_info().result()


print(main.invoke({"any_input": "foobar"}))
# 'OK'
```

## 设置超时时间

限制单个异步尝试可以运行的时间。如果重试策略重试超时错误，计时器将在下次尝试时重置。

在几秒钟内将`timeout`传递到`@task`或`@entrypoint`或作为`datetime.timedelta`。超时仅适用于异步任务和入口点。在同步函数上设置 `timeout` 会在声明时引发错误。第一次尝试会在超时后休眠并引发 [⟦T14⟧](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError)，它是 `TimeoutError` 的子类。重试策略会重试该错误。第二次尝试立即返回。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import asyncio

from langgraph.errors import NodeTimeoutError
from langgraph.func import entrypoint, task
from langgraph.types import RetryPolicy

attempts = 0


@task(
    timeout=1.0,
    retry_policy=RetryPolicy(retry_on=NodeTimeoutError),
)
async def call_api(url: str) -> str:
    global attempts
    attempts += 1
    if attempts < 2:
        await asyncio.sleep(2)
    return f"result from {url}"


@entrypoint(timeout=5.0)
async def workflow(inputs: dict) -> str:
    return await call_api(inputs["url"])


print(asyncio.run(workflow.ainvoke({"url": "https://example.com"})))
# 'result from https://example.com'
```

## 缓存一个任务

通过输入缓存任务结果。传递 [entrypoint](/oss/python/langgraph/functional-api#entrypoint) 上的缓存和任务上的策略。 `ttl` 以秒为单位。第二次调用是缓存命中，因此这次运行大约需要 1 秒，而不是 2 秒。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time

from langgraph.cache.memory import InMemoryCache
from langgraph.func import entrypoint, task
from langgraph.types import CachePolicy


@task(cache_policy=CachePolicy(ttl=120))  # [!code highlight]
def slow_add(x: int) -> int:
    time.sleep(1)
    return x * 2


@entrypoint(cache=InMemoryCache())
def main(inputs: dict) -> dict[str, int]:
    result1 = slow_add(inputs["x"]).result()
    result2 = slow_add(inputs["x"]).result()
    return {"result1": result1, "result2": result2}


print(main.invoke({"x": 5}))
# {'result1': 10, 'result2': 10}
```

## 错误后恢复

需要[checkpointer](/oss/python/langgraph/persistence)，以便已完成的任务结果在失败的运行中得以保留。

恢复从入口点的开头开始。 LangGraph从检查点恢复已完成的`slow_task`结果，因此其函数体不会再次运行。失败的`get_info`任务再次运行并返回`"OK"`。下面的执行日志区分了入口点重新进入和任务重新执行。

与 `None` 恢复相同的 `thread_id`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task

# Used only to simulate a transient failure. Do not use a global like this in production.
attempts = 0
called: list[str] = []


@task()
def get_info():
    global attempts
    called.append("get_info")
    attempts += 1

    if attempts < 2:
        raise ValueError("Failure")
    return "OK"


checkpointer = InMemorySaver()


@task
def slow_task():
    called.append("slow_task")
    time.sleep(1)
    return "Ran slow task."


@entrypoint(checkpointer=checkpointer)
def main(inputs):
    called.append("entrypoint")
    slow_task_result = slow_task().result()
    get_info().result()  # raises ValueError on the first run
    return slow_task_result


config = {"configurable": {"thread_id": "1"}}

try:
    main.invoke({"any_input": "foobar"}, config=config)
except ValueError:
    pass

assert called == ["entrypoint", "slow_task", "get_info"]
called.clear()

print(main.invoke(None, config=config))
# 'Ran slow task.'
assert called == ["entrypoint", "get_info"]
print(called)
# ['entrypoint', 'get_info']
```

再次传递原始输入会启动新的调用，而不是恢复失败的调用。参见[Choose how to continue a thread](/oss/python/langgraph/checkpointers#choose-how-to-continue-a-thread)。

恢复恢复已完成的任务结果；它不会有选择地重新运行已完成的任务。功能 API 任务结果共享入口点检查点，而不是在每个任务之前创建完整的检查点。要重播特定图形步骤，请使用图形 API 的 [time travel](/oss/python/langgraph/use-time-travel)。

## 另请参阅* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Fault tolerance](/oss/python/langgraph/fault-tolerance)
* [Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)
* [Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-tasks.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。