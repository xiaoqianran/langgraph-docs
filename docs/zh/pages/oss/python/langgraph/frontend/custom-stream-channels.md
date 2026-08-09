<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Custom stream channels | https://docs.langchain.com/oss/python/langgraph/frontend/custom-stream-channels -->

# 自定义流媒体频道

将自定义服务器端数据流式传输到前端并使用 useExtension 和 useChannel 读取它

LangGraph 代理传输的不仅仅是消息和工具调用。服务器端
**流转换器**可以在协议流向时检查或重写协议
客户端并在命名的**自定义通道**上发布自己的结构化数据。的
前端使用两个选择器读取该通道：[⟦T17⟧](https://reference.langchain.com/javascript/langchain-react/useExtension)代表最新的
有效载荷，以及 [⟦T18⟧](https://reference.langchain.com/javascript/langchain-react/useChannel) 作为原始事件逃生舱口。

下面的示例是一个客户支持代理，其变压器编辑了 PII
（电子邮件、电话号码、SSN、卡号、IP）之前的每个活动
到达浏览器，并发布正在运行的密文计数
`redaction-stats`频道。侧面板实时呈现这些计数。

<PatternEmbed />

## 自定义频道如何工作

自定义通道有两端。在服务器上，[⟦T20⟧](https://reference.langchain.com/python/langgraph/stream/_types/StreamTransformer)打开一个
命名为 [⟦T21⟧](https://reference.langchain.com/python/langgraph/stream/stream_channel/StreamChannel) 并向其推送有效负载。在客户端，有一个选择器
订阅匹配的 `custom:<name>` 通道并将有效负载公开为
反应状态。转换器的 `process` 方法针对每个协议事件运行。它可以变异
事件已到位（此处，从 `messages`、`tools` 和 `values` 中清除 PII
数据）并在有需要报告时推送侧通道更新。

客户端选择器（`useExtension`、`useChannel`）随 v1 一起提供
前端 SDK 包（`@langchain/react`、`@langchain/vue`、
`@langchain/svelte`、`@langchain/angular`）。

<Note>
  流转换器和`StreamChannel`需要`langgraph>=1.2`。
</Note>

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import time

from langgraph.stream import ProtocolEvent, StreamChannel, StreamTransformer


class RedactionStatsTransformer(StreamTransformer):
    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        super().__init__(scope)
        # Open a channel named "redaction-stats".
        self.redaction_stats = StreamChannel("redaction-stats")
        self.counts = empty_counts()

    def init(self) -> dict[str, StreamChannel]:
        return {"redactionStats": self.redaction_stats}

    def process(self, event: ProtocolEvent) -> bool:
        # Redact event["params"]["data"] in place and tally what was found.
        delta = redact_in_place(event, self.counts)
        if delta:
            # Publish a payload on the channel.
            self.redaction_stats.push(
                {
                    "kind": "update",
                    "at": int(time.time() * 1000),
                    "delta": delta,
                    "counts": dict(self.counts),
                    "total": sum(self.counts.values()),
                }
            )
        return True  # Keep the (now-redacted) event in the stream.


def create_redaction_stats_transformer() -> RedactionStatsTransformer:
    return RedactionStatsTransformer()
```

构建代理时附加变压器：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent

agent = create_agent(
    model="anthropic:claude-haiku-4-5",
    tools=[...],
    transformers=[create_redaction_stats_transformer],
)
```

有效负载类型是变压器推送的任何类型。下面的客户端示例
读这个形状：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
type PiiType = "email" | "phone" | "ssn" | "credit_card" | "ip_address";

type RedactionStatsEvent = {
  kind: "update";
  at: number;
  delta: Partial<Record<PiiType, number>>;
  counts: Record<PiiType, number>;
  total: number;
};
```

## 设置`useStream`

像往常一样连接[⟦T36⟧](https://reference.langchain.com/javascript/langchain-react/index/useStream)。自定义通道选择器采用相同的
`stream` 句柄在此处返回。

<Info>
  代码示例使用 `useStream<typeof myAgent>` 来实现类型安全的流状态。请参阅 [Python](/oss/python/langchain/frontend/overview#type-inference) 或 [JavaScript](/oss/javascript/langchain/frontend/overview#type-inference) 后端的类型推断。
</Info>

<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useStream } from "@langchain/react";

  const AGENT_URL = "http://localhost:2024";

  export function RedactionChat() {
    const stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "custom_stream_channel",
    });

    return <RedactionStatsPanel stream={stream} />;
  }
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script setup lang="ts">
  import { useStream } from "@langchain/vue";

  const AGENT_URL = "http://localhost:2024";

  const stream = useStream<typeof myAgent>({
    apiUrl: AGENT_URL,
    assistantId: "custom_stream_channel",
  });
  </script>

  <template>
    <RedactionStatsPanel :stream="stream" />
  </template>
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  <script lang="ts">
    import { useStream } from "@langchain/svelte";

    const AGENT_URL = "http://localhost:2024";

    const stream = useStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "custom_stream_channel",
    });
  </script>

  <RedactionStatsPanel {stream} />
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { Component } from "@angular/core";
  import { injectStream } from "@langchain/angular";

  const AGENT_URL = "http://localhost:2024";

  @Component({
    selector: "app-redaction-chat",
    template: `<app-redaction-stats-panel [stream]="stream" />`,
  })
  export class RedactionChatComponent {
    stream = injectStream<typeof myAgent>({
      apiUrl: AGENT_URL,
      assistantId: "custom_stream_channel",
    });
  }
  ```
</CodeGroup>

## 使用`useExtension`读取最新的payload

`useExtension`订阅`custom:<name>`频道并返回最多
变压器推送的最新有效负载，已经打开并输入。它是
当 UI 仅需要当前值（例如实时值）时，符合人体工学的选择
计数器、进度百分比或状态徽章。

传递裸通道名称 (`"redaction-stats"`)，而不是 `custom:` 前缀：<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useExtension } from "@langchain/react";

  const latest = useExtension<RedactionStatsEvent>(stream, "redaction-stats");
  // latest?.total, latest?.counts.email, latest?.delta
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useExtension } from "@langchain/vue";

  const latest = useExtension<RedactionStatsEvent>(stream, "redaction-stats");
  // latest.value?.total
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useExtension } from "@langchain/svelte";

  const latest = useExtension<RedactionStatsEvent>(stream, "redaction-stats");
  // latest?.total
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { injectExtension } from "@langchain/angular";

  const latest = injectExtension<RedactionStatsEvent>(stream, "redaction-stats");
  // latest()?.total
  ```
</CodeGroup>

返回值遵循每个框架的反应性模型：一个简单的值
React 和 Svelte、Vue 中的 `Ref` (`latest.value`) 以及 Angular 中的信号
（`latest()`）。在第一个有效负载到达之前，该值为`undefined`。

可选的第三个 `target` 参数将订阅范围限定为命名空间，即
同样的方式`useMessages(stream, node)`将消息范围限定到已发现的图节点。
命名空间见[Graph execution](/oss/python/langgraph/frontend/graph-execution)
瞄准。

## 使用 `useChannel` 缓冲原始事件

`useChannel` 是原始事件逃生舱口。它订阅了一个或多个
通道并返回底层协议事件的有界缓冲区
比单个展开的值。当你需要历史而不是历史时，就可以使用它
最新值，例如事件日志或审计跟踪，或者当您需要通道时
没有更高级别的选择器覆盖。

传递完整的频道ID（`"custom:redaction-stats"`）：

<CodeGroup>
  ```tsx React theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useChannel } from "@langchain/react";

  const rawEvents = useChannel(stream, ["custom:redaction-stats"]);
  ```

  ```vue Vue theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useChannel } from "@langchain/vue";

  const rawEvents = useChannel(stream, ["custom:redaction-stats"]);
  // rawEvents.value
  ```

  ```svelte Svelte theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { useChannel } from "@langchain/svelte";

  const rawEvents = useChannel(stream, ["custom:redaction-stats"]);
  ```

  ```ts Angular theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { injectChannel } from "@langchain/angular";

  const rawEvents = injectChannel(stream, ["custom:redaction-stats"]);
  // rawEvents()
  ```
</CodeGroup>

每个条目都是一个原始协议事件，因此有效负载位于
`event.params.data`。自己拆开：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
function parseRedactionStatsEvents(rawEvents: Event[]): RedactionStatsEvent[] {
  const out: RedactionStatsEvent[] = [];
  for (const event of rawEvents) {
    const data = event.params?.data;
    const payload = data?.payload ?? data;
    if (payload?.kind === "update") out.push(payload);
  }
  return out;
}
```

