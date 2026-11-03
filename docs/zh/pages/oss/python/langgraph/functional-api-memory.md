<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Add memory with the Functional API | https://docs.langchain.com/oss/python/langgraph/functional-api-memory -->

# 使用功能 API 添加内存

在功能 API 工作流程中使用短期检查点和长期存储内存。

使用 [checkpointer](/oss/python/langgraph/persistence) 和可选的 [store](/oss/python/langgraph/stores) 将内存添加到功能 API [entrypoint](/oss/python/langgraph/functional-api#entrypoint)。检查点在同一 `thread_id` 的调用中保持状态。存储跨线程 ID 保存事实。

有关概念，请参阅[Functional API overview](/oss/python/langgraph/functional-api)。有关 Graph API 内存配方，请参阅[Memory](/oss/python/langgraph/add-memory)。

## 保存线程状态

创建入口点时传递检查点。用 `thread_id` 标识每次运行。

添加仅关键字 `previous` 参数。 LangGraph 将其设置为该线程上保存的最后一个值。第一次运行时是`None`。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def accumulate(n: int, *, previous: int | None = None) -> int:
    previous = previous or 0
    return previous + n


config = {"configurable": {"thread_id": "1"}}
print(accumulate.invoke(1, config))  # 1
print(accumulate.invoke(2, config))  # 3
print(accumulate.invoke(3, config))  # 6
```

## 返回不同的保存值

当调用者应该接收一个值并且下一次运行应该读取另一个值时，请使用[⟦T19⟧](https://reference.langchain.com/python/langgraph/func/entrypoint/final)。 `value` 返回给调用者。

`save` 是下一个`previous` 所看到的。

例如，返回状态或摘要，并保存完整的内部状态。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint

checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def accumulate(n: int, *, previous: int | None = None) -> entrypoint.final[int, int]:
    previous = previous or 0
    total = previous + n
    # Return the *previous* value to the caller but save the *new* total.
    return entrypoint.final(value=previous, save=total)


config = {"configurable": {"thread_id": "my-thread"}}

print(accumulate.invoke(1, config=config))  # 0
print(accumulate.invoke(2, config=config))  # 1
print(accumulate.invoke(3, config=config))  # 3
```

## 检查检查点

从 [Return a different saved value](#return-a-different-saved-value) 查看或删除`accumulate` 工作流程上的检查点。 `values`是保存的检查点（`save`），而不是返回给调用者的值。

### 查看线程状态

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
config = {
    "configurable": {
        "thread_id": "my-thread",  # [!code highlight]
        # optionally provide an ID for a specific checkpoint,
        # otherwise the latest checkpoint is shown
        # "checkpoint_id": "1f1c1826-2179-626c-8004-96dc43069e17"  # [!code highlight]
    }
}
print(accumulate.get_state(config))  # [!code highlight]
```

```
StateSnapshot(
    values=3,
    next=(),
    config={'configurable': {'thread_id': 'my-thread', 'checkpoint_ns': '', 'checkpoint_id': '1f1c1826-2179-626c-8004-96dc43069e17'}},
    metadata={'source': 'loop', 'step': 4, 'parents': {}},
    created_at='2026-10-06T12:35:16.081724+00:00',
    parent_config={'configurable': {'thread_id': 'my-thread', 'checkpoint_ns': '', 'checkpoint_id': '1f1c1826-2178-6682-8003-feda9f2ec8db'}},
    tasks=(),
    interrupts=()
)
```

### 查看线程历史记录

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
config = {"configurable": {"thread_id": "my-thread"}}  # [!code highlight]
history = list(accumulate.get_state_history(config))  # [!code highlight]
print(history[0])
```

```
StateSnapshot(
    values=3,
    next=(),
    config={'configurable': {'thread_id': 'my-thread', 'checkpoint_ns': '', 'checkpoint_id': '1f1c1826-2179-626c-8004-96dc43069e17'}},
    metadata={'source': 'loop', 'step': 4, 'parents': {}},
    created_at='2026-10-06T12:35:16.081724+00:00',
    parent_config={'configurable': {'thread_id': 'my-thread', 'checkpoint_ns': '', 'checkpoint_id': '1f1c1826-2178-6682-8003-feda9f2ec8db'}},
    tasks=(),
    interrupts=()
)
# ... earlier snapshots, including values=1, values=0, and values=None
```

### 删除线程的检查点

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
checkpointer.delete_thread("my-thread")
print(accumulate.get_state(config))
# StateSnapshot(values={}, next=(), config={'configurable': {'thread_id': 'my-thread'}}, ...)
```## 构建一个带有检查点的聊天机器人

让对话继续进行。将模型消息返回给调用者，并使用`entrypoint.final`保存下一轮的完整列表。

```python Google theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="google_genai:gemini-3.6-flash")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python OpenAI theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="openai:gpt-5.5")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python Anthropic theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="anthropic:claude-sonnet-4-6")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python OpenRouter theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="openrouter:z-ai/glm-5.2")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python Fireworks theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="fireworks:accounts/fireworks/models/glm-5p2")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python Baseten theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="baseten:zai-org/GLM-5.2")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

