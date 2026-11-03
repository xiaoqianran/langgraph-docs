<!-- langgraph-docs: Compose Functional API workflows | https://docs.langchain.com/oss/javascript/langgraph/functional-api-workflows -->

# Compose Functional API workflows

Build entrypoints and tasks, run work in parallel, and call graphs or other entrypoints.

Use these recipes to compose Functional API workflows from [entrypoint](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint) and [task](https://reference.langchain.com/javascript/langchain-langgraph/index/task) building blocks.

For concepts, see the [Functional API overview](/oss/javascript/langgraph/functional-api). For an ordered build path, see the [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api).

The examples use an in-memory [checkpointer](/oss/javascript/langgraph/persistence) so results persist on a thread.

## Create a simple workflow

This is the even/odd flow from [Choosing between Graph and Functional APIs](/oss/javascript/langgraph/choosing-apis). This version adds a checkpointer so the run has a thread.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task, MemorySaver } from "@langchain/langgraph";

const isEven = task("isEven", async (number: number) => {
  return number % 2 === 0;
});

const formatMessage = task("formatMessage", async (isEven: boolean) => {
  return isEven ? "The number is even." : "The number is odd.";
});

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (inputs: { number: number }) => {
    const even = await isEven(inputs.number);
    return await formatMessage(even);
  }
);

const config = { configurable: { thread_id: crypto.randomUUID() } };
const result = await workflow.invoke({ number: 7 }, config);
console.log(result);
```

An entrypoint takes one positional argument as input. To pass multiple fields, use a dictionary:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const myWorkflow = entrypoint(
  { checkpointer, name: "myWorkflow" },
  async (inputs: { value: number; anotherValue: number }) => {
    const value = inputs.value;
    const anotherValue = inputs.anotherValue;
    return { sum: value + anotherValue };
  }
);

await myWorkflow.invoke(
  { value: 1, anotherValue: 2 },
  { configurable: { thread_id: "1" } }
);
```

## Run tasks in parallel

A task starts as soon as you call it and returns a `Promise`. Collect those promises first, then wait with `Promise.all` so the work overlaps.

This pattern helps I/O-bound work, for example LLM API calls.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver, task } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const addOne = task("addOne", async (number: number) => {
  return number + 1;
});

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (numbers: number[]) => {
    return await Promise.all(numbers.map(addOne));
  }
);
```

> [accordion] Extended example: parallel LLM calls
>
> Each task generates a paragraph on a different topic. Results join into one string.
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatAnthropic } from "@langchain/anthropic";
> import { entrypoint, task, MemorySaver } from "@langchain/langgraph";
>
> let model = new ChatAnthropic({ model: "claude-sonnet-4-6" });
>
> const generateParagraph = task("generateParagraph", async (topic: string) => {
>   const response = await model.invoke([
>     { role: "system", content: "You are a helpful assistant that writes educational paragraphs." },
>     { role: "user", content: `Write a paragraph about ${topic}.` }
>   ]);
>   return response.text;
> });
>
> const checkpointer = new MemorySaver();
>
> const workflow = entrypoint(
>   { checkpointer, name: "workflow" },
>   async (topics: string[]) => {
>     const paragraphs = await Promise.all(topics.map(generateParagraph));
>     return paragraphs.join("\n\n");
>   }
> );
>
> const config = { configurable: { thread_id: crypto.randomUUID() } };
> const result = await workflow.invoke(["quantum computing", "climate change", "history of aviation"], config);
> console.log(result);
> ```

## Call a graph

The Functional API and the [Graph API](/oss/javascript/langgraph/graph-api) share the same runtime. A compiled graph is another callable: invoke it from an entrypoint like any other function.

A nested graph does not share the outer thread unless you pass `config` into `invoke`. Request the injected `config` on the entrypoint and forward it.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.number(),
});

const builder = new StateGraph(State)
  .addNode("double", (state) => {
    return { foo: state.foo * 2 };
  })
  .addEdge(START, "double");
const graph = builder.compile();

const checkpointer = new MemorySaver();

const workflow = entrypoint(
  { checkpointer, name: "workflow" },
  async (x: number, config) => {
    const result = await graph.invoke({ foo: x }, config);
    return { bar: result.foo };
  }
);

const config = { configurable: { thread_id: crypto.randomUUID() } };
console.log(await workflow.invoke(5, config)); // { bar: 10 }
```

## Call other entrypoints

You can call other entrypoints from within an entrypoint or a task.

When the child is defined without a checkpointer, invoking it from a parent that has one uses the parent's checkpointer. Invoking the child on its own does not persist unless you pass a checkpointer.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

// Inherits the checkpointer when invoked from myWorkflow
const someOtherWorkflow = entrypoint(
  { name: "someOtherWorkflow" },
  async (inputs: { value: number }) => {
    return inputs.value;
  }
);

const myWorkflow = entrypoint(
  { checkpointer, name: "myWorkflow" },
  async (inputs: { value: number }) => {
    const value = await someOtherWorkflow.invoke({ value: 1 });
    return value;
  }
);
```

> [accordion] Extended example: calling another entrypoint
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { entrypoint, MemorySaver } from "@langchain/langgraph";
>
> const checkpointer = new MemorySaver();
>
> const multiply = entrypoint(
>   { name: "multiply" },
>   async (inputs: { a: number; b: number }) => {
>     return inputs.a * inputs.b;
>   }
> );
>
> const main = entrypoint(
>   { checkpointer, name: "main" },
>   async (inputs: { x: number; y: number }) => {
>     const result = await multiply.invoke({ a: inputs.x, b: inputs.y });
>     return { product: result };
>   }
> );
>
> const config = { configurable: { thread_id: crypto.randomUUID() } };
> console.log(await main.invoke({ x: 6, y: 7 }, config)); // { product: 42 }
> ```

## See also

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Workflows and agents](/oss/javascript/langgraph/workflows-agents)
* [Add LangGraph's features to other frameworks using the Functional API](/langsmith/deploy-other-frameworks)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-workflows.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).