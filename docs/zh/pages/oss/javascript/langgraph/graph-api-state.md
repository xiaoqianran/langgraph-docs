<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Define and update state | https://docs.langchain.com/oss/javascript/langgraph/graph-api-state -->

# 定义和更新状态

在 LangGraph Graph API 中定义图状态模式、reducer、消息和私有状态。

[State](/oss/javascript/langgraph/graph-api#state)是节点读写的共享模式。 [Reducers](/oss/javascript/langgraph/graph-api#reducers) 控制每次更新如何合并到当前值。此页面涵盖：

1. 如何使用状态来定义图的[schema](/oss/javascript/langgraph/graph-api#schema)
2. 如何使用reducers来控制状态更新的处理方式

## 定义状态

LangGraph中的[State](/oss/javascript/langgraph/graph-api#state)是用`StateSchema`类定义的。它接受单个字段的 [standard schemas](https://standardschema.dev/)（例如 [Zod](https://zod.dev/)），以及 `ReducedValue`、`MessagesValue` 和 `UntrackedValue` 等值类型。与 [legacy alternatives](#alternative-state-definitions) 相比，更喜欢 `StateSchema`。

默认情况下，图使用相同的模式进行输入和输出，并且状态决定该模式。有关不同的输入和输出模式，请参阅[Define input and output schemas](#define-input-and-output-schemas)。

从 [messages](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state) 字段开始。这种形状适合许多法学硕士申请。欲了解更多详情，请参阅[Working with messages in graph state](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state)。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: MessagesValue,
  extraField: z.number(),
});
```

此状态跟踪 [message](/oss/javascript/langchain/messages) 对象列表和一个额外的整数字段。 `MessagesValue`包含一个内置的reducer，因此节点只能返回要追加的新消息。

## 更新状态

使用单个 [node](/oss/javascript/langgraph/graph-api#nodes) 构建图表。该节点是一个 TypeScript 函数，用于读取图形状态并返回更新。第一个参数始终是状态：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { AIMessage } from "@langchain/core/messages";
import { GraphNode } from "@langchain/langgraph";

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 };
};
```该节点仅返回新消息。 `MessagesValue`减速器将其附加到现有列表并设置`extraField`。

> [!警告]
>
> 节点应该直接返回状态更新，而不是改变状态。

使用此节点定义一个简单的图。使用 [⟦T42⟧](/oss/javascript/langgraph/graph-api#stategraph) 作为在此状态下运行的图，然后使用 [⟦T43⟧](/oss/javascript/langgraph/graph-api#nodes) 填充该图：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge("__start__", "node")
  .compile();
```

LangGraph 提供用于可视化图形的内置实用程序。详情请参阅[Visualize your graph](/oss/javascript/langgraph/graph-api-visualize)。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await graph.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
```

```mermaid theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
%%{init:{'theme':'base','themeVariables':{'lineColor':'#40668D','primaryColor':'#E5F4FF','primaryTextColor':'#030710','primaryBorderColor':'#006DDD'}}}%%
flowchart LR
    startNode([START]) --> n[node]

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class n process
    class startNode terminal
```

该图执行单个节点。调用它：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { HumanMessage } from "@langchain/core/messages";

const result = await graph.invoke({
  messages: [new HumanMessage("Hi")],
  extraField: 0,
});
console.log(result);
```

```
{ messages: [HumanMessage { content: 'Hi' }, AIMessage { content: 'Hello!' }], extraField: 10 }
```

请注意：

* 通过更新状态的单个键开始调用。
* 调用结果包含整个状态。

通过记录检查[message](/oss/javascript/langchain/messages)内容：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

## 使用减速器处理状态更新

状态中的每个键都可以有自己的[reducer](/oss/javascript/langgraph/graph-api#reducers)函数，该函数控制如何应用节点的更新。如果未指定reducer，则对该键的更新将替换以前的值。

前面的示例已经使用了`MessagesValue`，其中包含一个内置的减速器。对于自定义字段，使用 `ReducedValue` 定义如何应用更新。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

// MessagesValue already has a built-in reducer
const State = new StateSchema({
  messages: MessagesValue, // [!code highlight]
  extraField: z.number(),
});
```

节点只返回新消息；减速器附加它：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { GraphNode } from "@langchain/langgraph";

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 }; // [!code highlight]
};
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge(START, "node")
  .compile();

const result = await graph.invoke({ messages: [new HumanMessage("Hi")] });

for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

### 消息值在实践中，消息列表需要的不仅仅是简单的串联：

* 通过 ID 更新状态中的现有消息。
* 接受简写[message formats](/oss/javascript/langgraph/graph-api#serialization)，例如`{ role: "user", content: "..." }`。

`MessagesValue` 是一个带有消息感知减速器的字段助手，可以处理这些情况：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, StateGraph, MessagesValue, GraphNode, START } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({ // [!code highlight]
  messages: MessagesValue,
  extraField: z.number(),
});

const node: GraphNode<typeof State> = (state) => {
  const newMessage = new AIMessage("Hello!");
  return { messages: [newMessage], extraField: 10 };
};

const graph = new StateGraph(State)
  .addNode("node", node)
  .addEdge(START, "node")
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const inputMessage = { role: "user", content: "Hi" }; // [!code highlight]

const result = await graph.invoke({ messages: [inputMessage] });

for (const message of result.messages) {
  console.log(`${message.getType()}: ${message.content}`);
}
```

```
human: Hi
ai: Hello!
```

此形状适合使用[chat models](/oss/javascript/langchain/models)的应用。与 Python 的 `MessagesState` 类不同，TypeScript 没有单独的预构建状态类型：将 `MessagesValue` 放在 `StateSchema` 的 `messages` 字段上，如上面的示例所示。

## 重置reducer字段

减速器常见的混淆来源是，使用合并减速器时，返回空值不会清除字段。减速器将右侧参数合并到左侧参数中，因此合并了一个空更新，并保留了先前累积的值。

此模式对于必须在重试尝试之间清除的错误缓冲区或重试计数器很重要：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (state: string[], update: string[]) => state.concat(update) },
  ),
});

// node A returns { errors: ["bad sql"] }
// node B returns { errors: [] }
// state.errors is still ["bad sql"]; the empty array is merged in, not cleared
```

> [卡][View example trace](https://smith.langchain.com/public/4eafb2c7-d0bc-431c-9616-3efc73a43a46/r)
>
> 为此示例打开公共 LangSmith 运行。

要让节点重置（清除）字段，请定义一个自定义化简器来替换累积值而不是合并它：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (_state: string[], update: string[]) => update }
  ),
});

