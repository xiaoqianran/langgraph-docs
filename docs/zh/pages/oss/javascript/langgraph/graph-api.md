<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Graph API overview | https://docs.langchain.com/oss/javascript/langgraph/graph-api -->

## 图表

其核心是，LangGraph 将代理工作流程建模为图表。您可以使用三个关键组件来定义代理的行为：

1. [⟦T47⟧](#state)：表示应用程序当前快照的共享数据结构。它可以是任何数据类型，但通常使用共享状态模式定义。

2. [⟦T48⟧](#nodes)：对代理逻辑进行编码的函数。它们接收当前状态作为输入，执行一些计算或副作用，并返回更新的状态。

3. [⟦T49⟧](#edges)：根据当前状态决定接下来执行哪个`Node`的函数。它们可以是条件分支或固定转换。

通过组合 `Nodes` 和 `Edges`，您可以创建复杂的循环工作流程，这些工作流程会随着时间的推移而演变状态。然而，真正的力量来自于LangGraph如何管理该状态。

强调一下：`Nodes`和`Edges`只不过是函数——它们可以包含LLM或只是好的代码。

简而言之：*节点完成工作，边缘告诉下一步做什么*。LangGraph的底层图算法使用[message passing](https://en.wikipedia.org/wiki/Message_passing)定义通用程序。当节点完成其操作时，它会沿着一条或多条边向其他节点发送消息。然后，这些接收节点执行其功能，将结果消息传递给下一组节点，然后该过程继续。受 Google [Pregel](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) 系统的启发，该程序以离散的“超级步骤”进行。

超级步骤可以被认为是图节点上的单次迭代。并行运行的节点是同一超级步骤的一部分，而顺序运行的节点则属于单独的超级步骤。在图执行开始时，所有节点都以 `inactive` 状态开始。当节点在其任何传入边缘（或“通道”）上接收到新消息（状态）时，它就会变成`active`。然后，活动节点运行其功能并以更新进行响应。在每个超级步骤结束时，没有传入消息的节点通过将自己标记为`inactive`来投票给`halt`。当所有节点都为 `inactive` 并且没有消息在传输时，图执行终止。

### 状态图

[⟦T60⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 类是要使用的主要图形类。这是由用户定义的 `State` 对象参数化的。

### 编译你的图表要构建图表，首先定义 [state](#state)，然后添加 [nodes](#nodes) 和 [edges](#edges)，然后编译它。到底是什么在编译你的图表以及为什么需要它？

编译是一个非常简单的步骤。它提供了对图形结构的一些基本检查（没有孤立节点等）。您还可以在其中指定运行时参数，例如 [checkpointers](/oss/javascript/langgraph/persistence) 和断点。您只需调用 `.compile` 方法即可编译图表：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const graph = new StateGraph(StateAnnotation)
  .addNode("nodeA", nodeA)
  .addEdge(START, "nodeA")
  .addEdge("nodeA", END)
  .compile();
```

<Warning>
  您**必须**先编译您的图表，然后才能使用它。
</Warning>

## 状态

定义图时要做的第一件事是定义图的`State`。 `State` 由 [schema of the graph](#schema) 和 [⟦T65⟧ functions](#reducers) 组成，它们指定如何将更新应用于状态。 `State` 的模式将是图中所有 `Nodes` 和 `Edges` 的输入模式。您可以使用 `StateSchema` 类定义状态，该类接受单个字段的任何 [standard schemas](https://standardschema.dev/)（如 [Zod](https://zod.dev/)）以及特殊值类型（如 `ReducedValue` 和 `MessagesValue`）。所有 `Nodes` 都会向 `State` 发出更新，然后使用指定的 `reducer` 函数应用这些更新。

### 架构

指定图模式的主要方法是使用 `StateSchema` 类。架构中的每个字段可以是：* 简单字段的 **标准模式** （成为更新时覆盖的“最后值”通道）
* A **`ReducedValue`** 用于需要自定义reducer函数的字段（当节点并行运行时）
* 用于聊天消息列表的 **`MessagesValue`** （使用消息感知缩减器预先构建）
* **`UntrackedValue`** 用于不应设置检查点的瞬态

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateSchema,
  ReducedValue,
  MessagesValue,
  UntrackedValue
} from "@langchain/langgraph";
import { z } from "zod/v4";

const AgentState = new StateSchema({
  // Prebuilt messages value with built-in reducer
  messages: MessagesValue,

  // Simple fields use Zod schemas directly
  currentStep: z.string(),

  // Fields with defaults
  retryCount: z.number().default(0),

  // Custom reducer for accumulating values
  allSteps: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.string(),
      reducer: (current, newStep) => [...current, newStep],
    }
  ),

  // Transient state not saved to checkpoints
  tempCache: new UntrackedValue(z.record(z.string(), z.unknown())),
});

// Type extraction
type State = typeof AgentState.State;   // Full state type
type Update = typeof AgentState.Update; // Partial update type

// Use in graph
const graph = new StateGraph(AgentState)
  .addNode("myNode", ...)
  .compile();
```

默认情况下，图表将具有相同的输入和输出模式。如果你想改变这一点，你也可以直接指定显式的输入和输出模式。当您有很多键并且其中一些键明确用于输入而其他键明确用于输出时，这非常有用。

#### 多个模式

通常，所有图节点都与单个模式通信。这意味着它们将读取和写入相同的状态通道。但是，在某些情况下我们希望对此有更多的控制：

* 内部节点可以传递图的输入/输出中不需要的信息。
* 我们可能还想对图表使用不同的输入/输出模式。例如，输出可能仅包含单个相关输出键。可以让节点写入图中的私有状态通道以进行内部节点通信。我们可以简单地定义一个私有模式，`PrivateState`。

还可以为图定义显式的输入和输出模式。在这些情况下，我们定义一个“内部”模式，其中包含与图操作相关的*所有*键。但是，我们还定义了 `input` 和 `output` 模式，它们是“内部”模式的子集，用于约束图的输入和输出。有关更多详细信息，请参阅[Define input and output schemas](/oss/javascript/langgraph/use-graph-api#define-input-and-output-schemas)。

让我们看一个例子：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const InputState = new StateSchema({
  userInput: z.string(),
});

const OutputState = new StateSchema({
  graphOutput: z.string(),
});

const OverallState = new StateSchema({
  foo: z.string(),
  userInput: z.string(),
  graphOutput: z.string(),
});

const PrivateState = new StateSchema({
  bar: z.string(),
});

const graph = new StateGraph({
  state: OverallState,
  input: InputState,
  output: OutputState,
})
  .addNode("node1", (state) => {
    // Write to OverallState
    return { foo: state.userInput + " name" };
  })
  .addNode("node2", (state) => {
    // Read from OverallState, write to PrivateState
    return { bar: state.foo + " is" };
  })
  .addNode(
    "node3",
    (state) => {
      // Read from PrivateState, write to OutputState
      return { graphOutput: state.bar + " Lance" };
    },
    { input: PrivateState },
  )
  .addEdge(START, "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .addEdge("node3", END)
  .compile();

await graph.invoke({ userInput: "My" });
// { graphOutput: 'My name is Lance' }
```

这里有两个微妙而重要的点需要注意：

1. 我们将`state`作为输入模式传递给`node1`。但是，我们写入`foo`，`OverallState` 中的一个通道。我们如何写入不包含在输入模式中的状态通道？这是因为节点*可以写入图状态中的任何状态通道。*图状态是初始化时定义的状态通道的并集，其中包括`OverallState`以及过滤器`InputState`和`OutputState`。2. 我们用`StateGraph({ state: OverallState, input: InputState, output: OutputState })`初始化图。我们如何在`node2`中写入`PrivateState`？如果未在 `StateGraph` 初始化中传递该架构，那么该图如何访问该架构？我们可以这样做，因为只要状态模式定义存在，*节点也可以声明额外的状态通道*。在这种情况下，定义了`PrivateState`模式，因此我们可以将`bar`添加为图中的新状态通道并写入它。

<Warning>
  **私人频道在流式传输时不会被编辑。**

  输入、输出和私有模式限制每个节点*读取*（其输入模式）和`invoke`*返回*（输出模式）的内容。他们**不会**隐藏`stream`的频道。

  当您使用 `streamMode: "values"` 进行流式传输时，图表默认会发出其**所有**状态通道（包括私有通道），因为值流式传输默认为完整的状态通道集而不是输出模式。这就是为什么像 `bar` 这样的私人频道被 `invoke` 隐藏，但在流式传输时可见：

  ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
  import * as z from "zod";

  const InputState = new StateSchema({
    userInput: z.string(),
  });

  const OutputState = new StateSchema({
    graphOutput: z.string(),
  });

  const OverallState = new StateSchema({
    foo: z.string(),
    userInput: z.string(),
    graphOutput: z.string(),
  });

  const PrivateState = new StateSchema({
    bar: z.string(),
  });

  const graph = new StateGraph({
    state: OverallState,
    input: InputState,
    output: OutputState,
  })
    .addNode("node1", (state) => {
      return { foo: state.userInput + " name" };
    })
    .addNode("node2", (state) => {
      return { bar: state.foo + " is" };
    })
    .addNode(
      "node3",
      (state) => {
        return { graphOutput: state.bar + " Lance" };
      },
      { input: PrivateState },
    )
    .addEdge(START, "node1")
    .addEdge("node1", "node2")
    .addEdge("node2", "node3")
    .addEdge("node3", END)
    .compile();

  const stream = await graph.streamEvents({ userInput: "My" }, { version: "v3" });
  for await (const snapshot of stream.values) {
    console.log(snapshot);
  }
  // { userInput: 'My' }
  // { foo: 'My name', userInput: 'My' }
  // { foo: 'My name', userInput: 'My', bar: 'My name is' }            // <-- private channel
  // { foo: 'My name', userInput: 'My', graphOutput: 'My name is Lance', bar: 'My name is' }
  ```

  要将流式传输的值限制为一组特定的通道（例如，仅输出模式），请传递 `outputKeys`：

  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const stream = await graph.streamEvents(
    { userInput: "My" },
    { version: "v3", outputKeys: ["graphOutput"] }  // [!code highlight]
  );
  for await (const snapshot of stream.values) {
    console.log(snapshot);
  }
  // { graphOutput: 'My name is Lance' }
  ```如果您只需要节点实际每一步产生的通道（而不是完整的累积状态），请改用`streamMode: "updates"`。
</Warning>

### 减速器

减速器是理解节点更新如何应用于`State`的关键。 `State`中的每个按键都有自己独立的减速器功能。如果没有显式指定减速器函数，则假定对该键的所有更新都应覆盖它。有几种不同类型的减速器，从默认类型的减速器开始：

#### 减速器参数

每个减速器都是一个具有两个位置参数的二元函数：

* **左参数**：当前值已存储在该键的状态中。
* **右参数**：节点返回的键的更新。

当节点返回部分更新时，LangGraph为每个更新的键调用reducer并将返回值保存为新的状态值：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const newValue = reducer(currentState[key], nodeUpdate[key]); // left, right
```

左边的参数总是来自累积状态。正确的论点始终来自最新的节点更新。以下示例明确命名两个参数：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  tags: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      reducer: (left: string[], right: string[]) => {
        // left: existing state; right: update from a node
        return left.concat(right);
      },
    }
  ),
});
```

假设状态为`{ tags: ["draft"] }`，节点返回`{ tags: ["review"] }`。 LangGraph 拨打：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const reducer = (left: string[], right: string[]) => left.concat(right);

reducer(["draft"], ["review"]); // left, right → ["draft", "review"]
```

`tags` 的新状态值为 `["draft", "review"]`。自定义减速器结合了左右参数。 [default reducer](#default-reducer) 丢弃左侧参数并仅保留右侧参数。

#### 默认减速器

默认的reducer会忽略左边的参数并用右边的参数替换状态值。这个例子展示了如何使用默认的reducer：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.number(),
  bar: z.array(z.string()),
});
```

在此示例中，没有为任何键指定减速器函数。我们假设图表的输入是：

`{ foo: 1, bar: ["hi"] }`。然后我们假设第一个 `Node` 返回 `{ foo: 2 }`。这被视为对状态的更新。请注意，`Node` 不需要返回整个 `State` 模式 - 只需要更新即可。应用此更新后，`State` 将变为 `{ foo: 2, bar: ["hi"] }`。如果第二个节点返回`{ bar: ["bye"] }`，则`State`将是`{ foo: 2, bar: ["bye"] }`

#### 定制减速器

自定义化简器组合左右参数，而不是替换状态值，这对于累积值很有用，例如将更新附加到列表。此示例显示如何指定自定义减速器：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  foo: z.number(),
  bar: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
});
```在此示例中，我们使用 `ReducedValue` 为第二个键 (`bar`) 指定减速器函数。请注意，第一个键保持不变。我们假设图的输入是`{ foo: 1, bar: ["hi"] }`。然后我们假设第一个 `Node` 返回 `{ foo: 2 }`。这被视为对状态的更新。请注意，`Node` 不需要返回整个 `State` 模式 - 只需要更新即可。应用此更新后，`State` 将变为 `{ foo: 2, bar: ["hi"] }`。如果第二个节点返回`{ bar: ["bye"] }`，则`State`将是`{ foo: 2, bar: ["hi", "bye"] }`。请注意，`bar` 键是通过将两个数组连接在一起来更新的。

### 未跟踪的值

`UntrackedValue` 用于在图执行期间应该存在但不应该被设置检查点的状态字段。当图表从检查点恢复时，未跟踪的值将重置为其初始状态（或不可用）。

这对于：

* **无法序列化的数据库连接**
* **临时缓存** 应在恢复时重建
* **你不想持久化的大对象**
* **仅运行时配置** 每次都应新鲜传递

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, UntrackedValue, MessagesValue } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  messages: MessagesValue,

  // Untracked: throws if multiple nodes write in same step (guard: true is default)
  dbConnection: new UntrackedValue<DatabaseConnection>(),

  // Untracked with guard: false allows multiple writes, keeps last value
  tempCache: new UntrackedValue(
    z.record(z.string(), z.unknown()),
    { guard: false }
  ),

  // Untracked without a schema (for maximum flexibility)
  runtimeConfig: new UntrackedValue(),
});
```

**行为：*** 执行期间：像正常状态一样存储和访问值
* 在检查点：未跟踪的值从检查点数据中**排除**
* 恢复时：未跟踪的值重新开始（空或使用默认值）
* 使用`guard: true`（默认）：如果多个节点在同一步骤中写入，则会抛出错误
* 使用`guard: false`：允许多次写入，最后一个值获胜

<Warning>
  不要将 `UntrackedValue` 用于需要在中断或时间旅行中保留的数据。使用常规状态字段或`ReducedValue`来存储持久数据。
</Warning>

### 类型实用程序

LangGraph 提供了多种类型实用程序，以便在定义节点和条件边时实现更好的 TypeScript 类型安全性。

#### `GraphNode`

使用 `GraphNode` 键入在图形生成器外部定义的节点函数：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { GraphNode, StateSchema, Command } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  count: z.number().default(0),
  result: z.string(),
});

// Basic node - receives state, returns partial update
const incrementNode: GraphNode<typeof State> = (state) => {
  return { count: state.count + 1 };
};

// Async node
const fetchNode: GraphNode<typeof State> = async (state, config) => {
  const response = await fetch(`/api/data/${state.count}`);
  return { result: await response.text() };
};

// Node with Command routing - specify valid destinations
const routerNode: GraphNode<{ InputSchema: typeof State; Nodes: "process" | "done" }> = (state) => {
  if (state.count >= 10) {
    return new Command({ goto: "done" });
  }
  return new Command({
    update: { count: state.count + 1 },
    goto: "process"
  });
};
```