使用选项参数控制缓冲区：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const rawEvents = useChannel(
  stream,
  ["custom:redaction-stats"],
  undefined, // target namespace
  { bufferSize: 200, replay: true },
);
```|选项 |默认 |效果|
| ------------ | ----------- | ------------------------------------------------------------------------------------------------ |
| `bufferSize` | `"default"` |缓冲事件的最大数量。一旦达到上限，较旧的事件就会消失。                    |
| `replay` | `true` |安装选择器时重播通道上已经看到的事件，而不仅仅是实时事件。 |

<Note>
  更喜欢更高级别的选择器（`useExtension`、`useMessages`、
  `useToolCalls`、`useValues`）适用于常见情况。他们返回的是已打好字、未包装的
  值并仅跟踪您渲染的内容。当您特别需要时，请使用`useChannel`
  需要原始事件流。
</Note>

## 在`useExtension`和`useChannel`之间选择

两者读取相同的自定义通道，但返回的内容不同：|                  | `useExtension` | `useChannel` |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------- |
| **退货** |最新有效负载（`T \| undefined`）|原始事件的有界缓冲区 (`Event[]`) |
| **形状** |解开的、输入的有效负载 |原始协议事件；自己拆开`event.params.data` |
| **订阅者** |频道名称 (`"redaction-stats"`) |完整频道 ID (`["custom:redaction-stats"]`) |
| **何时使用** |您需要当前值 |您需要历史记录、日志或多个通道 |
| **选项** | — | `bufferSize`、`replay` |

常见的模式是在同一通道上使用两者：`useExtension` 驱动一个
实时摘要（当前总数），而 `useChannel` 支持滚动事件日志
线程中的每次更新。

## 用例

自定义通道适合任何未完全映射到的服务器端信号
消息、工具调用或图形状态：* **合规性和修订统计数据**：已清除 PII 的计数、被阻止的内容、
  或政策打击，如上例所示。
* **进度报告**：完成百分比或由某个进程发出的步骤标签
  长期运行的工具。
* **实时指标**：运行期间令牌使用情况、延迟或成本累积。
* **来源和引文**：检索到的文档被推送到侧面板作为
  代理人的回答是有根据的。
* **域事件**：您的后端想要显示的任何结构化更新
  而不更改消息记录。

## 相关

* [Overview](/oss/python/langgraph/frontend/overview) — LangGraph 前端流
  API 和架构。
* [Graph execution](/oss/python/langgraph/frontend/graph-execution) — 命名空间范围
  多节点管道的选择器。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/frontend/custom-stream-channels.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>