// node can now clear the field with { errors: [] }
```

> [卡][View example trace](https://smith.langchain.com/public/9a3650c7-8f46-4cb6-b05c-120ca7009ca7/r)
>
> 为此示例打开公共 LangSmith 运行。或者，使用 `Overwrite` 包装更新以绕过单个更新的减速器，同时为每个其他更新保留字段的正常合并行为：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Overwrite, ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

const State = new StateSchema({
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (state: string[], update: string[]) => state.concat(update) },
  ),
});

const clearErrors = (_state: typeof State.State) => {
  return { errors: new Overwrite([]) };
};

// node can clear the field with { errors: new Overwrite([]) }
// while a normal node can still append with { errors: ["new error"] }
```

欲了解更多信息，请参阅[Bypass reducers with Overwrite](#bypass-reducers-with-overwrite)。

## 带有 `Overwrite` 的旁路减速器

在某些情况下，您可能希望绕过减速器并直接覆盖状态值。当节点返回用 `Overwrite` 包装的值时，reducer 会被绕过，通道会直接设置为该值。

当您想要重置或替换累积状态而不是将其与现有值合并时，这非常有用。

为此，LangGraph 提供了`Overwrite` 类型。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  END,
  Overwrite,
  ReducedValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      reducer: (current: string[], update: string[]) => current.concat(update),
    },
  ),
});

const addMessage = () => {
  return { messages: ["first message"] };
};

