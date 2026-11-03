<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Add memory with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-memory -->

# 使用功能 API 添加内存

在功能 API 工作流程中使用短期检查点和长期存储内存。

使用 [checkpointer](/oss/javascript/langgraph/persistence) 和可选的 [store](/oss/javascript/langgraph/stores) 将内存添加到功能 API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint)。检查点在同一 `thread_id` 的调用中保持状态。存储跨线程 ID 保存事实。

有关概念，请参阅[Functional API overview](/oss/javascript/langgraph/functional-api)。有关 Graph API 内存配方，请参阅[Memory](/oss/javascript/langgraph/add-memory)。

## 保存线程状态

创建入口点时传递检查点。用 `thread_id` 标识每次运行。

在入口点内调用`getPreviousState`。第一次运行时是`undefined`。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, getPreviousState, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const accumulate = entrypoint(
  { checkpointer, name: "accumulate" },
  async (n: number) => {
    const previous = getPreviousState<number>() ?? 0;
    return previous + n;
  }
);

const config = { configurable: { thread_id: "1" } };
console.log(await accumulate.invoke(1, config)); // 1
console.log(await accumulate.invoke(2, config)); // 3
console.log(await accumulate.invoke(3, config)); // 6
```

## 返回不同的保存值

当调用者应该接收一个值并且下一次运行应该读取另一个值时，请使用[⟦T19⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint/final)。 `value` 返回给调用者。

`save` 是下一个`getPreviousState` 所看到的。

例如，返回状态或摘要，并保存完整的内部状态。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, getPreviousState, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const accumulate = entrypoint(
  { checkpointer, name: "accumulate" },
  async (n: number) => {
    const previous = getPreviousState<number>() ?? 0;
    const total = previous + n;
    // Return the *previous* value to the caller but save the *new* total.
    return entrypoint.final({ value: previous, save: total });
  }
);

const config = { configurable: { thread_id: "my-thread" } };

console.log(await accumulate.invoke(1, config)); // 0
console.log(await accumulate.invoke(2, config)); // 1
console.log(await accumulate.invoke(3, config)); // 3
```

## 检查检查点