```python Ollama theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.messages import BaseMessage
from langchain_anthropic import ChatAnthropic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task
from langgraph.graph import add_messages

model = ChatAnthropic(model="ollama:north-mini-code-1.0")


@task
def call_model(messages: list[BaseMessage]):
    response = model.invoke(messages)
    return response


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def workflow(inputs: list[BaseMessage], *, previous: list[BaseMessage] | None = None):
    if previous:
        inputs = add_messages(previous, inputs)

    response = call_model(inputs).result()
    return entrypoint.final(value=response, save=add_messages(inputs, response))


config = {"configurable": {"thread_id": "1"}}
input_message = {"role": "user", "content": "hi! I'm bob"}
print(workflow.invoke([input_message], config))
# -> AIMessage with a greeting that uses the name Bob

input_message = {"role": "user", "content": "what's my name?"}
print(workflow.invoke([input_message], config))
# -> AIMessage that answers "Bob"
```

## 跨线程保存事实

[Long-term memory](/oss/python/concepts/memory#long-term-memory) 存在于 [store](/oss/python/langgraph/stores) 中，而不是检查指针中。在一个 `thread_id` 上保存事实并在另一个 `thread_id` 上阅读。

当你装饰入口点时传递一个[⟦T28⟧](https://reference.langchain.com/python/langchain-core/stores/InMemoryStore)。从`runtime.store`阅读。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint
from langgraph.runtime import Runtime
from langgraph.store.memory import InMemoryStore

checkpointer = InMemorySaver()
store = InMemoryStore()


@entrypoint(checkpointer=checkpointer, store=store)
def remember(inputs: dict, *, runtime: Runtime):
    memory_store = runtime.store
    namespace = (inputs["user_id"], "memories")
    fact = inputs.get("fact")
    if fact:
        memory_store.put(namespace, "profile", {"fact": fact})
    items = memory_store.search(namespace)
    return [item.value for item in items]


config_a = {"configurable": {"thread_id": "thread-a"}}
config_b = {"configurable": {"thread_id": "thread-b"}}

remember.invoke(
    {"user_id": "user-1", "fact": "Prefers dark mode"},
    config_a,
)
print(remember.invoke({"user_id": "user-1"}, config_b))
# -> [{'fact': 'Prefers dark mode'}]
```

## 另请参阅

* [Functional API overview](/oss/python/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)
* [Memory](/oss/python/langgraph/add-memory)
* [Persistence](/oss/python/langgraph/persistence)
* [Stores](/oss/python/langgraph/stores)
* [Add human-in-the-loop with the Functional API](/oss/python/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-memory.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。