const replaceMessages = () => {
  // Bypass the reducer and replace the entire messages list
  return { messages: new Overwrite(["replacement message"]) };
};

const graph = new StateGraph(State)
  .addNode("add_message", addMessage)
  .addNode("replace_messages", replaceMessages)
  .addEdge(START, "add_message")
  .addEdge("add_message", "replace_messages")
  .addEdge("replace_messages", END)
  .compile();

const result = await graph.invoke({ messages: ["initial"] });
console.log(result.messages);
```

```
["replacement message"]
```

您还可以使用带有特殊键`"__overwrite__"`的JSON格式：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const replaceMessages = () => {
  return { messages: { __overwrite__: ["replacement message"] } };
};
```

> [!警告]
>
> 当节点并行执行时，只有一个节点可以在给定超级步骤中的同一状态键上使用`Overwrite`。如果多个节点尝试在同一个超级步骤中覆盖相同的密钥，则会引发`InvalidUpdateError`。 `Overwrite` 还会丢弃其他节点在该超级步骤中写入同一密钥的定期更新。密钥最终只有 `Overwrite` 值。

## 定义输入和输出模式默认情况下，`StateGraph` 使用单个模式运行，所有节点都使用该模式进行通信。您还可以定义不同的输入和输出模式。

当指定不同的模式时，内部模式仍然用于节点之间的通信。输入模式验证提供的输入。输出模式会过滤内部数据，因此 `invoke` 仅返回输出模式中的字段。

定义不同的输入和输出模式：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

// Define the schema for the input
const InputState = new StateSchema({
  question: z.string(),
});

// Define the schema for the output
const OutputState = new StateSchema({
  answer: z.string(),
});

// Define the overall schema, combining both input and output
const OverallState = new StateSchema({
  question: z.string(),
  answer: z.string(),
});

// Define the node that processes the input
const answerNode: GraphNode<typeof OverallState> = (state) => {
  // Example answer and an extra key
  return { answer: "bye", question: state.question };
};

// Build the graph with input and output schemas specified
const graph = new StateGraph({
  input: InputState,
  output: OutputState,
  state: OverallState,
})
  .addNode("answerNode", answerNode)
  .addEdge(START, "answerNode")
  .addEdge("answerNode", END)
  .compile();

// Invoke the graph with an input and print the result
console.log(await graph.invoke({ question: "hi" }));
```

```
{ answer: 'bye' }
```

请注意，invoke 的输出仅包括输出模式。

## 在节点之间传递私有状态

节点有时需要不应出现在图的主输入或输出模式中的中间数据。保持该数据的私密性，以便只有需要它的节点才能读取它。

以下顺序图具有三个节点。私有数据在前两个步骤之间传递。第三步只看公众整体状态。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, START, END } from "@langchain/langgraph";
import * as z from "zod";

// The overall state of the graph (this is the public state shared across nodes)
const OverallState = new StateSchema({
  a: z.string(),
});

// Output from node1 contains private data that is not part of the overall state
const Node1Output = new StateSchema({
  privateData: z.string(),
});

// Node 2 input only requests the private data available after node1
const Node2Input = new StateSchema({
  privateData: z.string(),
});

// The private data is only shared between node1 and node2
const node1: GraphNode<typeof OverallState> = (state) => {
  const output = { privateData: "set by node1" };
  console.log(`Entered node 'node1':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

