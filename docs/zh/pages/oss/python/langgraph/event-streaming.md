<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Event streaming | https://docs.langchain.com/oss/python/langgraph/event-streaming -->

# 事件流

Stream LangGraph 使用消息、状态、子图、输出和扩展的类型化投影运行。

对于大多数 LangGraph 应用程序代码，事件流是推荐的进程内流模型。它返回一个运行流对象，可以同时以多种方式使用。

## 快速入门

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events({
    "messages": [{"role": "user", "content": "What is 42 * 17?"}],
}, version="v3")

for message in stream.messages:
    for token in message.text:
        print(token, end="", flush=True)

final_state = stream.output
```

要针对部署在代理服务器后面的图表进行流式传输，请参阅[LangSmith Streaming API](/langsmith/streaming)。

## 这些部分如何组合在一起

流堆栈有两个主要层：

1. **Streaming** 从 Pregel 引擎发出原始图形执行事件。
2. **事件流** 标准化这些事件，通过流转换器运行它们，并公开类型化投影。

<div>
  <div>
    <div>
      <div>预凝胶发动机</div>
      <div>运行图步骤</div>
    </div>

    <div>发射</div>

    <div>
      <div>Raw Pregel 活动</div>
      <div><code>更新</code>、<code>值</code>、<code>消息</code>、<code>自定义</code>、 <code>检查点</code>、<code>任务</code>、<code>调试</code></div>
    </div>

    <div>发送至</div>

    <div>
      <div>事件路由器</div>
      <div>通过变压器管道路由每个事件</div>
    </div><div>级联</div>

    <div>
      <div>流转换器</div>

      <div>
        <div>值转换器</div>
        <div>消息转换器</div>
        <div>...</div>
        <div>定制变压器</div>
      </div>
    </div>

    <div>生产</div>

    <div>
      <div>事件流</div>
      <div>应用程序代码的预计事件</div>
    </div>
  </div>
</div>

事件路由器是两层之间的桥梁。它接收标准化的 Pregel 事件并通过注册的流转换器传递每个事件。内置变压器创建标准投影，例如 `stream.messages`、`stream.values`、`stream.subgraphs` 和 `stream.output`。自定义变压器可以在`stream.extensions`下添加特定于应用程序的投影。

## 事件流提供什么

运行流公开一个底层事件流上的类型化投影：|投影|使用 |
| -------------------- | -------------------------------------------------- |
| `stream` |迭代每个协议事件。                      |
| `stream.messages` |流式传输聊天模型消息和令牌增量。       |
| `stream.values` |迭代状态快照并等待最终值。 |
| `stream.output` |等待最终输出。                            |
| `stream.subgraphs` |发现并观察嵌套图执行。      |
| `stream.interrupts` |检查人机交互中断负载。      |
| `stream.interrupted` |检查运行是否因人工输入而暂停。      |
| `stream.extensions` |使用自定义流转换器投影。     |

多个消费者可以同时读取这些预测。读取`stream.messages`不会消耗`stream.values`、`stream.subgraphs`或`stream.output`所需的事件。

事件流位于[streaming](/oss/python/langgraph/streaming)之上一级，它通过`stream_mode`模式公开原始图形执行事件，例如`updates`、`values`、`messages`、`custom`、`checkpoints`、`tasks`和`debug`。当您需要对这些模式进行低级访问时，请使用流式传输；当应用程序代码受益于类型化投影时，请使用事件流。

## 流消息

使用`stream.messages`进行聊天模型输出：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events(input, version="v3")

for message in stream.messages:
    text = str(message.text)
    usage = message.output.usage_metadata

    print(text)
    print(usage)
````message.text` 在同步代码中是可迭代的。迭代它以逐个令牌输出，或调用 `str(message.text)` 以获得完整文本。

`message.reasoning` 公开推理增量，`message.tool_calls` 公开工具调用参数块。如果您需要精确到达顺序的文本、推理和工具调用块，请迭代消息流的原始事件，而不是单独迭代每个投影。

## 流子图