#### `State.Node` 简写

每个 `StateSchema` 实例都有一个 `Node` 属性，它提供了键入节点的简写：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const State = new StateSchema({
  messages: MessagesValue,
  step: z.string(),
});

// These are equivalent:
const myNode1: GraphNode<typeof State> = (state) => ({ step: "done" });
const myNode2: typeof State.Node = (state) => ({ step: "done" });
```

#### `ConditionalEdgeRouter`

使用`ConditionalEdgeRouter`作为条件边中的路由函数（没有状态更新，只是路由）：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ConditionalEdgeRouter, END } from "@langchain/langgraph";

const State = new StateSchema({
  shouldContinue: z.boolean(),
  step: z.string(),
});

// Router returns node name(s) or END
const router: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "process" | "summarize" }> = (state) => {
  if (!state.shouldContinue) {
    return END;
  }
  return state.step === "initial" ? "process" : "summarize";
};

// Use in graph
graph.addConditionalEdges("check", router);
```

#### `StateSchema.State` 和 `StateSchema.Update`

从架构中提取状态和更新类型以用于自定义类型定义：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema } from "@langchain/langgraph";

const MyStateSchema = new StateSchema({
  messages: MessagesValue,
  count: z.number().default(0),
});

// Extract the full state type
type MyState = typeof MyStateSchema.State;
// { messages: BaseMessage[], count: number }

