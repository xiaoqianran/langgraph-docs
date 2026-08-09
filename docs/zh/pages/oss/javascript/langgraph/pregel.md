<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangGraph runtime | https://docs.langchain.com/oss/javascript/langgraph/pregel -->

# LangGraph 运行时

[⟦T19⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Pregel) 实现 LangGraph 的运行时，管理 LangGraph 应用程序的执行。

编译 [StateGraph](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 或创建 [entrypoint](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint) 会生成可通过输入调用的 [⟦T20⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Pregel) 实例。

本指南对运行时进行了高级解释，并提供了使用 Pregel 直接实现应用程序的说明。

> **注意：** [⟦T21⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Pregel) 运行时以 [Google's Pregel algorithm](https://research.google/pubs/pub37252/) 命名，它描述了一种使用图进行大规模并行计算的有效方法。

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

[⟦T24⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.channels.LastValue.html) 是默认通道类型。它存储最后写入的值，覆盖任何先前的值。将其用于输入和输出值，或将数据从一个步骤传递到下一步。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { LastValue } from "@langchain/langgraph/channels";

const channel = new LastValue<number>();
```

### 主题

[⟦T25⟧](https://reference.langchain.com/javascript/langchain-langgraph/channels/Topic) 是一个可配置的 PubSub 通道，可用于在参与者之间发送多个值或跨步骤累积输出。它可以配置为删除重复值或累积运行期间写入的所有值。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Topic } from "@langchain/langgraph/channels";

// Accumulate all values written across steps
const channel = new Topic<string>({ accumulate: true });
```

### 二元运算符聚合

[⟦T26⟧](https://reference.langchain.com/javascript/langchain-langgraph/channels/BinaryOperatorAggregate) 存储一个持久值，该值通过将二元运算符应用于当前值和每个新更新来更新。使用它来计算跨步骤的运行聚合。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BinaryOperatorAggregate } from "@langchain/langgraph/channels";

// Running total: each write adds to the current value
const total = new BinaryOperatorAggregate<number>({ operator: (a, b) => a + b });
```

## 示例

虽然大多数用户将通过 [StateGraph](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) API 或 [entrypoint](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint) 装饰器与 Pregel 交互，但也可以直接与 Pregel 交互。

下面是几个不同的示例，可帮助您了解 Pregel API。<Tabs>
  <Tab title="Single node">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { EphemeralValue } from "@langchain/langgraph/channels";
    import { Pregel, NodeBuilder } from "@langchain/langgraph/pregel";

    const node1 = new NodeBuilder()
      .subscribeOnly("a")
      .do((x: string) => x + x)
      .writeTo("b");

    const app = new Pregel({
      nodes: { node1 },
      channels: {
        a: new EphemeralValue<string>(),
        b: new EphemeralValue<string>(),
      },
      inputChannels: ["a"],
      outputChannels: ["b"],
    });

    await app.invoke({ a: "foo" });
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    { b: 'foofoo' }
    ```
  </Tab>

  <Tab title="Multiple nodes">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { LastValue, EphemeralValue } from "@langchain/langgraph/channels";
    import { Pregel, NodeBuilder } from "@langchain/langgraph/pregel";

    const node1 = new NodeBuilder()
      .subscribeOnly("a")
      .do((x: string) => x + x)
      .writeTo("b");

    const node2 = new NodeBuilder()
      .subscribeOnly("b")
      .do((x: string) => x + x)
      .writeTo("c");

    const app = new Pregel({
      nodes: { node1, node2 },
      channels: {
        a: new EphemeralValue<string>(),
        b: new LastValue<string>(),
        c: new EphemeralValue<string>(),
      },
      inputChannels: ["a"],
      outputChannels: ["b", "c"],
    });

    await app.invoke({ a: "foo" });
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    { b: 'foofoo', c: 'foofoofoofoo' }
    ```
  </Tab>

  <Tab title="Topic">
    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { EphemeralValue, Topic } from "@langchain/langgraph/channels";
    import { Pregel, NodeBuilder } from "@langchain/langgraph/pregel";

    const node1 = new NodeBuilder()
      .subscribeOnly("a")
      .do((x: string) => x + x)
      .writeTo("b", "c");

    const node2 = new NodeBuilder()
      .subscribeTo("b")
      .do((x: { b: string }) => x.b + x.b)
      .writeTo("c");

    const app = new Pregel({
      nodes: { node1, node2 },
      channels: {
        a: new EphemeralValue<string>(),
        b: new EphemeralValue<string>(),
        c: new Topic<string>({ accumulate: true }),
      },
      inputChannels: ["a"],
      outputChannels: ["c"],
    });

    await app.invoke({ a: "foo" });
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    { c: ['foofoo', 'foofoofoofoo'] }
    ```
  </Tab>

  <Tab title="BinaryOperatorAggregate">
    这个例子演示了如何使用[⟦T27⟧](https://reference.langchain.com/javascript/langchain-langgraph/channels/BinaryOperatorAggregate)通道来实现reducer。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { EphemeralValue, BinaryOperatorAggregate } from "@langchain/langgraph/channels";
    import { Pregel, NodeBuilder } from "@langchain/langgraph/pregel";

    const node1 = new NodeBuilder()
      .subscribeOnly("a")
      .do((x: string) => x + x)
      .writeTo("b", "c");

    const node2 = new NodeBuilder()
      .subscribeOnly("b")
      .do((x: string) => x + x)
      .writeTo("c");

    const reducer = (current: string, update: string) => {
      if (current) {
        return current + " | " + update;
      } else {
        return update;
      }
    };

    const app = new Pregel({
      nodes: { node1, node2 },
      channels: {
        a: new EphemeralValue<string>(),
        b: new EphemeralValue<string>(),
        c: new BinaryOperatorAggregate<string>({ operator: reducer }),
      },
      inputChannels: ["a"],
      outputChannels: ["c"],
    });

    await app.invoke({ a: "foo" });
    ```
  </Tab>

  <Tab title="Cycle">
    此示例演示了如何在图中引入循环，方法是：
    链写入其订阅的频道。执行将继续
    直到`null`值写入通道。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { EphemeralValue } from "@langchain/langgraph/channels";
    import { Pregel, NodeBuilder, ChannelWriteEntry } from "@langchain/langgraph/pregel";

    const exampleNode = new NodeBuilder()
      .subscribeOnly("value")
      .do((x: string) => x.length < 10 ? x + x : null)
      .writeTo(new ChannelWriteEntry("value", { skipNone: true }));

    const app = new Pregel({
      nodes: { exampleNode },
      channels: {
        value: new EphemeralValue<string>(),
      },
      inputChannels: ["value"],
      outputChannels: ["value"],
    });

    await app.invoke({ value: "a" });
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    { value: 'aaaaaaaaaaaaaaaa' }
    ```
  </Tab>
</Tabs>

## 高级 API

LangGraph 提供了两个用于创建 Pregel 应用程序的高级 API：[StateGraph (Graph API)](/oss/javascript/langgraph/graph-api) 和 [Functional API](/oss/javascript/langgraph/functional-api)。

<Tabs>
  <Tab title="StateGraph (Graph API)">
    [StateGraph (Graph API)](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 是一个更高级别的抽象，可以简化 Pregel 应用程序的创建。它允许您定义节点和边的图。当您编译图时，StateGraph API 会自动为您创建 Pregel 应用程序。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { START, StateGraph } from "@langchain/langgraph";

    interface Essay {
      topic: string;
      content?: string;
      score?: number;
    }

    const writeEssay = (essay: Essay) => {
      return {
        content: `Essay about ${essay.topic}`,
      };
    };

    const scoreEssay = (essay: Essay) => {
      return {
        score: 10
      };
    };

    const builder = new StateGraph<Essay>({
      channels: {
        topic: null,
        content: null,
        score: null,
      }
    })
      .addNode("writeEssay", writeEssay)
      .addNode("scoreEssay", scoreEssay)
      .addEdge(START, "writeEssay")
      .addEdge("writeEssay", "scoreEssay");

    // Compile the graph.
    // This will return a Pregel instance.
    const graph = builder.compile();
    ```

    编译后的 Pregel 实例将与节点和通道列表相关联。您可以通过打印来检查节点和通道。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    console.log(graph.nodes);
    ```

    你会看到这样的东西：

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      __start__: PregelNode { ... },
      writeEssay: PregelNode { ... },
      scoreEssay: PregelNode { ... }
    }
    ```

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    console.log(graph.channels);
    ```

    你应该看到这样的东西

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    {
      topic: LastValue { ... },
      content: LastValue { ... },
      score: LastValue { ... },
      __start__: EphemeralValue { ... },
      writeEssay: EphemeralValue { ... },
      scoreEssay: EphemeralValue { ... },
      'branch:__start__:__self__:writeEssay': EphemeralValue { ... },
      'branch:__start__:__self__:scoreEssay': EphemeralValue { ... },
      'branch:writeEssay:__self__:writeEssay': EphemeralValue { ... },
      'branch:writeEssay:__self__:scoreEssay': EphemeralValue { ... },
      'branch:scoreEssay:__self__:writeEssay': EphemeralValue { ... },
      'branch:scoreEssay:__self__:scoreEssay': EphemeralValue { ... },
      'start:writeEssay': EphemeralValue { ... }
    }
    ```
  </Tab><Tab title="Functional API">
    在[Functional API](/oss/javascript/langgraph/functional-api)中，您可以使用[⟦T29⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/entrypoint)来创建Pregel应用程序。 `entrypoint` 装饰器允许您定义一个接受输入并返回输出的函数。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { MemorySaver } from "@langchain/langgraph";
    import { entrypoint } from "@langchain/langgraph/func";

    interface Essay {
      topic: string;
      content?: string;
      score?: number;
    }

    const checkpointer = new MemorySaver();

    const writeEssay = entrypoint(
      { checkpointer, name: "writeEssay" },
      async (essay: Essay) => {
        return {
          content: `Essay about ${essay.topic}`,
        };
      }
    );

    console.log("Nodes: ");
    console.log(writeEssay.nodes);
    console.log("Channels: ");
    console.log(writeEssay.channels);
    ```

    ```console theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    Nodes:
    { writeEssay: PregelNode { ... } }
    Channels:
    {
      __start__: EphemeralValue { ... },
      __end__: LastValue { ... },
      __previous__: LastValue { ... }
    }
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