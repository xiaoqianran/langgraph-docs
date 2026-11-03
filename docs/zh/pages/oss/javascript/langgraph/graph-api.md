<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Graph API overview | https://docs.langchain.com/oss/javascript/langgraph/graph-api -->

# 图 API 概述

了解 LangGraph 如何将代理工作流程建模为共享状态、节点和边的图。

图形 API 将代理工作流程定义为 [state](#state)、[nodes](#nodes) 和 [edges](#edges) 的图形。 [⟦T23⟧](#send)和[⟦T24⟧](#command)控制图的运行方式：`Send`动态调用节点进行扇出，`Command`在路由到下一个节点时更新状态（包括中断后恢复）。当您需要显式共享状态和可视控制流时，请使用图形 API。

有关构建过程中的逐步决策，请参阅[Build checklist for the Graph API](/oss/javascript/langgraph/use-graph-api)。有关指导演练，请参阅 [Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api)。要在该 API 和功能 API 之间进行选择，请参阅[Choosing between Graph and Functional APIs](/oss/javascript/langgraph/choosing-apis)。

## 图表

LangGraph 将代理工作流程建模为由三个部分构建的图表：

1. [⟦T27⟧](#state)：应用程序的共享快照。通常是类型化模式。
2. [⟦T28⟧](#nodes)：读取状态、执行工作并返回更新的函数。
3. [⟦T29⟧](#edges)：确定下一个节点的固定或条件转换。

组合节点和边来构建序列、分支和循环。节点和边是普通函数。他们可以调用法学硕士或运行其他代码。

简而言之：节点完成工作；边缘决定接下来运行什么。

### 超级步骤LangGraph 使用 [message passing](https://en.wikipedia.org/wiki/Message_passing) 运行图表，采用 Google [Pregel](https://research.google/pubs/pregel-a-system-for-large-scale-graph-processing/) 系统的风格。离散**超级步骤**中的执行进展：

* 并行运行的节点共享一个超级步。
* 按顺序运行的节点使用单独的超级步骤。
* 当节点在传入边上接收到输入时，该节点将变为活动状态。
* 在超级步骤之后，没有待处理消息的节点将变为非活动状态。
* 当每个节点都处于非活动状态并且没有消息仍在传输时，运行结束。

### 状态图

[⟦T30⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 是主要的图形生成器。使用您的状态模式对其进行参数化。

### 编译你的图表

通过定义[state](#state)，添加[nodes](#nodes)和[edges](#edges)，然后编译来构建图。编译检查图结构（例如孤立节点）。您还可以在此处附加运行时选项，例如 [checkpointers](/oss/javascript/langgraph/persistence) 和断点。

您必须在调用或流式传输图表之前对其进行编译。这是最小的端到端示例：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, START, StateGraph, StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  text: z.string(),
});

const graph = new StateGraph(State)
  .addNode("nodeA", (state) => ({ text: `${state.text}a` }))
  .addEdge(START, "nodeA")
  .addEdge("nodeA", END)
  .compile();

await graph.invoke({ text: "" });
// { text: 'a' }
```

## 状态状态是节点读取和更新的共享数据。 LangGraph 将该数据存储在**通道**中：状态模式中的命名槽（状态对象的键）。每个通道都保存一个值并定义更新如何合并到其中。大多数通道使用最后写入获胜。具有 [reducer](#reducers) 的通道会组合值，例如通过附加到列表。

状态有两部分：

* 声明图中通道的[schema](#schema)
*可选的[reducers](#reducers)控制更新如何合并到每个通道

节点返回部分更新。 LangGraph 通过每个通道的减速器应用这些更新。

用`StateSchema`定义状态。每个字段可以是：

* **标准模式**（最后值通道；更新时覆盖）
* A **`ReducedValue`** （自定义减速器，通常用于并行更新）
* A **`MessagesValue`** （带有消息感知减速器的消息列表）
* **`UntrackedValue`**（瞬态；无检查点）

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateSchema,
  ReducedValue,
  MessagesValue,
  UntrackedValue,
} from "@langchain/langgraph";
import * as z from "zod";

const AgentState = new StateSchema({
  messages: MessagesValue,
  currentStep: z.string(),
  retryCount: z.number().default(0),
  allSteps: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.string(),
      reducer: (current, newStep) => [...current, newStep],
    }
  ),
  tempCache: new UntrackedValue(z.record(z.string(), z.unknown())),
});
```

### 架构

默认情况下，图形输入和输出模式与完整状态匹配。当某些键仅是内部键时，您可以缩小它们的范围。参见[Define input and output schemas](/oss/javascript/langgraph/graph-api-state#define-input-and-output-schemas)。

#### 多个模式

大多数图共享一个状态模式。当您需要以下任一功能时，请使用多个架构：* 内部节点共享的私有通道，但不属于图输入或输出的一部分
* 显式输入和输出模式是完整内部状态的子集

节点可以写入图状态中的任何通道，包括其声明的输入模式之外的通道。当定义这些模式时，节点还可以引入私有通道。输入和输出模式限制 `invoke` 接受和返回的内容。默认情况下，它们不会隐藏 [streaming](/oss/javascript/langgraph/streaming) 的频道。参见[Private channels and streaming](/oss/javascript/langgraph/graph-api-state#private-channels-and-streaming)。

例如，请参阅 [Define input and output schemas](/oss/javascript/langgraph/graph-api-state#define-input-and-output-schemas) 和 [Pass private state between nodes](/oss/javascript/langgraph/graph-api-state#pass-private-state-between-nodes)。

### 减速器

减速器控制节点更新如何合并到状态中。每个键都有自己的减速器。如果没有减速器，更新会覆盖以前的值。

#### 减速器参数

减速器是一个二元函数：

* **左**：该键的当前状态值
* **右**：节点针对该键返回的更新

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const newValue = reducer(currentState[key], nodeUpdate[key]); // left, right
```

定义一个减速器并将其附加到带有 `ReducedValue` 的状态键：

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

> [卡][View example trace](https://smith.langchain.com/public/0eeebb28-e5e3-4fbd-b760-257fdd6bf8b4/r)
>
> 为此示例打开公共 LangSmith 运行。

使用 left 和 right 调用减速器显示了值如何组合：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const reducer = (left: string[], right: string[]) => left.concat(right);

reducer(["draft"], ["review"]); // left, right → ["draft", "review"]
```

#### 默认减速器

默认的reducer用右边的值替换左边的值。节点返回部分更新，而不是完整状态。例如，从 `{"foo": 1, "bar": ["hi"]}` 开始。 `{"foo": 2}` 的更新产生`{"foo": 2, "bar": ["hi"]}`。后来的`{"bar": ["bye"]}`产生`{"foo": 2, "bar": ["bye"]}`。

#### 定制减速器

使用自定义化简器来组合值，例如附加到列表。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, ReducedValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.number(),
  bar: new ReducedValue(
    z.array(z.string()).default(() => []),
    { reducer: (left, right) => left.concat(right) }
  ),
});
```

这里`foo`覆盖。 `bar` 连接。从`{ foo: 1, bar: ["hi"] }`，`{ bar: ["bye"] }`更新为`{ foo: 1, bar: ["hi", "bye"] }`。

#### 覆盖

要绕过合并减速器并替换值（包括清除它），请使用`Overwrite`。使用合并减速器，空更新不会清除该字段。参见[Bypass reducers with Overwrite](/oss/javascript/langgraph/graph-api-state#bypass-reducers-with-overwrite)和[Resetting a reducer field](/oss/javascript/langgraph/graph-api-state#resetting-a-reducer-field)。

#### 重置reducer字段

使用合并减速器，返回空值会保留先前的数据。这对于必须在尝试之间清除的错误缓冲区或重试计数器很重要。参见[Resetting a reducer field](/oss/javascript/langgraph/graph-api-state#resetting-a-reducer-field)和[Bypass reducers with Overwrite](/oss/javascript/langgraph/graph-api-state#bypass-reducers-with-overwrite)。

### 未跟踪的值

`UntrackedValue` 在运行期间保存数据，但从不将其写入检查点。恢复时，这些值会重置。将其用于连接、缓存或其他必须保留的数据。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, UntrackedValue, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: MessagesValue,
  dbConnection: new UntrackedValue<DatabaseConnection>(),
  tempCache: new UntrackedValue(z.record(z.string(), z.unknown()), { guard: false }),
});
```

使用 `guard: true`（默认），一步中的多次写入会引发错误。使用`guard: false`，最后写入获胜。不要将 `UntrackedValue` 用于跨中断或时间旅行所需的数据。

### 类型实用程序

用于输入节点和路由器的 TypeScript 助手：* **`GraphNode`**：输入节点功能（可选择使用 `Command` 目的地）
* **`State.Node`**：`GraphNode<typeof State>` 在 `StateSchema` 实例上的简写
* **`ConditionalEdgeRouter`**：输入返回节点名称或`END`的路由函数
* **`StateSchema.State` / `StateSchema.Update`**：提取完整状态和部分更新类型

有关节点配方，请参阅[Configure nodes](/oss/javascript/langgraph/graph-api-nodes)。有关状态模式配方，请参阅[Define and update state](/oss/javascript/langgraph/graph-api-state)。

### 在图形状态下处理消息

#### 为什么要使用消息？

聊天模型将消息列表作为输入。 LangChain 的 [chat model interface](/oss/javascript/langchain/models) 接受诸如 [⟦T61⟧](https://reference.langchain.com/javascript/langchain-core/messages/HumanMessage) 和 [⟦T62⟧](https://reference.langchain.com/javascript/langchain-core/messages/AIMessage) 之类的消息对象。请参阅[Messages conceptual guide](/oss/javascript/langchain/messages)。

#### 在图表中使用消息

将对话历史记录存储为状态消息列表，并使用一个缩减器附加新消息并按 ID 更新现有消息。

使用 `MessagesValue`，它对 ID、更新和删除应用消息感知的缩减器。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema, MessagesValue } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  messages: MessagesValue,
  documents: z.array(z.string()),
});
```

#### 序列化

消息缩减器还将常见的有线格式反序列化为LangChain消息对象。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Supported
{ messages: [new HumanMessage("message")] }

// Also supported
{ messages: [{ role: "human", content: "message" }] }
```

使用点表示法访问属性，例如 `state.messages.at(-1).content`。

## 节点

节点是实现图形步骤的同步或异步函数。

节点可以接受：

1.`state`：图表[state](#state)
2. `config`：[⟦T67⟧](https://reference.langchain.com/javascript/langchain-core/runnables/RunnableConfig)，其值为 `thread_id` 和 `tags`

添加带有 `addNode` 的节点。首选使用 `GraphNode` 或 `State.Node` 输入：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  input: z.string(),
  results: z.string(),
});

const myNode: GraphNode<typeof State> = (state, config) => {
  return { results: `Hello, ${state.input}!` };
};

const builder = new StateGraph(State).addNode("myNode", myNode);
```在幕后，LangGraph将函数包装为[⟦T73⟧](https://reference.langchain.com/javascript/langchain-core/runnables/RunnableLambda)，因此它们获得批处理、异步支持和[tracing](/langsmith/observability)。

如果省略节点名称，LangGraph 使用函数名称。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
builder.addNode(myNode);
// Reference the node as "myNode" in edges
```

### 重执行和幂等性

使用 [checkpointer](/oss/javascript/langgraph/persistence)，LangGraph 将检查点保存在 [super-step](#super-steps) 边界，而不是节点内的中间功能。在[interrupt](/oss/javascript/langgraph/interrupts)或[retry](/oss/javascript/langgraph/fault-tolerance#retries)之后，受影响的节点从其功能开始处再次运行。暂停前再次运行有副作用。

设计节点逻辑，确保重新执行是安全的。首选幂等键、更新插入或先读后写检查。有关重试下的持久密钥和外部副作用，请参阅[Retry boundaries and idempotency](/oss/javascript/langgraph/fault-tolerance#retry-boundaries-and-idempotency)。有关`interrupt()`周围的效果，请参阅[Side effects called before ⟦T75⟧ must be idempotent](/oss/javascript/langgraph/interrupts#side-effects-called-before-interrupt-must-be-idempotent)。

您可以添加或删除节点和边，而不会中断现有线程的恢复。恢复的运行使用保存的状态和您现在编译的图表。

如果节点调用[tasks](/oss/javascript/langgraph/functional-api#task)或[⟦T76⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt)，则恢复时将应用更严格的[determinism](/oss/javascript/langgraph/functional-api#determinism)规则。已完成的任务结果从检查点恢复。在恢复点之前更改任务或中断顺序可能会导致缓存值不匹配。参见[Idempotency](/oss/javascript/langgraph/functional-api#idempotency)。

### 在节点中使用任务当一个节点运行多个应独立检查点的操作时，请将每个操作包装在 [task](/oss/javascript/langgraph/functional-api#task) 中，而不是跨节点拆分工作。使用检查指针，可以保存已完成的任务结果，因此恢复的线程可以跳过节点内已完成的工作。有关模式和示例，请参阅 [Tasks](/oss/javascript/langgraph/functional-api-tasks) 和 [Common pitfalls](/oss/javascript/langgraph/functional-api#common-pitfalls)。

### `START` 节点

[⟦T78⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START) 是将用户输入传递到图中的虚拟条目。用它来标记哪些节点首先运行。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

graph.addEdge(START, "nodeA");
```

### `END` 节点

`END` 标记终端边缘。当路径应该停止时使用它。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END } from "@langchain/langgraph";

graph.addEdge("nodeA", END);
```

### 节点缓存

LangGraph 可以通过输入缓存节点（和任务）结果。编译图时传递一个缓存，并在节点上附加一个[⟦T81⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/CachePolicy)。

有关选项、端到端示例和图范围默认值，请参阅[Add node caching](/oss/javascript/langgraph/graph-api-nodes#add-node-caching)。

## 边缘

边缘决定控制下一步的走向：

* **普通边**：总是从一个节点到下一个节点
* **条件边**：调用函数来确定下一个节点
* **入口点**：用户输入后的第一个节点（`START`→节点）
* **条件入口点**：从 `START` 使用函数进行路由

一个节点可以有多个出边。这些边缘上的目的地在下一个超级步骤中并行运行。> [!警告]
>
> 对于每个节点，使用静态边或动态路由 ([conditional edges](#conditional-edges) / [⟦T84⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command))，而不是同时使用两者。混合它们可以运行两条路径。

### 正常边缘

如果你总是想从节点 A 到节点 B，请使用 [⟦T85⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addEdge)：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addEdge("nodeA", "nodeB");
```

### 条件边

如果您想选择性地路由到一个或多个节点（或终止），请使用 [⟦T86⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addConditionalEdges)。传递源节点和一个路由函数以在该节点运行后调用：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addConditionalEdges("nodeA", routingFunction);
// Or with an explicit map:
graph.addConditionalEdges("nodeA", routingFunction, {
  pathA: "nodeB",
  pathB: "nodeC",
});
```

路由函数接收当前图状态。默认情况下，它的返回值是下一个节点的名称（或名称列表）。这些节点在下一个超级步骤中并行运行。您还可以传递一个字典，将函数的输出映射到节点名称。

路由函数可以返回节点名称、`END`、名称列表（扇出）或[⟦T88⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Send)用于map-reduce的对象。参见[Build sequences, branches, and loops](/oss/javascript/langgraph/graph-api-control-flow)。

> [!提示]
>
> 当您想要将状态更新和路由组合在单个函数中时，请使用[⟦T89⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)代替条件边。

### 入口点

入口点是图启动时运行的第一个（或多个）节点。从虚拟[⟦T90⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START)节点添加一条边到第一个要执行的节点：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addEdge(START, "nodeA");
```

### 条件入口点条件入口点可让您根据自定义逻辑从不同的节点开始。使用[⟦T92⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/START)中的[⟦T91⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph/addConditionalEdges)：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
graph.addConditionalEdges(START, routingFunction, {
  true: "nodeB",
  false: "nodeC",
});
```

您可以选择提供一个字典，将路由函数的输出映射到下一个节点名称。

## `Send`

当您需要为每个项目运行一次相同的节点，每个项目都有自己的输入，并且项目的数量仅在运行时才知道时，请使用[⟦T94⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Send)。这种形状通常称为映射缩减或协调工作人员：一个节点生成一个列表，工作人员并行处理每个项目，然后稍后的节点读取组合结果。

普通边缘无法做到这一点。他们选择接下来运行哪些节点，但每个选定的节点仍然接收共享图状态，并且在构建图时拓扑是固定的。

从条件边返回一个或多个 `Send` 对象。每个 `Send` 命名一个目标节点并传递一个自定义参数作为该调用的输入。 LangGraph 并行运行这些调用。当工作人员写入共享状态键时，[reducers](#reducers)合并他们的更新，例如通过连接列表。

`Send` 的第一个参数是目标节点名称。第二个是该调用的状态（或部分状态）。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Send } from "@langchain/langgraph";

graph.addConditionalEdges("nodeA", (state) => {
  return state.subjects.map(
    (subject) => new Send("generateJoke", { subject })
  );
});
```

有关完整的映射缩减示例，请参阅[Use Send for map-reduce](/oss/javascript/langgraph/graph-api-send-command#use-send-for-map-reduce)。

## `Command`当单个步骤必须更新状态并选择接下来运行的内容时，请使用[⟦T99⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)。通常这些作业是分开的：节点返回状态更新，并且[edges](#edges)（或[conditional edges](#conditional-edges)）决定下一个节点。当下一跳取决于您刚刚在同一函数中所做的工作时，从节点返回`Command`。

`Command` 还涵盖了普通返回和边不包含的其他两种情况：在 [interrupt](/oss/javascript/langgraph/interrupts) 之后恢复运行，以及从 [tool](#return-from-tools) 内部更新或路由。

对于单独的路由，更喜欢条件边。当您需要同时更新和路由（或上面的中断/工具箱之一）时，请使用`Command`。

`Command`接受：

* **`update`**：状态更新（就像正常的节点返回一样）
* **`goto`**：下一个节点（如条件边）
* **`graph`**：从 [subgraph](/oss/javascript/langgraph/use-subgraphs) 导航时的父图目标
* **`resume`**：用于在 [interrupt](/oss/javascript/langgraph/interrupts) 之后恢复的值

在三个地方使用`Command`：

* **[Return from nodes](#return-from-nodes)**：`update`、`goto` 和 `graph`
* **[Input to ⟦T112⟧ or ⟦T113⟧](#input-to-invoke-or-stream)**: 中断后`resume`
* **[Return from tools](#return-from-tools)**：从工具内部更新和路由

### 从节点返回

#### `update` 和 `goto`

返回[⟦T117⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)一步更新状态和路由：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

graph.addNode("myNode", (state) => {
  return new Command({
    update: { foo: "bar" },
    goto: "myOtherNode",
  });
}, {
  ends: ["myOtherNode", END],
});
```

当您使用`Command`时，将`ends`传递给`addNode`，以便LangGraph知道有效的目的地。当您同时需要更新和路线时，请使用`Command`。对于单独路由，首选[conditional edges](#conditional-edges)。

> [!警告]
>
> `Command` 添加动态边缘。来自同一节点的静态边仍然运行。不要将来自一个节点的 `Command` 路由与 `addEdge` 混合使用。

参见[Combine control flow and state updates with Command](/oss/javascript/langgraph/graph-api-send-command#combine-control-flow-and-state-updates-with-command)。

#### `graph`

从 [subgraph](/oss/javascript/langgraph/use-subgraphs) 节点，导航到父图中具有 `Command.PARENT` 的节点：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

const myNode = (state: State): Command => {
  return new Command({
    update: { foo: "bar" },
    goto: "otherSubgraph",  // where `otherSubgraph` is a node in the parent graph
    graph: Command.PARENT,
  });
};
```

当您更新子图也使用的父键时，请在父键中为该键定义 [reducer](#reducers)。参见[Navigate to a node in a parent graph](/oss/javascript/langgraph/graph-api-send-command#navigate-to-a-node-in-a-parent-graph)。

### 输入`invoke`或`stream`

> [!警告]
>
> `new Command({ resume: ... })` 是唯一的 `Command` 模式，意味着作为 `invoke()` / `stream()` 的输入（可选地在恢复时使用 `update`）。不要单独通过`new Command({ update: ... })`继续对话。任何 `Command` 作为输入都会从最新的检查点恢复，而不是从 `START` 开始，因此完成的线程可能看起来被卡住了。传递一个普通对象来开始新一轮：
>
> ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> // Wrong: resumes from the latest checkpoint
> await graph.invoke(new Command({ update: { messages: [{ role: "user", content: "follow up" }] } }), config);  // [!code --]
>
> // Correct: plain object restarts from START
> await graph.invoke({ messages: [{ role: "user", content: "follow up" }] }, config);  // [!code ++]
> ```

#### `resume`

在 [interrupt](/oss/javascript/langgraph/interrupts) 之后使用 `new Command({ resume: ... })`。该值成为暂停的 `interrupt()` 调用的返回值：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
await graph.invoke(new Command({ resume: "yes" }), config);
```

有关完整模式，请参阅[Interrupts](/oss/javascript/langgraph/interrupts)。

### 从工具返回

工具完成后，从工具返回[⟦T140⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)更新状态和路线。工具中的`goto`添加了动态边缘。调用节点上的静态边仍然运行，因此不要混合两者。

参见[Use inside tools](/oss/javascript/langgraph/graph-api-send-command#use-inside-tools)。## 图迁移

即使 [checkpointer](/oss/javascript/langgraph/persistence) 已经存储了线程状态，您也可以更改图的节点、边和状态模式。什么是安全的取决于线程是否已完成或已暂停。

**拓扑（节点和边）**

* 完成的线程（不中断）：您可以自由添加、删除或重命名节点和边。
* 中断的线程：可以更改边并添加节点。不要重命名或删除线程即将进入的节点。恢复时，LangGraph 按名称查找该节点，缺少名称则运行失败。

**状态模式**

* 添加或删除键是向后和向前兼容的。
* 重命名键会删除现有线程中该键的已保存值。
* 对现有键的不兼容类型更改（例如，缩小或要求旧检查点省略的字段）可能会破坏旧的线程状态。

对于保持模式兼容的逻辑更改（例如，新的工具集），请参阅[Business compatibility](/oss/javascript/langgraph/backward-compatibility#business-compatibility)。

## 运行时上下文

运行时上下文将依赖项传递到节点中，而不将它们置于图形状态（例如，模型名称或数据库句柄）。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, START, StateGraph, StateSchema, GraphNode } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  input: z.string(),
  output: z.string(),
});

const ContextSchema = z.object({
  llm: z.union([z.literal("openai"), z.literal("anthropic")]),
});

const getLLM = (provider?: string) => provider;

const nodeA: GraphNode<typeof State> = (state, config) => {
  const llm = getLLM(config.context?.llm);
  return { output: llm ?? "" };
};

const graph = new StateGraph(State, ContextSchema)
  .addNode("nodeA", nodeA)
  .addEdge(START, "nodeA")
  .addEdge("nodeA", END)
  .compile();

const inputs = { input: "hi" };
await graph.invoke(inputs, { context: { llm: "anthropic" } });
```

参见[Add runtime configuration](/oss/javascript/langgraph/graph-api-nodes#add-runtime-configuration)。

### 递归限制递归限制限制了一次运行可以执行的 [super-steps](#super-steps) 数量。当超过限制时，LangGraph升高`GraphRecursionError`。

默认为 25 个超级步。将 `recursionLimit` 作为顶级配置键传递（不在 `configurable` 下）。

有关秘诀（捕获错误、阅读 `langgraph_step` 和 Python `RemainingSteps`），请参阅 [Impose a recursion limit](/oss/javascript/langgraph/graph-api-control-flow#impose-a-recursion-limit) 和 [Access and handle the recursion counter](/oss/javascript/langgraph/graph-api-control-flow#access-and-handle-the-recursion-counter)。

## 了解更多

* [Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api)
* [LangGraph quickstart](/oss/javascript/langgraph/quickstart)
* [Build checklist for the Graph API](/oss/javascript/langgraph/use-graph-api)
* [Define and update state](/oss/javascript/langgraph/graph-api-state)
* [Build sequences, branches, and loops](/oss/javascript/langgraph/graph-api-control-flow)
* [Use Send and Command](/oss/javascript/langgraph/graph-api-send-command)
* [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/javascript/langgraph/graph-api-visualize)
* [Functional API overview](/oss/javascript/langgraph/functional-api)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时答案。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。