// Extract the update type (partial, with reducer input types)
type MyUpdate = typeof MyStateSchema.Update;
// { messages?: Messages, count?: number }
```

### 在图形状态下处理消息

#### 为什么要使用消息？大多数现代法学硕士提供商都有一个聊天模型界面，接受消息列表作为输入。 LangChain 的 [chat model interface](/oss/javascript/langchain/models) 特别接受消息对象列表作为输入。这些消息有多种形式，例如[⟦T145⟧](https://reference.langchain.com/javascript/langchain-core/messages/HumanMessage)（用户输入）或[⟦T146⟧](https://reference.langchain.com/javascript/langchain-core/messages/AIMessage)（LLM 响应）。

要了解有关消息对象的更多信息，请参阅[Messages conceptual guide](/oss/javascript/langchain/messages)。

#### 在图表中使用消息

在许多情况下，将先前的对话历史记录存储为图形状态中的消息列表会很有帮助。为此，您可以使用预构建的 `MessagesValue`，它提供了一个消息感知减速器，可以自动处理消息 ID、更新和删除。

`MessagesValue` 减速器对于告诉图如何在每次状态更新时更新状态中的 `Message` 对象列表至关重要。如果您不指定减速器，则每次状态更新都会用最近提供的值覆盖消息列表。 `MessagesValue` 正确处理此问题：对于全新消息，它会附加到现有列表，对于现有消息（通过 ID 匹配），它会就地更新它们。<Tip>`MessagesValue` 实际上是 `ReducedValue` 的特例，预先配置了内部 `messagesStateReducer` 来处理消息列表和更新。这为 LangGraph 图中的聊天消息历史记录提供了方便的消息感知状态管理。</Tip>

#### 序列化

除了跟踪消息 ID 之外，每当在 `messages` 通道上收到状态更新时，`MessagesValue` 还会尝试将消息反序列化为 LangChain `Message` 对象。这允许以以下格式发送图形输入/状态更新：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// this is supported
{
  messages: [new HumanMessage("message")];
}

// and this is also supported
{
  messages: [{ role: "human", content: "message" }];
}
```

