<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph runtime | https://docs.langchain.com/oss/python/langgraph/pregel -->

# LangGraph 运行时

[⟦T24⟧](https://reference.langchain.com/python/langgraph/pregel/main/Pregel) 实现 LangGraph 的运行时，管理 LangGraph 应用程序的执行。

编译 [StateGraph](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 或创建 [⟦T25⟧](https://reference.langchain.com/python/langgraph/func/entrypoint) 会生成可通过输入调用的 [⟦T26⟧](https://reference.langchain.com/python/langgraph/pregel/main/Pregel) 实例。

本指南对运行时进行了高级解释，并提供了使用 Pregel 直接实现应用程序的说明。

> **注意：** [⟦T27⟧](https://reference.langchain.com/python/langgraph/pregel/main/Pregel) 运行时以 [Google's Pregel algorithm](https://research.google/pubs/pub37252/) 命名，它描述了一种使用图进行大规模并行计算的有效方法。

## 概述

在 LangGraph 中，Pregel 将 [**actors**](https://en.wikipedia.org/wiki/Actor_model) 和 **通道** 组合到一个应用程序中。 **Actor** 从通道读取数据并将数据写入通道。 Pregel 将应用程序的执行组织为多个步骤，遵循 **Pregel 算法**/**批量同步并行** 模型。

每个步骤由三个阶段组成：* **计划**：确定此步骤中要执行哪些**参与者**。例如，第一步，选择订阅特殊**输入**通道的**参与者**；在后续步骤中，选择订阅上一步中更新的频道的 **参与者**。
* **执行**：并行执行所有选定的**参与者**，直到全部完成，或者一个失败，或者达到超时。在此阶段中，在下一步之前，参与者无法看到通道更新。
* **更新**：使用此步骤中**参与者**写入的值更新通道。

重复直到没有**参与者**被选择执行，或者达到最大步数。

## 演员

**演员**是一个`PregelNode`。它订阅通道、从中读取数据并向其中写入数据。它可以被认为是 Pregel 算法中的**演员**。 `PregelNodes` 实现LangChain的Runnable接口。

## 频道通道用于在参与者（PregelNode）之间进行通信。每个通道都有一个值类型、一个更新类型和一个更新函数，该函数采用一系列更新并修改存储的值。通道可用于将数据从一个链发送到另一个链，或者在未来的步骤中将数据从一个链发送到自身。

### 最后值

[⟦T30⟧](https://reference.langchain.com/python/langgraph/channels/last_value/LastValue) 是默认通道类型。它存储最后写入的值，覆盖任何先前的值。将其用于输入和输出值，或将数据从一个步骤传递到下一步。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.channels import LastValue

channel: LastValue[int] = LastValue(int)
```

### 主题

[⟦T31⟧](https://reference.langchain.com/python/langgraph/channels/topic/Topic) 是一个可配置的 PubSub 通道，可用于在参与者之间发送多个值或跨步骤累积输出。它可以配置为删除重复值或累积运行期间写入的所有值。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.channels import Topic

# Accumulate all values written across steps
channel: Topic[str] = Topic(str, accumulate=True)
```

### 二元运算符聚合

[⟦T32⟧](https://reference.langchain.com/python/langgraph/channels/binop/BinaryOperatorAggregate) 存储一个持久值，该值通过将二元运算符应用于当前值和每个新更新来更新。使用它来计算跨步骤的运行聚合。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import operator
from langgraph.channels import BinaryOperatorAggregate

# Running total: each write adds to the current value
total = BinaryOperatorAggregate(int, operator.add)
```

### 达美频道

<Warning>
  `DeltaChannel` 需要 `langgraph>=1.2`，目前处于 **beta** 状态。 API 可能会在未来版本中发生变化。
</Warning>[⟦T35⟧](https://reference.langchain.com/python/langgraph/channels/delta/DeltaChannel) 仅存储每一步的增量增量，而不是完整的累加值。这对于频繁写入并随着时间的推移积累大量值的通道最有用 - 例如，长时间运行的线程中的对话消息列表。如果没有增量存储，完整列表将重新序列化到每个检查点；对于`DeltaChannel`，仅存储每一步写入的新消息。

<Tip>
  当通道被频繁写入并且随着时间的推移而变大时，请考虑`DeltaChannel`。一个好的信号：如果您注意到特定通道的检查点大小随着线程长度线性增长，⟦​​T38⟧ 可能是一个不错的选择。
</Tip>

在 `Annotated` 类型注释中使用 `DeltaChannel` 的方式与使用普通减速器的方式相同：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Annotated, Sequence
from typing_extensions import TypedDict
from langgraph.channels import DeltaChannel


def my_reducer(state: list[str], writes: Sequence[list[str]]) -> list[str]:
    result = list(state)
    for write in writes:
        result.extend(write)
    return result


class State(TypedDict):
    messages: Annotated[list[str], DeltaChannel(my_reducer)]
```

#### 散装减速机要求

传递给 `DeltaChannel` 的 `reducer` 是一个 **批量减速器**：它在单个调用中接收当前状态和当前步骤中所有写入的 *序列* - 不像标准减速器那样成对。这与 `StateGraph` 中与 `Annotated` 一起使用的每键减速器不同，其中每次更新都会调用一次减速器。

<Warning>
  批量缩减器**必须是关联的**（批处理不变）：

  ```
  reducer(reducer(state, [xs]), [ys]) == reducer(state, [xs, ys])
  ```如果您的减速器不是关联的，则重建的状态可能会有所不同，具体取决于 LangGraph 跨步骤批量写入的方式，从而产生不一致的行为。
</Warning>

<Warning>
  **减速器在重建时运行，而不是在写入时运行。** 与 [⟦T45⟧](https://reference.langchain.com/python/langgraph/channels/binop/BinaryOperatorAggregate) 不同，[⟦T45⟧](https://reference.langchain.com/python/langgraph/channels/binop/BinaryOperatorAggregate) 的减速器在写入时调用，因此组合值被序列化到检查点中，而 `DeltaChannel` 减速器在通道值从其持久写入“重建”时被调用。原始的每步写入是序列化的；仅当值具体化时（在下一次读取时、在下一步的参与者上或在重播历史记录时）才会调用减速器。

  设计减速器时的实际后果：* **使其成为`(state, writes)`的纯函数。** 任何副作用、随机性或挂钟读取（例如，`uuid.uuid4()`、`datetime.now()`）都会在每次重建值时执行，并在每次重播时产生不同的结果。它们“没有”被烘焙到持久写入中。
  * **不要依赖对传入写入的突变进行持久化。** 如果您的reducer对写入对象进行了突变（例如，为没有稳定ID的项目分配一个稳定的ID），则该突变仅存在于重建值中。存储的写入仍然具有原始形状，因此下一次重建将再次看到未突变的输入。
  * **在上游附加身份和其他稳定的元数据。** 如果下游代码需要通过 ID 跨轮引用某个项目（例如，稍后更新或删除它），请在将值写入通道之前分配该 ID，而不是在减速器内部。
</Warning>

以下是针对两种最常见情况的批量减速器：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from typing import Any, Sequence


# List: append all writes in order
def list_reducer(state: list[Any], writes: Sequence[list[Any]]) -> list[Any]:
    result = list(state)
    for write in writes:
        result.extend(write)
    return result


# Dict: merge all writes, last write wins on key conflicts
def dict_reducer(
    state: dict[str, Any], writes: Sequence[dict[str, Any]]
) -> dict[str, Any]:
    result = dict(state)
    for write in writes:
        result.update(write)
    return result
```

两者都是关联的：一次应用一批会产生与一起应用它们相同的结果。

#### 使用快照\_频率来限制读取延迟如果没有快照，读取 `DeltaChannel` 值需要重播完整的写入历史记录 — 对于具有 N 个步骤的线程来说，O(N)。设置 `snapshot_frequency=K` 每 K 个预凝胶步骤写入一个完整快照，将读取深度限制为最多 K 个步骤：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
class State(TypedDict):
    messages: Annotated[
        list[str],
        DeltaChannel(my_reducer, snapshot_frequency=5),
    ]
```

较高的 `snapshot_frequency` 值可减少存储开销，但会增加读取延迟。较低的值会更紧密地限制延迟，但代价是检查点更大。 `None`（默认）完全跳过快照——适用于读取很少或线程较短的情况。

#### 版本兼容性和回滚

<Warning>
  **不支持回滚到不支持 `DeltaChannel` 的版本。** `langgraph>=1.2` 以早期版本无法读取的新格式写入增量通道检查点。一旦线程使用了`DeltaChannel`，降级 LangGraph 会使这些检查点变得不可读，因为旧的运行时不理解增量格式并且无法重建通道状态。如果需要回滚，请在降级之前使用[delta-channel-dump recovery script](https://github.com/langchain-ai/langgraph/tree/main/examples/delta-channel-dump)迁移受影响的线程，或丢弃它们。
</Warning>

## 示例

虽然大多数用户将通过 [StateGraph](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) API 或 [⟦T57⟧](https://reference.langchain.com/python/langgraph/func/entrypoint) 装饰器与 Pregel 交互，但也可以直接与 Pregel 交互。

下面是几个不同的示例，可帮助您了解 Pregel API。<Tabs>
  <Tab title="Single node">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.channels import EphemeralValue
    from langgraph.pregel import Pregel, NodeBuilder

    node1 = (
        NodeBuilder().subscribe_only("a")
        .do(lambda x: x + x)
        .write_to("b")
    )

    app = Pregel(
        nodes={"node1": node1},
        channels={
            "a": EphemeralValue(str),
            "b": EphemeralValue(str),
        },
        input_channels=["a"],
        output_channels=["b"],
    )

    app.invoke({"a": "foo"})
    ```

    ```con theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'b': 'foofoo'}
    ```
  </Tab>

  <Tab title="Multiple nodes">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.channels import LastValue, EphemeralValue
    from langgraph.pregel import Pregel, NodeBuilder

    node1 = (
        NodeBuilder().subscribe_only("a")
        .do(lambda x: x + x)
        .write_to("b")
    )

    node2 = (
        NodeBuilder().subscribe_only("b")
        .do(lambda x: x + x)
        .write_to("c")
    )


    app = Pregel(
        nodes={"node1": node1, "node2": node2},
        channels={
            "a": EphemeralValue(str),
            "b": LastValue(str),
            "c": EphemeralValue(str),
        },
        input_channels=["a"],
        output_channels=["b", "c"],
    )

    app.invoke({"a": "foo"})
    ```

    ```con theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'b': 'foofoo', 'c': 'foofoofoofoo'}
    ```
  </Tab>

  <Tab title="Topic">
    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.channels import EphemeralValue, Topic
    from langgraph.pregel import Pregel, NodeBuilder

    node1 = (
        NodeBuilder().subscribe_only("a")
        .do(lambda x: x + x)
        .write_to("b", "c")
    )

    node2 = (
        NodeBuilder().subscribe_to("b")
        .do(lambda x: x["b"] + x["b"])
        .write_to("c")
    )

    app = Pregel(
        nodes={"node1": node1, "node2": node2},
        channels={
            "a": EphemeralValue(str),
            "b": EphemeralValue(str),
            "c": Topic(str, accumulate=True),
        },
        input_channels=["a"],
        output_channels=["c"],
    )

    app.invoke({"a": "foo"})
    ```

    ```pycon theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'c': ['foofoo', 'foofoofoofoo']}
    ```
  </Tab>

  <Tab title="BinaryOperatorAggregate">
    这个例子演示了如何使用[⟦T58⟧](https://reference.langchain.com/python/langgraph/channels/binop/BinaryOperatorAggregate)通道来实现reducer。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.channels import EphemeralValue, BinaryOperatorAggregate
    from langgraph.pregel import Pregel, NodeBuilder


    node1 = (
        NodeBuilder().subscribe_only("a")
        .do(lambda x: x + x)
        .write_to("b", "c")
    )

    node2 = (
        NodeBuilder().subscribe_only("b")
        .do(lambda x: x + x)
        .write_to("c")
    )

    def reducer(current, update):
        if current:
            return current + " | " + update
        else:
            return update

    app = Pregel(
        nodes={"node1": node1, "node2": node2},
        channels={
            "a": EphemeralValue(str),
            "b": EphemeralValue(str),
            "c": BinaryOperatorAggregate(str, operator=reducer),
        },
        input_channels=["a"],
        output_channels=["c"],
    )

    app.invoke({"a": "foo"})
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    { 'c': 'foofoo | foofoofoofoo' }
    ```
  </Tab>

  <Tab title="Cycle">
    此示例演示了如何在图中引入循环，方法是：
    链写入其订阅的频道。执行将继续
    直到`None`值写入通道。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langgraph.channels import EphemeralValue
    from langgraph.pregel import Pregel, NodeBuilder, ChannelWriteEntry

    example_node = (
        NodeBuilder().subscribe_only("value")
        .do(lambda x: x + x if len(x) < 10 else None)
        .write_to(ChannelWriteEntry("value", skip_none=True))
    )

    app = Pregel(
        nodes={"example_node": example_node},
        channels={
            "value": EphemeralValue(str),
        },
        input_channels=["value"],
        output_channels=["value"],
    )

    app.invoke({"value": "a"})
    ```

    ```pycon theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'value': 'aaaaaaaaaaaaaaaa'}
    ```
  </Tab>
</Tabs>

## 高级 API

LangGraph 提供了两个用于创建 Pregel 应用程序的高级 API：[StateGraph (Graph API)](/oss/python/langgraph/graph-api) 和 [Functional API](/oss/python/langgraph/functional-api)。

<Tabs>
  <Tab title="StateGraph (Graph API)">
    [StateGraph (Graph API)](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 是一个更高级别的抽象，可以简化 Pregel 应用程序的创建。它允许您定义节点和边的图。当您编译图时，StateGraph API 会自动为您创建 Pregel 应用程序。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from typing import TypedDict

    from langgraph.constants import START
    from langgraph.graph import StateGraph

    class Essay(TypedDict):
        topic: str
        content: str | None
        score: float | None

    def write_essay(essay: Essay):
        return {
            "content": f"Essay about {essay['topic']}",
        }

    def score_essay(essay: Essay):
        return {
            "score": 10
        }

    builder = StateGraph(Essay)
    builder.add_node(write_essay)
    builder.add_node(score_essay)
    builder.add_edge(START, "write_essay")
    builder.add_edge("write_essay", "score_essay")

    # Compile the graph.
    # This will return a Pregel instance.
    graph = builder.compile()
    ```

    编译后的 Pregel 实例将与节点和通道列表相关联。您可以通过打印来检查节点和通道。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    print(graph.nodes)
    ```

    你会看到这样的东西：

    ```pycon theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'__start__': <langgraph.pregel.read.PregelNode at 0x7d05e3ba1810>,
     'write_essay': <langgraph.pregel.read.PregelNode at 0x7d05e3ba14d0>,
     'score_essay': <langgraph.pregel.read.PregelNode at 0x7d05e3ba1710>}
    ```

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    print(graph.channels)
    ```

    你应该看到这样的东西

    ```pycon theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {'topic': <langgraph.channels.last_value.LastValue at 0x7d05e3294d80>,
     'content': <langgraph.channels.last_value.LastValue at 0x7d05e3295040>,
     'score': <langgraph.channels.last_value.LastValue at 0x7d05e3295980>,
     '__start__': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e3297e00>,
     'write_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e32960c0>,
     'score_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d8ab80>,
     'branch:__start__:__self__:write_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e32941c0>,
     'branch:__start__:__self__:score_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d88800>,
     'branch:write_essay:__self__:write_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e3295ec0>,
     'branch:write_essay:__self__:score_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d8ac00>,
     'branch:score_essay:__self__:write_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d89700>,
     'branch:score_essay:__self__:score_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d8b400>,
     'start:write_essay': <langgraph.channels.ephemeral_value.EphemeralValue at 0x7d05e2d8b280>}
    ```
  </Tab><Tab title="Functional API">
    在[Functional API](/oss/python/langgraph/functional-api)中，您可以使用[⟦T60⟧](https://reference.langchain.com/python/langgraph/func/entrypoint)来创建Pregel应用程序。 `entrypoint` 装饰器允许您定义一个接受输入并返回输出的函数。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from typing import TypedDict

    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.func import entrypoint

    class Essay(TypedDict):
        topic: str
        content: str | None
        score: float | None


    checkpointer = InMemorySaver()

    @entrypoint(checkpointer=checkpointer)
    def write_essay(essay: Essay):
        return {
            "content": f"Essay about {essay['topic']}",
        }

    print("Nodes: ")
    print(write_essay.nodes)
    print("Channels: ")
    print(write_essay.channels)
    ```

    ```pycon theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    Nodes:
    {'write_essay': <langgraph.pregel.read.PregelNode object at 0x7d05e2f9aad0>}
    Channels:
    {'__start__': <langgraph.channels.ephemeral_value.EphemeralValue object at 0x7d05e2c906c0>, '__end__': <langgraph.channels.last_value.LastValue object at 0x7d05e2c90c40>, '__previous__': <langgraph.channels.last_value.LastValue object at 0x7d05e1007280>}
    ```
  </Tab>
</Tabs>

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/pregel.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>