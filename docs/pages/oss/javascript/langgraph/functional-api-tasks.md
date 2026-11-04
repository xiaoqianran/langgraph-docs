<!-- langgraph-docs: Configure Functional API tasks | https://docs.langchain.com/oss/javascript/langgraph/functional-api-tasks -->

# Configure Functional API tasks

Add retries, timeouts, caching, and error recovery to Functional API tasks and entrypoints.

A [task](/oss/javascript/langgraph/functional-api#task) is a discrete unit of work whose result can be [checkpointed](/oss/javascript/langgraph/persistence) on its own. When an [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) or a [Graph API node](/oss/javascript/langgraph/graph-api#using-tasks-in-nodes) runs several operations, wrap each operation in a task instead of putting all the work in one function body. With a checkpointer, completed task results are saved, so a resumed thread can skip finished work and continue from the next task.

This page covers retries, timeouts, caching, and error recovery on tasks. For concepts, see the [Functional API overview](/oss/javascript/langgraph/functional-api). For an ordered build path, see the [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api). For the shared retry and timeout lifecycle, see [Fault tolerance](/oss/javascript/langgraph/fault-tolerance).

## Add a retry policy

Pass `retry` on `task` (not `retryPolicy`). Retries are opt-in. If the policy omits `retryOn`, LangGraph retries most thrown errors except abort/cancel, `GraphValueError`, aborted connections, selected HTTP 4xx statuses, and OpenAI-style quota errors. This example retries any `Error`. See [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#retries) for the full default list.

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

## Set a timeout

Cap how long a single async attempt can run. If a retry policy retries the timeout error, the timer resets on the next attempt.

Pass `timeout` on `task` or `entrypoint` in milliseconds, or as `{ idleTimeout: 30_000 }`. Use `isNodeTimeoutError` to narrow timeout errors. `NodeTimeoutError` is retryable when a retry policy is set.

The first attempt sleeps past the timeout. The retry policy retries. The second attempt returns immediately.

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

## Cache a task

Cache a task result by input. Pass a cache on the [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) and a policy on the task. `ttl` is in seconds. The second call is a cache hit, so this run takes about 1 second, not 2.

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

## Resume after an error

A [checkpointer](/oss/javascript/langgraph/persistence) is required so completed task results survive the failed run.

Resume starts at the beginning of the entrypoint. LangGraph restores the completed `slow_task` result from the checkpoint, so its function body does not run again. The failed `get_info` task runs again and returns `"OK"`. The execution log below distinguishes entrypoint re-entry from task re-execution.

Resume the same `thread_id` with `null`.

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

Passing the original input again starts a new invocation instead of recovering the failed one. See [Choose how to continue a thread](/oss/javascript/langgraph/checkpointers#choose-how-to-continue-a-thread).

Recovery restores completed task results; it does not selectively re-run a completed task. Functional API task results share the entrypoint checkpoint, rather than creating a full checkpoint before each task. For replay from a specific graph step, use the Graph API's [time travel](/oss/javascript/langgraph/use-time-travel).

## See also

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
* [Stream with the Functional API](/oss/javascript/langgraph/functional-api-streaming)
* [Add memory with the Functional API](/oss/javascript/langgraph/functional-api-memory)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-tasks.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).