由于使用 `MessagesValue` 时状态更新总是反序列化为 LangChain `Messages`，因此您应该使用点表示法来访问消息属性，例如 `state.messages.at(-1).content`。下面是使用 `MessagesValue` 的图表示例：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, MessagesValue } from "@langchain/langgraph";

const State = new StateSchema({
  messages: MessagesValue,
});

const graph = new StateGraph(State)
  ...
```

`messages` 字段定义为 `MessagesValue`，它是具有内置缩减器的 [⟦T163⟧](https://reference.langchain.com/javascript/langchain-core/messages/BaseMessage) 对象的列表。通常，需要跟踪的状态不仅仅是消息，因此我们看到人们扩展了此状态并添加了更多字段，例如：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: MessagesValue,
  documents: z.array(z.string()),
});
```

## 节点

在 LangGraph 中，节点通常是接受以下参数的函数（同步或异步）：1. `state`—图的[state](#state)
2. `config`—包含`thread_id`等配置信息和`tags`等跟踪信息的[⟦T166⟧](https://reference.langchain.com/javascript/langchain-core/runnables/RunnableConfig)对象

您可以使用 `addNode` 方法将节点添加到图中。为了获得更好的类型安全性，请使用 `GraphNode` 类型实用程序或 `State.Node` 来键入节点函数：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  input: z.string(),
  results: z.string(),
});

// Option 1: Use GraphNode type utility
const myNode: GraphNode<typeof State> = (state, config) => {
  console.log("In node: ", config?.configurable?.user_id);
  return { results: `Hello, ${state.input}!` };
};

// Option 2: Use State.Node shorthand
const otherNode: typeof State.Node = (state) => {
  return state;
};

const builder = new StateGraph(State)
  .addNode("myNode", myNode)
  .addNode("otherNode", otherNode)
  ...
```

在幕后，函数会转换为 [⟦T172⟧](https://reference.langchain.com/javascript/langchain-core/runnables/RunnableLambda)，这会与 [native tracing and debugging](/langsmith/observability) 一起为您的函数添加批处理和异步支持。

如果将节点添加到图中而不指定名称，则会为其指定一个与函数名称等效的默认名称。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.addNode(myNode);
// You can then create edges to/from this node by referencing it as `"myNode"`
```

### 重执行和幂等性

