<!-- langgraph-docs: Configure Functional API tasks | https://docs.langchain.com/oss/python/langgraph/functional-api-tasks -->

# Configure Functional API tasks

Add retries, timeouts, caching, and error recovery to Functional API tasks and entrypoints.

A [task](/oss/python/langgraph/functional-api#task) is a discrete unit of work whose result can be [checkpointed](/oss/python/langgraph/persistence) on its own. When an [entrypoint](/oss/python/langgraph/functional-api#entrypoint) or a [Graph API node](/oss/python/langgraph/graph-api#using-tasks-in-nodes) runs several operations, wrap each operation in a task instead of putting all the work in one function body. With a checkpointer, completed task results are saved, so a resumed thread can skip finished work and continue from the next task.

This page covers retries, timeouts, caching, and error recovery on tasks. For concepts, see the [Functional API overview](/oss/python/langgraph/functional-api). For an ordered build path, see the [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api). For the shared retry and timeout lifecycle, see [Fault tolerance](/oss/python/langgraph/fault-tolerance).

## Add a retry policy

Pass `retry_policy` on `@task`. The default `RetryPolicy` retries selected network and HTTP 5xx errors. It does not retry `ValueError`. This example retries `ValueError`.

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

## Set a timeout

Cap how long a single async attempt can run. If a retry policy retries the timeout error, the timer resets on the next attempt.

Pass `timeout` on `@task` or `@entrypoint` in seconds or as a `datetime.timedelta`. Timeouts apply only to async tasks and entrypoints. Setting `timeout` on a sync function raises an error at declaration.

The first attempt sleeps past the timeout and raises [`NodeTimeoutError`](https://reference.langchain.com/python/langgraph/errors/NodeTimeoutError), which subclasses `TimeoutError`. The retry policy retries that error. The second attempt returns immediately.

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

## Cache a task

Cache a task result by input. Pass a cache on the [entrypoint](/oss/python/langgraph/functional-api#entrypoint) and a policy on the task. `ttl` is in seconds. The second call is a cache hit, so this run takes about 1 second, not 2.

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

## Resume after an error

A [checkpointer](/oss/python/langgraph/persistence) is required so completed task results survive the failed run.

Resume starts at the beginning of the entrypoint. LangGraph restores the completed `slow_task` result from the checkpoint, so its function body does not run again. The failed `get_info` task runs again and returns `"OK"`. The execution log below distinguishes entrypoint re-entry from task re-execution.

Resume the same `thread_id` with `None`.

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

Passing the original input again starts a new invocation instead of recovering the failed one. See [Choose how to continue a thread](/oss/python/langgraph/checkpointers#choose-how-to-continue-a-thread).

Recovery restores completed task results; it does not selectively re-run a completed task. Functional API task results share the entrypoint checkpoint, rather than creating a full checkpoint before each task. For replay from a specific graph step, use the Graph API's [time travel](/oss/python/langgraph/use-time-travel).

## See also

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Fault tolerance](/oss/python/langgraph/fault-tolerance)
* [Stream with the Functional API](/oss/python/langgraph/functional-api-streaming)
* [Add memory with the Functional API](/oss/python/langgraph/functional-api-memory)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-tasks.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).