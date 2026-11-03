<!-- langgraph-docs: Add memory with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-memory -->

# Add memory with the Functional API

Use short-term checkpoints and long-term store memory in Functional API workflows.

Add memory to a Functional API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) with a [checkpointer](/oss/javascript/langgraph/persistence) and, optionally, a [store](/oss/javascript/langgraph/stores). Checkpoints persist state across invocations of the same `thread_id`. A store persists facts across thread IDs.

For concepts, see the [Functional API overview](/oss/javascript/langgraph/functional-api). For Graph API memory recipes, see [Memory](/oss/javascript/langgraph/add-memory).

## Save state on a thread

Pass a checkpointer when you create the entrypoint. Identify each run with `thread_id`.

Call `getPreviousState` inside the entrypoint. On the first run it is `undefined`.

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

## Return a different saved value

Use [`entrypoint.final`](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint/final) when the caller should receive one value and the next run should read another. `value` is returned to the caller.

`save` is what the next `getPreviousState` read sees.

For example, return a status or summary, and save the full internal state.

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

## Inspect checkpoints

View or delete checkpoints on the `accumulate` workflow from [Return a different saved value](#return-a-different-saved-value). `values` is the saved checkpoint (`save`), not the value returned to the caller.

### View thread state

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

### View thread history

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

### Delete checkpoints for a thread

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await checkpointer.deleteThread("my-thread");
console.log(await accumulate.getState(config));
// StateSnapshot { values: {}, next: [], config: { configurable: { thread_id: 'my-thread' } }, ... }
```

## Build a chatbot with checkpoints

Keep the conversation on the thread. Return the model message to the caller, and save the full list for the next turn with `entrypoint.final`.

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

## Save facts across threads

[Long-term memory](/oss/javascript/concepts/memory#long-term-memory) lives in a [store](/oss/javascript/langgraph/stores), not in the checkpointer. Save a fact on one `thread_id` and read it on another.

Pass an `InMemoryStore` when you create the entrypoint. Read and write it with `config.store`.

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

## See also

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Memory](/oss/javascript/langgraph/add-memory)
* [Persistence](/oss/javascript/langgraph/persistence)
* [Stores](/oss/javascript/langgraph/stores)
* [Add human-in-the-loop with the Functional API](/oss/javascript/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-memory.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).