当您使用 [checkpointer](/oss/javascript/langgraph/persistence) 进行编译时，LangGraph 将检查点保存在 [super-step](#graphs) 边界，而不是节点内的中间函数。如果执行停止并稍后恢复（例如在 [interrupt](/oss/javascript/langgraph/interrupts) 或重试之后），受影响的 **节点** 从其功能开始时再次运行。暂停之前的代码和副作用再次运行。

**幂等性。**设计**节点**逻辑，以便重新执行不会破坏状态。如果节点插入数据库行，则运行两次不应创建重复行，除非是故意的。使用幂等键、更新插入或先读后写检查。有关`interrupt()`周围的效果，请参阅[Side effects called before ⟦T174⟧ must be idempotent](/oss/javascript/langgraph/interrupts#side-effects-called-before-interrupt-must-be-idempotent)。**图形更改。** [Determinism](/oss/javascript/langgraph/functional-api#determinism) 有关代码更改的规则不适用于图形结构。您可以添加或删除**节点**和边，而不会破坏现有线程的恢复。恢复的运行使用保存的状态并执行您现在编译的任何图形。

**节点内的任务和中断。** 如果 **节点** 调用 [**tasks**](/oss/javascript/langgraph/functional-api#task) 或 [⟦T175⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)，则在恢复时应用更严格的确定性规则。 LangGraph 从检查点恢复已完成的 **任务** 结果，但在恢复点之前更改代码中的 **任务** 或 [⟦T176⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 顺序可能会与缓存的值不匹配。 [Functional API](/oss/javascript/langgraph/functional-api) **入口点** 编译为单个 **节点**，以这种方式运行整个入口点方法。请参阅 [Determinism](/oss/javascript/langgraph/functional-api#determinism)、[Idempotency](/oss/javascript/langgraph/functional-api#idempotency) 和 [Using tasks in nodes](#using-tasks-in-nodes)。

### 在节点中使用任务

如果 [node](#nodes) 包含多个操作，您可能会发现将每个操作实现为 [**task**](/oss/javascript/langgraph/functional-api#task) 比将逻辑拆分到多个节点更容易。当图表使用检查点时，任务结果会被设置检查点，因此恢复线程可以跳过节点内已完成的**任务**工作。

<Tabs>
  <Tab title="Original">
    ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import * as z from "zod";

    import {
      END,
      MemorySaver,
      START,
      StateGraph,
      StateSchema,
    } from "@langchain/langgraph";
    import type { GraphNode } from "@langchain/langgraph";

    const State = new StateSchema({
      url: z.string(),
      result: z.string().optional(),
    });

    const callApi: GraphNode<typeof State> = async (state) => {
      const response = await fetch(state.url); // [!code highlight]
      const text = await response.text();
      const result = text.slice(0, 100);
      return { result };
    };

    const builder = new StateGraph(State)
      .addNode("callApi", callApi)
      .addEdge(START, "callApi")
      .addEdge("callApi", END);

    const checkpointer = new MemorySaver();
    const graph = builder.compile({ checkpointer });

    const threadId = crypto.randomUUID();
    const config = { configurable: { thread_id: threadId } };

    await graph.invoke({ url: "https://www.example.com" }, config);
    ```
  </Tab>

  <Tab title="With task">
    ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import * as z from "zod";

    import {
      END,
      MemorySaver,
      START,
      StateGraph,
      StateSchema,
      task,
    } from "@langchain/langgraph";
    import type { GraphNode } from "@langchain/langgraph";

    const State = new StateSchema({
      urls: z.array(z.string()),
      results: z.array(z.string()).optional(),
    });

    const makeRequest = task("makeRequest", async (url: string) => {
      const response = await fetch(url); // [!code highlight]
      const text = await response.text();
      return text.slice(0, 100);
    });

    const callApi: GraphNode<typeof State> = async (state) => {
      const pending = state.urls.map((url) => makeRequest(url)); // [!code highlight]
      const results = await Promise.all(pending);
      return { results };
    };

    const builder = new StateGraph(State)
      .addNode("callApi", callApi)
      .addEdge(START, "callApi")
      .addEdge("callApi", END);

    const checkpointer = new MemorySaver();
    const graph = builder.compile({ checkpointer });

    const threadId = crypto.randomUUID();
    const config = { configurable: { thread_id: threadId } };

    await graph.invoke({ urls: ["https://www.example.com"] }, config);
    ```
  </Tab>
</Tabs>

### `START` 节点[⟦T178⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START) 节点是一个特殊节点，表示将用户输入发送到图表的节点。引用该节点的主要目的是确定应该首先调用哪些节点。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

graph.addEdge(START, "nodeA");
```

### `END` 节点

`END`节点是一个特殊的节点，代表终端节点。当您想要指示哪些边完成后没有任何操作时，将引用该节点。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END } from "@langchain/langgraph";

graph.addEdge("nodeA", END);
```

### 节点缓存

LangGraph 支持根据节点的输入缓存任务/节点。使用缓存：

* 编译图时指定缓存（或指定入口点）
* 指定节点的缓存策略。每个缓存策略支持：
  * `keyFunc`，用于根据节点的输入生成缓存键。
  * `ttl`，缓存的生存时间（以秒为单位）。如果不指定，缓存将永远不会过期。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START } from "@langchain/langgraph";
import { InMemoryCache } from "@langchain/langgraph-checkpoint";
import { z } from "zod/v4";

const State = new StateSchema({
  x: z.number(),
  result: z.number(),
});

const expensiveNode: GraphNode<typeof State> = async (state) => {
  // Simulate an expensive operation
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return { result: state.x * 2 };
};

const graph = new StateGraph(State)
  .addNode("expensive_node", expensiveNode, { cachePolicy: { ttl: 3 } })
  .addEdge(START, "expensive_node")
  .compile({ cache: new InMemoryCache() });

await graph.invoke({ x: 5 }, { streamMode: "updates" });   // [!code highlight]
// [{"expensive_node": {"result": 10}}]
await graph.invoke({ x: 5 }, { streamMode: "updates" });   // [!code highlight]
// [{"expensive_node": {"result": 10}, "__metadata__": {"cached": true}}]
```

## 边缘

边定义逻辑如何路由以及图形如何决定停止。这是代理如何工作以及不同节点如何相互通信的重要组成部分。有几种关键的边类型：* 普通边：直接从一个节点到下一个节点。
* 条件边：调用函数来确定下一个要转到哪个节点。
* 入口点：当用户输入到达时首先调用哪个节点。
* 条件入口点：调用函数来确定当用户输入到达时首先调用哪个节点。

一个节点可以有多个出边。如果一个节点有多个传出边缘，则所有这些目标节点将作为下一个超级步骤的一部分并行执行。

<Warning>
  对于每个节点，选择一种路由机制：使用普通边进行静态路由，或使用条件边/[⟦T183⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)进行动态路由。不要混合来自同一节点的普通边和动态路由，因为这两条路径都可以执行并使图行为更难以推理。
</Warning>

### 正常边缘

如果你**总是**想从节点A到节点B，你可以直接使用[⟦T184⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#addEdge)方法。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addEdge("nodeA", "nodeB");
```

### 条件边

如果您想**可选地**路由到一个或多个边缘（或可选地终止），您可以使用 [⟦T185⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#addConditionalEdges) 方法。此方法接受节点的名称和在该节点执行后调用的“路由函数”：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addConditionalEdges("nodeA", routingFunction);
```与节点类似，`routingFunction`接受图的当前`state`并返回一个值。

默认情况下，返回值`routingFunction`用作将状态发送到下一个的节点（或节点列表）的名称。所有这些节点将作为下一个超级步骤的一部分并行运行。

您可以选择提供一个对象，将 `routingFunction` 的输出映射到下一个节点的名称。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addConditionalEdges("nodeA", routingFunction, {
  true: "nodeB",
  false: "nodeC",
});
```

<Tip>
  如果您想将状态更新和路由合并在一个函数中，请使用 [⟦T190⟧](#command) 而不是条件边。
</Tip>

### 入口点

入口点是图启动时运行的第一个节点。您可以使用从虚拟[⟦T192⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START)节点到第一个要执行的节点的[⟦T191⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#addEdge)方法来指定从何处进入图形。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

graph.addEdge(START, "nodeA");
```

### 条件入口点

条件入口点可让您根据自定义逻辑从不同的节点开始。您可以使用虚拟 [⟦T194⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START) 节点中的 [⟦T193⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#addConditionalEdges) 来完成此操作。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

graph.addConditionalEdges(START, routingFunction);
```

您可以选择提供一个对象，将 `routingFunction` 的输出映射到下一个节点的名称。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addConditionalEdges(START, routingFunction, {
  true: "nodeB",
  false: "nodeC",
});
```

## `Send`By default, `Nodes` and `Edges` are defined ahead of time and operate on the same shared state.但是，在某些情况下，可能无法提前知道确切的边缘和/或您可能希望同时存在不同版本的 `State`。 A common example of this is with map-reduce design patterns. In this design pattern, a first node may generate a list of objects, and you may want to apply some other node to all those objects.对象的数量可能提前未知（意味着边的数量可能未知），并且下游`Node`的输入`State`应该不同（每个生成的对象一个）。

To support this design pattern, LangGraph supports returning [⟦T202⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Send) objects from conditional edges. `Send` takes two arguments: first is the name of the node, and second is the state to pass to that node.

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Send } from "@langchain/langgraph";

graph.addConditionalEdges("nodeA", (state) => {
  return state.subjects.map(
    (subject) => new Send("generateJoke", { subject })
  );
});
```

## `Command`

[⟦T205⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) is a versatile primitive for controlling graph execution.它接受四个参数：* `update`：应用状态更新（类似于从节点返回更新）。
* `goto`：导航到特定节点（类似于[conditional edges](#conditional-edges)）。
* `graph`：从 [subgraphs](/oss/javascript/langgraph/use-subgraphs) 导航时定位父图。
* `resume`：提供一个值以在[interrupt](/oss/javascript/langgraph/interrupts)之后恢复执行。

`Command` 用于三种情况：

* **[Return from nodes](#return-from-nodes)**：使用`update`、`goto`和`graph`将状态更新与控制流结合起来。
* **[Input to ⟦T214⟧ or ⟦T215⟧](#input-to-invoke-or-stream)**：使用`resume`在中断后继续执行。
* **[Return from tools](#return-from-tools)**：与从节点返回类似，将状态更新和工具内部的控制流结合起来。

### 从节点返回

#### `update` 和 `goto`

从节点函数返回[⟦T219⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)，以一步更新状态并路由到下一个节点：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

graph.addNode("myNode", (state) => {
  return new Command({
    update: { foo: "bar" },
    goto: "myOtherNode",
  });
});
```

使用[⟦T220⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)还可以实现动态控制流行为（与[conditional edges](#conditional-edges)相同）：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

graph.addNode("myNode", (state) => {
  if (state.foo === "bar") {
    return new Command({
      update: { foo: "baz" },
      goto: "myOtherNode",
    });
  }
});
```

当您需要**同时**更新状态**和**路由到不同的节点时，请使用[⟦T221⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)。如果您只需要路由而不更新状态，请改用[conditional edges](#conditional-edges)。

在节点函数中使用[⟦T222⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)时，您必须在添加节点时添加`ends`参数以指定它可以路由到哪些节点：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.addNode("myNode", myNode, {
  ends: ["myOtherNode", END],
});
```<Warning>
  [⟦T224⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 仅添加动态边 - 使用 `add_edge` / `addEdge` 定义的静态边仍然执行。例如，如果 `node_a` 返回 `Command(goto="my_other_node")` 并且您还有 `graph.add_edge("node_a", "node_b")`，则 `node_b` 和 `my_other_node` 都将运行。对于每个节点，使用 [⟦T232⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 或静态边来路由到下一个节点，而不是同时使用两者。
</Warning>

查看此 [how-to guide](/oss/javascript/langgraph/use-graph-api#combine-control-flow-and-state-updates-with-command)，了解如何使用 [⟦T233⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 的端到端示例。

#### `graph`

如果您使用 [subgraphs](/oss/javascript/langgraph/use-subgraphs)，则可以通过在 `Command` 中指定 `graph: Command.PARENT` 从子图中的节点导航到父图中的不同节点：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

graph.addNode("myNode", (state) => {
  return new Command({
    update: { foo: "bar" },
    goto: "otherSubgraph", // where `otherSubgraph` is a node in the parent graph
    graph: Command.PARENT,
  });
});
```

<Note>
  将 `graph` 设置为 `Command.PARENT` 将导航到最近的父图。

  当您将父图和子图[state schemas](#schema)共享的键的更新从子图节点发送到父图节点时，您**必须**为要在父图状态中更新的键定义一个[reducer](#reducers)。
</Note>

这在实现[multi-agent handoffs](/oss/javascript/langchain/multi-agent/handoffs)时特别有用。详情请查看[Navigate to a node in a parent graph](/oss/javascript/langgraph/use-graph-api#navigate-to-a-node-in-a-parent-graph)。

### 输入`invoke`或`stream`<Warning>
  `new Command({ resume: ... })` 是 **唯一** `Command` 模式，旨在作为 `invoke()`/`stream()` 的输入（可以选择与 `update` 组合，以便在恢复时也应用状态更改）。不要单独使用 `new Command({ update: ... })` 作为输入来继续多轮对话 - 因为传递任何 `Command` 作为输入会从最新的检查点（即运行的最后一步，而不是 `__start__`）恢复，如果已经完成，图表将显示为卡住。要在现有线程上继续对话，请传递一个普通输入对象：

  ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  // WRONG - graph resumes from the latest checkpoint
  // (last step that ran), appears stuck
  await graph.invoke(new Command({ update: { messages: [{ role: "user", content: "follow up" }] } }), config);  // [!code --]

  // CORRECT - plain object restarts from __start__
  await graph.invoke({ messages: [{ role: "user", content: "follow up" }] }, config);  // [!code ++]
  ```
</Warning>

#### `resume`

使用`new Command({ resume: ... })`提供一个值并在[interrupt](/oss/javascript/langgraph/interrupts)之后恢复图形执行。传递给 `resume` 的值成为暂停节点内 `interrupt()` 调用的返回值：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command, interrupt } from "@langchain/langgraph";

const humanReview = async (state: typeof StateAnnotation.State) => {
  // Pauses the graph and waits for a value
  const answer = interrupt("Do you approve?");
  return { messages: [{ role: "user", content: answer }] };
};

// First invocation - hits the interrupt and pauses
const result = await graph.invoke({ messages: [...] }, config);

// Resume with a value - the interrupt() call returns "yes"
const resumed = await graph.invoke(new Command({ resume: "yes" }), config);
```

查看 [interrupts conceptual guide](/oss/javascript/langgraph/interrupts) 了解中断模式的完整详细信息，包括多个中断和验证循环。

### 从工具返回

您可以从工具返回[⟦T253⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)来更新图状态和控制流。使用 `update` 修改状态（例如，保存在对话期间查找的客户信息），并使用 `goto` 在工具完成后路由到特定节点。<Warning>
  当在工具内部使用时，`goto` 添加动态边 - 调用该工具的节点上已定义的任何静态边仍将执行。对于每个节点，使用工具驱动的动态路由或静态边来路由到下一个节点，而不是同时使用两者。
</Warning>

详情请参阅[Use inside tools](/oss/javascript/langgraph/use-graph-api#use-inside-tools)。

## 图迁移

即使使用检查指针来跟踪状态，LangGraph也可以轻松处理图定义（节点、边和状态）的迁移。

* 对于图末尾的线程（即未中断），您可以更改图的整个拓扑（即所有节点和边、删除、添加、重命名等）
* 对于当前中断的线程，我们支持除重命名/删除节点之外的所有拓扑更改（因为该线程现在可能即将进入不再存在的节点）——如果这是一个阻止者，请与我们联系，我们可以优先考虑解决方案。
* 对于修改状态，我们对添加和删除键具有完全的向后和向前兼容性
* 重命名的状态键会丢失其在现有线程中保存的状态* 类型以不兼容方式更改的状态键目前可能会导致更改前线程状态出现问题 - 如果这是一个阻碍因素，请联系我们，我们可以优先考虑解决方案。

<Tip>
  对于技术上兼容但改变业务逻辑的更改，例如重写工具集或重组对话流程，请参阅[Business compatibility](/oss/javascript/langgraph/backward-compatibility#business-compatibility)。该页面介绍了将行为版本固定在状态中，以便现有线程保留旧路径，而新线程则选择最新版本。
</Tip>

## 运行时上下文

创建图时，您可以为传递给节点的运行时上下文指定 `contextSchema`。这对于通过很有用
向不属于图状态一部分的节点发送的信息。例如，您可能想要传递模型名称或数据库连接等依赖项。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  input: z.string(),
  output: z.string(),
});

const ContextSchema = z.object({
  llm: z.union([z.literal("openai"), z.literal("anthropic")]),
});

const graph = new StateGraph(State, ContextSchema);
```

然后，您可以使用 `context` 属性将此配置传递到图中。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const config = { context: { llm: "anthropic" } };

await graph.invoke(inputs, config);
```

然后，您可以在节点或条件边内访问和使用此上下文：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Runtime, GraphNode } from "@langchain/langgraph";
import * as z from "zod";

const nodeA: GraphNode<typeof State> = (state, config) => {
  const llm = getLLM(runtime.context?.llm);
  // ...
  return {};
};
```

有关配置的完整详细信息，请参阅[Add runtime configuration](/oss/javascript/langgraph/use-graph-api#add-runtime-configuration)。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addNode("myNode", (state, config) => {
  const llmType = config.context?.llm || "openai";
  const llm = getLLM(llmType);
  return { results: `Hello, ${state.input}!` };
});
```

### 递归限制递归限制设置了图在单次执行期间可以执行的最大数量 [super-steps](#graphs)。一旦达到限额，LangGraph将提高`GraphRecursionError`。默认情况下，该值设置为 25 步。递归限制可以在运行时在任何图上设置，并通过配置对象传递给`invoke`/`stream`。重要的是，`recursionLimit`是一个独立的`config`密钥，不应像所有其他用户定义的配置一样在`configurable`密钥内传递。请参阅下面的示例：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await graph.invoke(inputs, {
  recursionLimit: 5,
  context: { llm: "anthropic" },
});
```

### 访问和处理递归计数器

当前步计数器可在任何节点内的`config.metadata.langgraph_step`中访问，从而允许在达到递归限制之前进行主动递归处理。这使您能够在图形逻辑中实施优雅的降级策略。

#### 它是如何工作的

计步器存储在`config.metadata.langgraph_step`中。 LangGraph 在图形执行时递增此计数器，并在超出配置的 `recursionLimit` 时引发 `GraphRecursionError`。

#### 访问当前计步器

您可以访问任何节点内的当前步计数器以监控执行进度。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { RunnableConfig } from "@langchain/core/runnables";
import { StateGraph } from "@langchain/langgraph";

const myNode: GraphNode<typeof State> = async (state, config) => {
  const currentStep = config.metadata?.langgraph_step;
  console.log(`Currently on step: ${currentStep}`);
  return state;
}
```

设计具有显式终止条件的图表，并捕获 `GraphRecursionError` 作为安全网：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  ConditionalEdgeRouter,
  END,
  GraphRecursionError
} from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  messages: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
});

// Build graph with explicit termination logic
const graph = new StateGraph(State)
  .addNode("reasoning", async (state) => {
    // Normal processing - design your graph with explicit termination conditions
    return {
      messages: ["thinking..."]
    };
  })
  .addConditionalEdges("reasoning", (state) => {
    // Add your termination condition here
    if (state.messages.length >= 5) {
      return END;
    }
    return "reasoning";
  });

const app = graph.compile();

// Catch GraphRecursionError as a safety net
try {
  const result = await app.invoke(
    { messages: [] },
    { recursionLimit: 10 }
  );
} catch (error) {
  if (error instanceof GraphRecursionError) {
    console.log("Recursion limit reached, handling gracefully");
    // Handle the error - return partial results, notify user, etc.
  }
}
```

#### 主动与被动方法处理递归限制有两种主要方法：主动式（在图表内监控）和被动式（在外部捕获错误）。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  ConditionalEdgeRouter,
  END,
  GraphRecursionError
} from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  messages: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (x, y) => x.concat(y) }
  ),
});


// Build graph with explicit termination logic
const builder = new StateGraph(State)
  .addNode("agent", async (state) => {
    return {
      messages: ["Processing..."]
    };
  })
  .addConditionalEdges("agent", (state) => {
    // Design termination conditions into your graph
    if (state.messages.length >= 5) {
      return END;
    }
    return "agent";
  });

const graph = builder.compile();

// Reactive Approach - catch GraphRecursionError as safety net
try {
  const result = await graph.invoke(
    { messages: [] },
    { recursionLimit: 10 }
  );
} catch (error) {
  if (error instanceof GraphRecursionError) {
    // Handle externally after graph execution fails
    console.log("Recursion limit exceeded, handling gracefully");
  }
}
```

反应式方法在超出限制后捕获`GraphRecursionError`。使用明确的终止条件设计图表，以避免首先达到限制。

|方法|检测|处理|控制流程|
| ---------------------------------------------------- | -------------------- | -------------------------- | -------------------------- |
|反应式（捕捉`GraphRecursionError`）|超出限制后 | try/catch 中的外部图 |图形执行终止 |

**反应式优势：**

* 实现简单
* 无需修改图逻辑
* 集中错误处理

#### 其他可用元数据

除了 `langgraph_step` 之外，`config.metadata` 中还提供以下元数据：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const inspectMetadata: GraphNode<typeof State> = async (state, config) => {
  const metadata = config.metadata;

  console.log(`Step: ${metadata?.langgraph_step}`);
  console.log(`Node: ${metadata?.langgraph_node}`);
  console.log(`Triggers: ${metadata?.langgraph_triggers}`);
  console.log(`Path: ${metadata?.langgraph_path}`);
  console.log(`Checkpoint NS: ${metadata?.langgraph_checkpoint_ns}`);

  return state;
}
```

## 可视化

能够可视化图表通常是件好事，尤其是当它们变得更加复杂时。 LangGraph 带有多种内置的图表可视化方法。请参阅[Visualize your graph](/oss/javascript/langgraph/use-graph-api#visualize-your-graph)了解更多信息。

## 可观察性和追踪

要跟踪、调试和评估您的代理，请使用[LangSmith](/langsmith/observability)。

＃＃ 了解更多* [How to use the Graph API](/oss/javascript/langgraph/use-graph-api)
* [Functional API conceptual overview](/oss/javascript/langgraph/functional-api)
* [Choosing between Graph API and Functional API](/oss/javascript/langgraph/choosing-apis)

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>