使用 `stream.subgraphs` 观察嵌套图工作而不解析名称空间字符串：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events(input, version="v3")

for subgraph in stream.subgraphs:
    print(subgraph.graph_name, subgraph.path)

    for message in subgraph.messages:
        print(message.text)
```

`subgraph.graph_name` 是编译图或代理的`name`。从工具分派的命名代理（例如，通过 Deep Agents `task` 工具调用的 `create_agent(name=...)`）以该名称出现在此处，打开作用域的 `lifecycle` 事件带有链接回分派工具调用的 `cause`。请参阅[Lifecycle](#lifecycle)了解更多信息。

对于特定于产品的流，请参阅[Deep Agents streaming](/oss/python/deepagents/event-streaming)（了解子代理流）和[LangChain agent streaming](/oss/python/langchain/streaming)（了解工具调用和中间件事件）。

## 流状态

在每个步骤之后使用 `stream.values` 流式传输完整状态快照：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events(input, version="v3")

for snapshot in stream.values:
    print(snapshot)

final_state = stream.output
```

## 流式传输多个投影

对于异步代码中的并发消费，请使用 `astream_events` 和 `asyncio.gather`：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import asyncio

stream = await graph.astream_events(input, version="v3")

async def consume_messages():
    async for message in stream.messages:
        print(f"[llm] node={message.node}")

async def consume_subgraphs():
    async for subgraph in stream.subgraphs:
        print(f"[subgraph] path={subgraph.path}")

await asyncio.gather(consume_messages(), consume_subgraphs())
```

对于同步代码，使用 `stream.interleave(...)` 以严格的到达顺序消耗多个投影：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events(input, version="v3")

for name, item in stream.interleave("values", "messages", "subgraphs"):
    if name == "values":
        print(f"[state] keys={list(item)}")
    elif name == "messages":
        print(f"[llm] node={item.node}")
    elif name == "subgraphs":
        print(f"[subgraph] path={item.path}")
```

## 中断后恢复当图表因人工输入而暂停时，检查 `stream.interrupted` 和 `stream.interrupts`，然后通过使用 `Command` 再次调用 `stream_events(..., version="v3")` 来恢复。

Resume 需要一个使用检查点编译的图和一个带有线程 ID 的配置 — 请参阅[persistence](/oss/python/langgraph/persistence)。

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

stream = graph.stream_events(input, version="v3")

for message in stream.messages:
    print(message.text)

if stream.interrupted:
    print(stream.interrupts)

stream = graph.stream_events(
    Command(resume={"decisions": [{"type": "approve"}]}),
    version="v3",
)
final_state = stream.output
```

## 流式传输所有协议事件

当您需要原始协议事件流时，请使用运行对象本身：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events({
    "messages": [{"role": "user", "content": "What is 42 * 17?"}],
}, version="v3")

for event in stream:
    namespace = event["params"]["namespace"]
    print(namespace, event["method"], event["params"]["data"])
```

每个事件都是一个 `ProtocolEvent` 信封，包装特定于通道的有效负载。变压器的 `process(event)` 也具有相同的形状。

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
class ProtocolEvent(TypedDict):
    seq: int                    # strictly increasing within a run; use for ordering
    method: str                 # channel name: "messages", "values", "updates", "custom", "tools", "lifecycle", ...
    params: ProtocolEventParams


class ProtocolEventParams(TypedDict):
    namespace: list[str]        # path of "<name>:<runtime_id>" segments from the root graph; [] is the root
    timestamp: int              # wall-clock milliseconds; can drift, don't rely on for ordering
    data: Any                   # channel-specific payload; shape depends on `method`
