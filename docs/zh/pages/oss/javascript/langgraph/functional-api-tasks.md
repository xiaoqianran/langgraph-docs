<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Configure Functional API tasks | https://docs.langchain.com/oss/javascript/langgraph/functional-api-tasks -->

# 配置功能API任务

向功能 API 任务和入口点添加重试、超时、缓存和错误恢复。

[task](/oss/javascript/langgraph/functional-api#task) 是一个离散的工作单元，其结果可以单独为 [checkpointed](/oss/javascript/langgraph/persistence)。当 [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) 或 [Graph API node](/oss/javascript/langgraph/graph-api#using-tasks-in-nodes) 运行多个操作时，请将每个操作包装在一个任务中，而不是将所有工作放在一个函数体中。使用检查指针，可以保存已完成的任务结果，因此恢复的线程可以跳过已完成的工作并继续下一个任务。

本页介绍任务的重试、超时、缓存和错误恢复。有关概念，请参阅[Functional API overview](/oss/javascript/langgraph/functional-api)。对于有序的构建路径，请参阅 [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)。共享重试和超时生命周期请参见[Fault tolerance](/oss/javascript/langgraph/fault-tolerance)。

## 添加重试策略

在 `task` 上传递 `retry`（不是 `retryPolicy`）。重试是可选的。如果策略忽略 `retryOn`，LangGraph 会重试大多数抛出的错误，除了中止/取消、`GraphValueError`、中止的连接、选定的 HTTP 4xx 状态和 OpenAI 样式配额错误。此示例重试任何 `Error`。有关完整的默认列表，请参阅[Fault tolerance](/oss/javascript/langgraph/fault-tolerance#retries)。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task } from "@langchain/langgraph";
import type { RetryPolicy } from "@langchain/langgraph";

// Used only to simulate a transient failure. Do not use a variable like this in production.
let attempts = 0;

const retryPolicy: RetryPolicy = {
  retryOn: (error) => error instanceof Error,
};

const getInfo = task({ name: "getInfo", retry: retryPolicy }, () => {
  attempts += 1;

  if (attempts < 2) {
    throw new Error("Failure");
  }
  return "OK";
});

const main = entrypoint({ name: "main" }, async (inputs: Record<string, unknown>) => {
  return await getInfo();
});

console.log(await main.invoke({ any_input: "foobar" }));
// 'OK'
```

## 设置超时时间

限制单个异步尝试可以运行的时间。如果重试策略重试超时错误，计时器将在下次尝试时重置。以毫秒为单位在 `task` 或 `entrypoint` 上传递 `timeout`，或作为 `{ idleTimeout: 30_000 }`。使用`isNodeTimeoutError`缩小超时错误。当设置重试策略时，`NodeTimeoutError`是可重试的。

第一次尝试会在超时后休眠。重试策略重试。第二次尝试立即返回。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task } from "@langchain/langgraph";

let attempts = 0;

const callApi = task(
  {
    name: "callApi",
    timeout: 1_000,
    retry: { maxAttempts: 3 },
  },
  async (url: string) => {
    attempts += 1;
    if (attempts < 2) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    return `result from ${url}`;
  }
);

const workflow = entrypoint(
  { name: "workflow", timeout: 5_000 },
  async (inputs: { url: string }) => {
    return await callApi(inputs.url);
  }
);

console.log(await workflow.invoke({ url: "https://example.com" }));
// 'result from https://example.com'
```

## 缓存一个任务

通过输入缓存任务结果。传递 [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) 上的缓存和任务上的策略。 `ttl` 以秒为单位。第二次调用是缓存命中，因此这次运行大约需要 1 秒，而不是 2 秒。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task } from "@langchain/langgraph";
import { InMemoryCache } from "@langchain/langgraph-checkpoint";

const slowAdd = task(
  {
    name: "slowAdd",
    cache: { ttl: 120 },  // [!code highlight]
  },
  async (x: number) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return x * 2;
  }
);

const main = entrypoint(
  { cache: new InMemoryCache(), name: "main" },
  async (inputs: { x: number }) => {
    const result1 = await slowAdd(inputs.x);
    const result2 = await slowAdd(inputs.x);
    return { result1, result2 };
  }
);

console.log(await main.invoke({ x: 5 }));
// { result1: 10, result2: 10 }
```

## 错误后恢复

需要[checkpointer](/oss/javascript/langgraph/persistence)，以便已完成的任务结果在失败的运行中得以保留。

恢复从入口点的开头开始。 LangGraph从检查点恢复已完成的`slow_task`结果，因此其函数体不会再次运行。失败的`get_info`任务再次运行并返回`"OK"`。下面的执行日志区分了入口点重新进入和任务重新执行。

与 `null` 恢复相同的 `thread_id`。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

// Used only to simulate a transient failure. Do not use a variable like this in production.
let attempts = 0;
const called: string[] = [];

const getInfo = task("getInfo", async () => {
  called.push("getInfo");
  attempts += 1;

  if (attempts < 2) {
    throw new Error("Failure");
  }
  return "OK";
});

const checkpointer = new MemorySaver();

const slowTask = task("slowTask", async () => {
  called.push("slowTask");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return "Ran slow task.";
});

const main = entrypoint(
  { checkpointer, name: "main" },
  async (inputs: Record<string, unknown>) => {
    called.push("entrypoint");
    const slowTaskResult = await slowTask();
    await getInfo(); // throws on the first run
    return slowTaskResult;
  }
);

const config = {
  configurable: {
    thread_id: "1",
  },
};

try {
  await main.invoke({ any_input: "foobar" }, config);
} catch (err) {
  // First run fails in getInfo.
}

called.length = 0;
console.log(await main.invoke(null, config));
// 'Ran slow task.'
console.log(called);
// ['entrypoint', 'getInfo']
```

再次传递原始输入会启动新的调用，而不是恢复失败的调用。参见[Choose how to continue a thread](/oss/javascript/langgraph/checkpointers#choose-how-to-continue-a-thread)。恢复恢复已完成的任务结果；它不会有选择地重新运行已完成的任务。功能 API 任务结果共享入口点检查点，而不是在每个任务之前创建完整的检查点。要重播特定图形步骤，请使用图形 API 的 [time travel](/oss/javascript/langgraph/use-time-travel)。

## 另请参阅

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
* [Stream with the Functional API](/oss/javascript/langgraph/functional-api-streaming)
* [Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-tasks.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。