<!-- langgraph-docs: Stream with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-streaming -->

# Stream with the Functional API

Emit custom progress from Functional API entrypoints, or read state snapshots from the values stream.

Stream from a Functional API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) in two ways. Custom data is a side channel: you push progress with a writer, then read `custom` chunks. Values are state snapshots the runtime records, including the entrypoint return value. You do not call a writer for values.

For concepts, see the [Functional API overview](/oss/javascript/langgraph/functional-api). For messages and other typed projections, see [event streaming](/oss/javascript/langgraph/event-streaming).

## Emit custom data

The Functional API uses the same stream as the [Graph API](/oss/javascript/langgraph/graph-api). Emit with a writer, then consume `custom` chunks. For stream modes, see [Streaming](/oss/javascript/langgraph/streaming).

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, MemorySaver } from "@langchain/langgraph";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const main = entrypoint(
  { checkpointer, name: "main" },
  async (
    inputs: { x: number },
    config: LangGraphRunnableConfig,
  ): Promise<number> => {
    config.writer?.("Started processing");
    const result = inputs.x * 2;
    config.writer?.(`Result is ${result}`);
    return result;
  },
);

const config = {
  configurable: { thread_id: "functional-api-stream-custom-data" },
};

const stream = await main.stream(
  { x: 5 },
  { ...config, streamMode: "custom" },
);
for await (const chunk of stream) {
  console.log(chunk);
}
// Started processing
// Result is 10
```

> [card] [View example trace](https://smith.langchain.com/public/a43b8f1e-e11c-48d9-be99-23e2473c0ef4/r)
>
> Open a public LangSmith run for this example.

1. Take `config` as the second argument to the entrypoint.
2. Emit custom data with `config.writer` before and after the computation.
3. Call `stream(..., { streamMode: "custom" })` and iterate the chunks.

## Stream values

Reuse the `main` entrypoint from [Emit custom data](#emit-custom-data). Iterate `stream.values` for state snapshots. For messages and other projections, see [event streaming](/oss/javascript/langgraph/event-streaming).

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const valuesStream = await main.streamEvents(
  { x: 5 },
  {
    configurable: { thread_id: "functional-api-stream-values" },
    version: "v3",
  },
);
for await (const snapshot of valuesStream.values) {
  console.log(snapshot);
}
// 10
```

## See also

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Event streaming](/oss/javascript/langgraph/event-streaming)
* [Streaming](/oss/javascript/langgraph/streaming)
* [Add human-in-the-loop with the Functional API](/oss/javascript/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-streaming.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).