const node2: GraphNode<typeof Node2Input> = (state) => {
  const output = { a: "set by node2" };
  console.log(`Entered node 'node2':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

// Node 3 only has access to the overall state (no access to private data from node1)
const node3: GraphNode<typeof OverallState> = (state) => {
  const output = { a: "set by node3" };
  console.log(`Entered node 'node3':\n\tInput: ${JSON.stringify(state)}.\n\tReturned: ${JSON.stringify(output)}`);
  return output;
};

// Connect nodes in a sequence
// node2 accepts private data from node1, whereas
// node3 does not see the private data.
const graph = new StateGraph(OverallState)
  .addNode("node1", node1)
  .addNode("node2", node2, { input: Node2Input })
  .addNode("node3", node3)
  .addEdge(START, "node1")
  .addEdge("node1", "node2")
  .addEdge("node2", "node3")
  .addEdge("node3", END)
  .compile();

// Invoke the graph with the initial state
const response = await graph.invoke({ a: "set at start" });

console.log(`\nOutput of graph invocation: ${JSON.stringify(response)}`);
```

```
Entered node 'node1':
	Input: {"a":"set at start"}.
	Returned: {"privateData":"set by node1"}
Entered node 'node2':
	Input: {"privateData":"set by node1"}.
	Returned: {"a":"set by node2"}
Entered node 'node3':
	Input: {"a":"set by node2"}.
	Returned: {"a":"set by node3"}

Output of graph invocation: {"a":"set by node3"}
```

## 私人频道和流媒体

输入、输出和私有模式限制每个节点读取的内容和 `invoke` 返回的内容。他们**不会**隐藏[streaming](/oss/javascript/langgraph/streaming)的频道。默认情况下，值流会发出**所有**状态通道，包括私有通道。这适用于从 [event streaming](/oss/javascript/langgraph/event-streaming)（`stream_events` / `streamEvents` 和 `version="v3"`）到 `graph.stream` 的值投影（`stream.values` 和 `stream_mode="values"` / `streamMode: "values"`）。值流使用完整状态，而不是输出模式。 `invoke` 输出中可能会缺少专用通道，但在流中可见。

此示例使用不同的输入、输出、整体和私有模式。 `invoke` 仅返回输出模式：

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
    // Read from OverallState, write to the private bar channel
    return { bar: state.foo + " is" };
  })
  .addNode(
    "node3",
    (state) => {
      // Read from the private bar channel, write to OutputState
      return { graphOutput: state.bar + " Lance" };
    },
    // This input schema declares what node3 reads and registers bar as a graph channel.
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

> [卡][View example trace](https://smith.langchain.com/public/9e51e055-c781-40e7-9c11-ab0529e5a028/r)
>
> 为此示例打开公共 LangSmith 运行。

使用值投影进行流式传输仍然包括私有 `bar` 通道：

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

> [卡][View example trace](https://smith.langchain.com/public/bdecebeb-78fe-4831-ac5d-3bae88b8ddf6/r)
>
> 为此示例打开公共 LangSmith 运行。

要将流式值限制到特定通道（例如，仅输出模式），请将 `outputKeys` 传递到 `graph.stream`：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
for await (const snapshot of await graph.stream(
  { userInput: "My" },
  { streamMode: "values", outputKeys: ["graphOutput"] }, // [!code highlight]
)) {
  console.log(snapshot);
}
// { graphOutput: 'My name is Lance' }
```

如果您只需要节点在每个步骤中生成的通道（而不是完整的累积状态），请改用`streamMode: "updates"`。参见[Streaming](/oss/javascript/langgraph/streaming)。

## 替代状态定义

对于新图表，更喜欢`StateSchema`。 LangGraph 还支持以下传统代码和高级信道控制方法。

### 通道 API通道 API 提供对状态管理的低级控制。 LangGraph提供了多种内置通道类型：

|渠道类型|行为 |使用案例|
| - | - | - |
| `LastValue` |存储最新值 |被覆盖的简单字段 |
| `BinaryOperatorAggregate` |使用减速函数组合值 |累积值（计数器、列表）|
| `Topic` |将所有值收集到一个序列中 |事件流、审核日志 |
| `EphemeralValue` |在超级步之间重置的值 |临时计算状态 |

**使用对象简写：**

当您传递带有 `reducer` 和 `default` 的对象时，它会创建一个 `BinaryOperatorAggregate` 通道。传递 `null` 创建一个 `LastValue` 通道：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";

interface WorkflowState {
  messages: BaseMessage[];
  question: string;
  answer: string;
}

const workflow = new StateGraph<WorkflowState>({
  channels: {
    // BinaryOperatorAggregate: combines values with a reducer
    messages: {
      reducer: (current, update) => current.concat(update),
      default: () => [],
    },
    // LastValue: stores the most recent value (null = no reducer)
    question: null,
    answer: null,
  },
});
```

**直接使用通道类：**

为了获得更多控制，您可以从 `@langchain/langgraph/channels` 实例化通道类：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import {
  BinaryOperatorAggregate,
  LastValue,
  Topic,
} from "@langchain/langgraph/channels";

interface WorkflowState {
  messages: BaseMessage[];
  question: string;
  events: string[];
}

const workflow = new StateGraph<WorkflowState>({
  channels: {
    messages: new BinaryOperatorAggregate<BaseMessage[]>(
      (current, update) => current.concat(update),
      () => []
    ),
    question: new LastValue<string>(),
    // Topic collects all values pushed during execution
    events: new Topic<string>(),
  },
});
```

### 注释.Root

`Annotation.Root` 提供了一种用减速器定义状态的声明式方法。它类似于 `StateSchema` 但使用不同的语法：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { BaseMessage } from "@langchain/core/messages";
import { Annotation, StateGraph, messagesStateReducer } from "@langchain/langgraph";

const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  question: Annotation<string>(),
  count: Annotation<number>({
    reducer: (current, update) => current + update,
    default: () => 0,
  }),
});

const graph = new StateGraph(State);
```

### Zod 对象与 Zod v3

使用 Zod v3 时，您可以使用普通的 `z.object()` 模式定义状态。 LangGraph 使用 `.langgraph` 插件扩展了 Zod v3，该插件提供了 `.reducer()` 和 `.metadata()` 方法：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { z } from "zod/v3";
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, messagesStateReducer } from "@langchain/langgraph";
import "@langchain/langgraph/zod"; // registers the .langgraph plugin on Zod schemas

const State = z.object({
  // Use .langgraph.reducer() to attach a reducer function
  messages: z
    .array(z.custom<BaseMessage>())
    .default([])
    .langgraph.reducer(messagesStateReducer),
  // Simple fields work directly (last-write-wins)
  question: z.string().optional(),
  answer: z.string().optional(),
  // Custom reducer for accumulating values
  count: z
    .number()
    .default(0)
    .langgraph.reducer((current, update) => current + update),
});

const graph = new StateGraph(State);
```

### Zod 对象与 Zod v4Zod v4 使用基于注册表的方法。使用 LangGraph 注册表将元数据附加到架构字段：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { StateGraph, MessagesZodMeta, messagesStateReducer } from "@langchain/langgraph";
import { registry } from "@langchain/langgraph/zod";

const State = z.object({
  // Use .register() with the LangGraph registry and MessagesZodMeta
  messages: z
    .array(z.custom<BaseMessage>())
    .default([])
    .register(registry, MessagesZodMeta),
  // Simple fields work directly (last-write-wins)
  question: z.string().optional(),
  answer: z.string().optional(),
  // Custom reducer via registry metadata
  count: z
    .number()
    .default(0)
    .register(registry, {
      reducer: { fn: (current: number, update: number) => current + update },
    }),
});

const graph = new StateGraph(State);
```

### 比较表

|方法|减速机|类型安全 |佐德版本 |推荐|
| - | - | - | - | - |
| `StateSchema` | ✅ 内置 | ✅ 满 | v3 或 v4 | ✅ 是的 |
|渠道 API | ✅ 手册 | ⚠️部分|不适用 |对于高级病例 |
| `Annotation.Root` | ✅ 内置 | ✅ 满 |不适用 |遗产|
| Zod v3 + `.langgraph` | ✅ 通过插件 | ✅ 满 |仅限 v3 |遗产|
| Zod v4 + 注册表 | ✅ 通过注册表 | ✅ 满 |仅限 v4 |遗产|

## 另请参阅

* [Graph API overview](/oss/javascript/langgraph/graph-api#state)
* [Working with messages in graph state](/oss/javascript/langgraph/graph-api#working-with-messages-in-graph-state)
* [Event streaming](/oss/javascript/langgraph/event-streaming)
* [Streaming](/oss/javascript/langgraph/streaming)
* [Use the Graph API](/oss/javascript/langgraph/use-graph-api)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-state.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。