```

`namespace` 是从根图到发出事件的范围的路径。根是空数组`[]`。每个子执行都会添加一个 `"name:runtime_id"` 段，因此子图中的嵌套工具调用看起来像 `["researcher:6f4d", "tools:91ac"]`。 `:`之前的名称是稳定图或节点名称；后缀是每次调用的运行时 ID。当您只关心特定子树时，您可以自己按命名空间过滤原始事件 - `stream.subgraphs` 已经对嵌套图执行执行了此操作。

## 通道和事件生命周期

原始事件在通道上流动。频道名称显示为事件的`method`；每个通道都会发出特定的事件形状。|频道|目的|
| ---------------- | --------------------------------------------------------------------------- |
| `values` |完整的图状态快照。                                     |
| `updates` |每个节点的状态增量。                                          |
| `messages` |以内容块为中心的聊天模型输出。                        |
| `tools` |工具调用开始、流式输出、完成和错误事件。     |
| `lifecycle` |运行、子图和子代理状态更改。                     |
| `checkpoints` |用于分支和时间旅行的轻量级检查点信封。 |
| `input` |人机交互输入请求和响应。                 |
| `tasks` | Pregel 任务创建和结果事件。                         |
| `custom` |来自图形代码的用户定义的有效负载。                          |
| `custom:<name>` |应用程序定义的流转换器输出。                  |

类型化投影（`stream.messages`、`stream.values`等）是根据这些通道构建的。当您直接迭代运行对象时，通道名称将显示为原始事件上的 `method` 字段。

### 消息`messages` 通道模型输出为内容块。数据的 `event` 字段是以下之一：

* `message-start`
* `content-block-start`
* `content-block-delta`
* `content-block-finish`
* `message-finish`

内容块具有明确的边界：一个块开始，发出零个或多个增量，并在同一消息中的下一个块开始之前完成。这使得令牌流、推理块、工具调用块和多模式内容变得明确，而不需要提供者特定的格式。 `message-finish` 可能包括代币使用；不可恢复的模型调用失败作为消息错误事件到达。

直接使用原始内容块事件而不是使用 `stream.messages` 投影：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for event in stream:
    if event["method"] != "messages":
        continue

    data = event["params"]["data"][0]
    if not isinstance(data, dict):
        continue
    if data.get("event") != "content-block-delta":
        continue

    block = data.get("delta") or {}
    if block.get("type") == "text-delta":
        print(block.get("text", ""), end="", flush=True)
    elif block.get("type") == "reasoning-delta":
        print(f"[thinking]{block.get('reasoning', '')}", end="", flush=True)
```

### 工具

`tools` 通道公开工具执行。数据的 `event` 字段是以下之一：

* `tool-started`
* `tool-output-delta`
* `tool-finished`
* `tool-error`

工具事件通过工具调用 ID 关联，因此工具执行可以连接回到 `messages` 通道上的原始工具调用内容块。

### 生命周期

`lifecycle` 通道跟踪根运行、子图和子代理状态。数据的 `event` 字段是以下之一：

* `started`
* `running`
* `completed`
* `failed`
* `interrupted`除了`event`之外，生命周期数据还可能包括可选的`graph_name`、`error`和`cause`，描述子作用域启动的原因（父工具调用、扇出发送、边缘转换）。

## 构建你自己的投影

流转换器是事件流中的投影层。他们观察协议事件，保持自己的状态，并公开运行的派生视图 - 例如工具活动、令牌总数、进度事件、工件或另一个协议的消息。 `StreamChannel` 是用于发布这些视图的投影基元转换器。

内置投影（`stream.messages`、`stream.values`、`stream.subgraphs`、`stream.output`）和特定于产品的投影（LangChain 的`stream.tool_calls`、Deep Agents 的`stream.subagents`）本身就是使用相同合约的变压器。用户转换器通过编译时或调用时注册堆叠在顶部，它们的投影出现在 `stream.extensions` 下。

当现有投影与应用程序所需的形状不匹配时，编写一个。

### 变压器如何工作

事件流从 LangGraph Pregel 引擎的流输出开始。运行时将这些块标准化为协议事件，然后流处理程序通过一堆流转换器路由每个事件。

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
flowchart TD
    A[Pregel modes] --> B[Events]
    B --> C[Built-in projections]
    C --> D[User transformers]
    D --> E[Run projections]
