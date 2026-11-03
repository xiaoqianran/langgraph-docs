<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Stream with the Functional API | https://docs.langchain.com/oss/javascript/langgraph/functional-api-streaming -->

# 使用函数式 API 进行流式传输

从功能 API 入口点发出自定义进度，或从值流读取状态快照。

通过两种方式从功能 API [entrypoint](/oss/javascript/langgraph/functional-api#entrypoint) 进行流式传输。自定义数据是一个侧通道：您使用写入器推送进度，然后读取 `custom` 块。值是运行时记录的状态快照，包括入口点返回值。你不会打电话给作家来询问价值观。

有关概念，请参阅[Functional API overview](/oss/javascript/langgraph/functional-api)。对于消息和其他类型的投影，请参阅[event streaming](/oss/javascript/langgraph/event-streaming)。

## 发出自定义数据

功能 API 使用与 [Graph API](/oss/javascript/langgraph/graph-api) 相同的流。使用 writer 发出，然后消耗 `custom` 块。对于流模式，请参阅[Streaming](/oss/javascript/langgraph/streaming)。

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

> [卡][View example trace](https://smith.langchain.com/public/a43b8f1e-e11c-48d9-be99-23e2473c0ef4/r)
>
> 为此示例打开公共 LangSmith 运行。

1. 将 `config` 作为入口点的第二个参数。
2. 在计算前后使用`config.writer`发出自定义数据。
3. 调用`stream(..., { streamMode: "custom" })`并迭代块。

## 流值

重用 [Emit custom data](#emit-custom-data) 中的 `main` 入口点。迭代 `stream.values` 以获得状态快照。有关消息和其他预测，请参阅[event streaming](/oss/javascript/langgraph/event-streaming)。

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

## 另请参阅

* [Functional API overview](/oss/javascript/langgraph/functional-api)
* [Build checklist for the Functional API](/oss/javascript/langgraph/use-functional-api)
* [Event streaming](/oss/javascript/langgraph/event-streaming)
* [Streaming](/oss/javascript/langgraph/streaming)
* [Add human-in-the-loop with the Functional API](/oss/javascript/langgraph/functional-api-human-in-the-loop)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/functional-api-streaming.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。