从 [Return a different saved value](#return-a-different-saved-value) 查看或删除`accumulate` 工作流程上的检查点。 `values`是保存的检查点（`save`），而不是返回给调用者的值。

### 查看线程状态

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
console.log(await accumulate.getState({
  configurable: {
    thread_id: "my-thread",  // [!code highlight]
    // optionally provide an ID for a specific checkpoint,
    // otherwise the latest checkpoint is shown
    // checkpoint_id: "1f1c1826-2179-626c-8004-96dc43069e17" [!code highlight]
  },
}));  // [!code highlight]
```

```
StateSnapshot {
  values: 3,
  next: [],
  config: { configurable: { thread_id: 'my-thread', checkpoint_ns: '', checkpoint_id: '1f1c1826-2179-626c-8004-96dc43069e17' } },
  metadata: { source: 'loop', step: 4, parents: {} },
  createdAt: '2026-10-06T12:35:16.081724+00:00',
  parentConfig: { configurable: { thread_id: 'my-thread', checkpoint_ns: '', checkpoint_id: '1f1c1826-2178-6682-8003-feda9f2ec8db' } },
  tasks: [],
  interrupts: []
}
```

### 查看线程历史记录

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const history = [];  // [!code highlight]
for await (const state of accumulate.getStateHistory({
  configurable: {
    thread_id: "my-thread",  // [!code highlight]
  },
})) {
  history.push(state);
}
console.log(history[0]);
```

```
StateSnapshot {
  values: 3,
  next: [],
  config: { configurable: { thread_id: 'my-thread', checkpoint_ns: '', checkpoint_id: '1f1c1826-2179-626c-8004-96dc43069e17' } },
  metadata: { source: 'loop', step: 4, parents: {} },
  createdAt: '2026-10-06T12:35:16.081724+00:00',
  parentConfig: { configurable: { thread_id: 'my-thread', checkpoint_ns: '', checkpoint_id: '1f1c1826-2178-6682-8003-feda9f2ec8db' } },
  tasks: [],
  interrupts: []
}
// ... earlier snapshots, including values 1, 0, and null
```

### 删除线程的检查点

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await checkpointer.deleteThread("my-thread");
console.log(await accumulate.getState(config));
// StateSnapshot { values: {}, next: [], config: { configurable: { thread_id: 'my-thread' } }, ... }
```

## 构建一个带有检查点的聊天机器人让对话继续进行。将模型消息返回给调用者，并使用`entrypoint.final`保存下一轮的完整列表。

```ts Google theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "google-genai:gemini-3.6-flash" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts OpenAI theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "openai:gpt-5.5" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts Anthropic theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "anthropic:claude-sonnet-4-6" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts OpenRouter theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "openrouter:openrouter:z-ai/glm-5.2" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts Fireworks theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "fireworks:accounts/fireworks/models/glm-5p2" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts Baseten theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "baseten:zai-org/GLM-5.2" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

```ts Ollama theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  addMessages,
  entrypoint,
  getPreviousState,
  task,
  MemorySaver,
} from "@langchain/langgraph";

let model = new ChatAnthropic({ model: "ollama:north-mini-code-1.0" });

const callModel = task(
  "callModel",
  async (messages: BaseMessage[]): Promise<BaseMessage> => {
    const response = await model.invoke(messages);
    return response;
  }
);

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: BaseMessage[]): Promise<BaseMessage> => {
    const previous = getPreviousState<BaseMessage[]>();
    let messages = inputs;
    if (previous) {
      messages = addMessages(previous, inputs);
    }

    const response = await callModel(messages);
    return entrypoint.final({
      value: response,
      save: addMessages(messages, response),
    });
  }
);

const config = { configurable: { thread_id: "1" } };
const inputMessage = { role: "user", content: "hi! I'm bob" };
console.log(await workflow.invoke([inputMessage], config));
// -> AIMessage with a greeting that uses the name Bob

const inputMessage2 = { role: "user", content: "what's my name?" };
console.log(await workflow.invoke([inputMessage2], config));
// -> AIMessage that answers "Bob"
```

## 跨线程保存事实

[Long-term memory](/oss/javascript/concepts/memory#long-term-memory) 存在于 [store](/oss/javascript/langgraph/stores) 中，而不是检查指针中。在一个 `thread_id` 上保存事实并在另一个 `thread_id` 上阅读。

创建入口点时传递 `InMemoryStore`。用`config.store`读写。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  MemorySaver,
  InMemoryStore,
  entrypoint,
} from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const checkpointer = new MemorySaver();
const store = new InMemoryStore();

const remember = entrypoint(
  { checkpointer, store, name: "remember" },
  async (
    inputs: { user_id: string; fact?: string },
    config: LangGraphRunnableConfig
  ) => {
    const namespace = [inputs.user_id, "memories"];
    if (inputs.fact) {
      await config.store!.put(namespace, "profile", { fact: inputs.fact });
    }
    const items = (await config.store!.search(namespace)) ?? [];
    return items.map((item) => item.value);
  }
);

const configA = { configurable: { thread_id: "thread-a" } };
const configB = { configurable: { thread_id: "thread-b" } };

await remember.invoke(
  { user_id: "user-1", fact: "Prefers dark mode" },
  configA
);
console.log(await remember.invoke({ user_id: "user-1" }, configB));
// -> [{ fact: 'Prefers dark mode' }]
```

## 另请参阅

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Memory](/oss/javascript/langgraph/add-memory)
* [Persistence](/oss/javascript/langgraph/persistence)
* [Stores](/oss/javascript/langgraph/stores)
* [Add human-in-the-loop with the Functional API](/oss/javascript/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-memory.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。