```流处理程序是一个流的中央调度程序。对于每个协议事件，它：

1. 按顺序调用每个已注册变压器的`process(event)`钩子。
2. 名为 `StreamChannel` 的线路推回协议事件流。
3. 将事件存储在运行流中，除非转换器抑制它。
4. 运行结束时在每个变压器上调用`finalize()` 或`fail()`。

变形金刚是观察性的。他们不会回调图运行时。相反，它们消耗事件并将派生值推送到 `StreamChannel`、promise 或其他投影对象中。

### 变压器形状

变压器实现 `StreamTransformer` 接口：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.stream import ProtocolEvent, StreamTransformer


class MyTransformer(StreamTransformer):
    def init(self) -> dict:
        ...

    def process(self, event: ProtocolEvent) -> bool:
        ...

    def finalize(self) -> None:
        ...

    def fail(self, err: BaseException) -> None:
        ...
```

* `init()` 创建投影对象。用户变压器投影出现在`stream.extensions`下。
* `process()` 观察每个协议事件。 `ProtocolEvent` 形状请参见[Stream all protocol events](#stream-all-protocol-events)。仅当您故意想要抑制原始事件时才返回`false`。
* `finalize()` 在成功流后关闭或解析非通道投影。
* `fail()` 将误差传播到非通道投影。

### 声明所需的流模式`required_stream_modes` 控制底层图在流期间发出的 Pregel 流模式。运行时获取每个已注册变压器的 `required_stream_modes` 的并集，并将该并集作为 `stream_mode` 参数传递给图的 `.stream()` 调用。 **永远不会发出任何变压器请求的模式** - 声明 `("custom",)` 是导致 `custom` 事件在运行中流动的原因。

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
class CustomTransformer(StreamTransformer):
    required_stream_modes = ("custom",)  # [!code highlight]

    def process(self, event: ProtocolEvent) -> bool:
        if event["method"] == "custom":
            ...
        return True
```

`process()`接收图表发出的每个事件，并负责通过`event["method"]`进行过滤。该声明开启上游排放；它并没有缩小`process()`的视野。有效值为 Pregel 流模式：`"messages"`、`"tools"`、`"custom"`、`"values"`、`"updates"`、`"checkpoints"`、`"tasks"`、`"debug"`。每个变压器必须声明它作用的每个模式 - 省略的模式不会由图发出，并且永远不会达到 `process()`。

### 流频道

`StreamChannel` 是转换器用于流式传输值的投影基元。它总是在 `stream.extensions.<name>` 上公开一个可迭代流。构造函数参数决定每个 `push()` 是否也作为 `custom:<name>` 事件流入运行的主事件流，即在迭代原始协议事件时是否显示投影的值。|需要|使用 |
| ---------------------------------------------------------- | -------------------- |
|仅侧通道投影 | `StreamChannel()` |
|还将每次推送流入主事件流 | `StreamChannel(name)` |

命名通道有效负载必须是可序列化的，因为每个推送的值也会成为主流中的`custom:<name>`协议事件。将承诺、异步迭代、类实例和其他进程内句柄保留在未命名通道中。

流处理程序拥有通道生命周期。一旦 `init()` 返回一个通道，处理程序就会在运行结束时关闭该通道或使其失败。变压器只推动价值。

### 示例：命名通道

将字符串名称传递给 `StreamChannel` 以通过 `stream.extensions` 公开流式投影 *并*将每个推送的值作为 `custom:<name>` 协议事件转发到运行的主事件流中：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import TypedDict

from langgraph.stream import ProtocolEvent, StreamChannel, StreamTransformer


class ToolActivity(TypedDict):
    name: str
    status: str


class ToolActivityTransformer(StreamTransformer):
    required_stream_modes = ("tools",)

    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        super().__init__(scope)
        self.activity = StreamChannel[ToolActivity]("tool_activity")

    def init(self) -> dict:
        return {"tool_activity": self.activity}

    def process(self, event: ProtocolEvent) -> bool:
        if event["method"] != "tools":
            return True

        data = event["params"]["data"]
        if isinstance(data, dict) and data.get("tool_name") and data.get("event"):
            status = "error" if data["event"] == "tool-error" else "started"
            self.activity.push({"name": data["tool_name"], "status": status})
        return True
```

### 示例：未命名频道如果没有名称，该通道只是一个侧通道投影 - 可在 `stream.extensions` 上访问，但对于迭代原始事件的消费者不可见。对于保存无法序列化到主事件流的进程内句柄（承诺、异步迭代、类实例）的投影来说，这是正确的选择。

下面的示例将未命名通道与 `get_stream_writer` 配对，这让图形节点发出 `custom` 通道事件，然后转换器将其排入投影：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.config import get_stream_writer
from langgraph.stream import ProtocolEvent, StreamChannel, StreamTransformer


def node(state):
    writer = get_stream_writer()
    writer({"kind": "progress", "message": "retrieving context"})
    return state


class CustomTransformer(StreamTransformer):
    required_stream_modes = ("custom",)

    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        super().__init__(scope)
        self.log = StreamChannel()

    def init(self) -> dict:
        return {"custom": self.log}

    def process(self, event: ProtocolEvent) -> bool:
        if event["method"] == "custom":
            self.log.push(event["params"]["data"])
        return True


stream = graph.stream_events(input, version="v3", transformers=[CustomTransformer])

for item in stream.extensions["custom"]:
    print(item)
```

### 示例：最终值投影

当投影不应流入主事件流时，使用未命名的流、promise 或其他进程内对象：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.stream import ProtocolEvent, StreamChannel, StreamTransformer


class StatsTransformer(StreamTransformer):
    required_stream_modes = ("messages",)

    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        super().__init__(scope)
        self.total_tokens = 0
        self.total_tokens_log = StreamChannel[int]()

    def init(self) -> dict:
        return {"total_tokens": self.total_tokens_log}

    def process(self, event: ProtocolEvent) -> bool:
        data = event["params"]["data"]
        if isinstance(data, dict):
            usage = data.get("usage") or {}
            self.total_tokens += usage.get("output_tokens") or 0
        return True

    def finalize(self) -> None:
        self.total_tokens_log.push(self.total_tokens)
        self.total_tokens_log.close()
```

### 在调用时或编译时注册

在调用时传递变压器进行本地实验：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
stream = graph.stream_events(
    input,
    version="v3",
    transformers=[StatsTransformer, ToolActivityTransformer],
)
```

当该图的每次运行都应产生投影时，将转换器编译到图中：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph = builder.compile(
    transformers=[StatsTransformer, ToolActivityTransformer],
)
```

### 内置：`ToolCallTransformer`

LangGraph 将 `ToolCallTransformer` 作为内置组件提供。注册它以在普通的 `StateGraph` 上公开 `stream.tool_calls`：

```py theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.prebuilt import ToolCallTransformer

stream = graph.stream_events(input, version="v3", transformers=[ToolCallTransformer])

for tool_call in stream.tool_calls:
    print(tool_call.tool_name, tool_call.input)
```

## 相关

LangGraph 定义了流原语。要使用 LangChain 或 Deep Agents 进行流式传输，请查看相关产品文档：* [LangChain agent streaming](/oss/python/langchain/event-streaming) 涵盖 ReAct 风格的代理消息、工具调用和中间件更新。
* [Deep Agents streaming](/oss/python/deepagents/event-streaming) 涵盖子代理、嵌套消息和子代理工具调用。
* [LangChain frontend patterns](/oss/python/langchain/frontend/overview) 和 [LangGraph frontend patterns](/oss/python/langgraph/frontend/overview) 显示构建在流状态之上的 UI 用例。
* [LangSmith Streaming API](/langsmith/streaming) 涵盖针对部署在代理服务器后面的图表的流式传输。

线路级事件和命令格式在 [Agent Protocol](https://github.com/langchain-ai/agent-protocol) 存储库中定义，并且在 PyPI 上定义为 [⟦T170⟧](https://pypi.org/project/langchain-protocol/)，在 npm 上定义为 [⟦T171⟧](https://www.npmjs.com/package/@langchain/protocol)。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/event-streaming.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>