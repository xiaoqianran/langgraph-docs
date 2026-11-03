<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use Send and Command | https://docs.langchain.com/oss/javascript/langgraph/graph-api-send-command -->

# 使用发送和命令

使用 Send 构建映射缩减工作流程，并使用 LangGraph 中的命令将状态更新与路由结合起来。

当项目计数仅在运行时已知时（map-reduce），[⟦T17⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Send) 使用自定义输入为每个项目运行一次相同的节点。 [⟦T18⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 在一次返回中更新状态并选择下一个节点。对于普通序列、分支和循环，请参见[Control flow](/oss/javascript/langgraph/graph-api-control-flow)。有关概念，请参阅 Graph API 概述中的 [Send](/oss/javascript/langgraph/graph-api#send) 和 [Command](/oss/javascript/langgraph/graph-api#command)。

## 使用 Send 进行映射缩减

从 [conditional edge](/oss/javascript/langgraph/graph-api#conditional-edges) 返回一个或多个 `Send` 对象。每个`Send`命名一个目标节点并传递该调用的输入。 LangGraph 并行运行这些调用。当工作人员写入相同的状态键时，请使用 [reducer](/oss/javascript/langgraph/graph-api#reducers) 以便更新合并（例如，串联列表）。

下面的工作人员没有收到完整的图状态。 `Send` 将 `{ "subject": ... }` 作为该运行的输入传递，因此工作器模式包含 `subject`，即使整体状态不包含。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  ConditionalEdgeRouter,
  START,
  END,
  Send,
} from "@langchain/langgraph";
import * as z from "zod";

const OverallState = new StateSchema({
  topic: z.string(),
  subjects: z.array(z.string()),
  jokes: new ReducedValue(z.array(z.string()).default(() => []), {
    reducer: (x, y) => x.concat(y),
  }),
  bestSelectedJoke: z.string(),
});

const generateTopics: GraphNode<typeof OverallState> = (state) => {
  return { subjects: ["lions", "elephants", "penguins"] };
};

// Send passes { subject } as this invocation's input (not full OverallState)
const generateJoke = (state: { subject: string }) => {
  const jokeMap: Record<string, string> = {
    lions: "Why don't lions like fast food? Because they can't catch it!",
    elephants:
      "Why don't elephants use computers? They're afraid of the mouse!",
    penguins:
      "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice.",
  };
  return { jokes: [jokeMap[state.subject]] };
};

const continueToJokes: ConditionalEdgeRouter<{
  InputSchema: typeof OverallState;
  Nodes: "generateJoke";
}> = (state) => {
  return state.subjects.map(
    (subject) => new Send("generateJoke", { subject })
  );
};

const bestJoke: GraphNode<typeof OverallState> = (state) => {
  return { bestSelectedJoke: "penguins" };
};

const graph = new StateGraph(OverallState)
  .addNode("generateTopics", generateTopics)
  .addNode("generateJoke", generateJoke)
  .addNode("bestJoke", bestJoke)
  .addEdge(START, "generateTopics")
  .addConditionalEdges("generateTopics", continueToJokes)
  .addEdge("generateJoke", "bestJoke")
  .addEdge("bestJoke", END)
  .compile();
```

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
    startNode([START]) --> topics[generate_topics]
    topics -.-> joke1[generate_joke]
    topics -.-> joke2[generate_joke]
    topics -.-> joke3[generate_joke]
    joke1 --> best[best_joke]
    joke2 --> best
    joke3 --> best
    best --> endNode([END])

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class topics,joke1,joke2,joke3,best process
    class startNode,endNode terminal
```

虚线边缘是`Send`扇出：每个主题一次`generate_joke`调用。

流节点更新（此示例没有聊天模型，因此没有要迭代的消息令牌）：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const stream = await graph.stream(
  { topic: "animals" },
  { streamMode: "updates" }
);
for await (const chunk of stream) {
  console.log(chunk);
}
```

```
{ generateTopics: { subjects: [ 'lions', 'elephants', 'penguins' ] } }
{ generateJoke: { jokes: [ "Why don't lions like fast food? Because they can't catch it!" ] } }
{ generateJoke: { jokes: [ "Why don't elephants use computers? They're afraid of the mouse!" ] } }
{ generateJoke: { jokes: [ "Why don't penguins like talking to strangers at parties? Because they find it hard to break the ice." ] } }
{ bestJoke: { bestSelectedJoke: 'penguins' } }
```

## 将控制流和状态更新与 Command 结合起来当该步骤必须更新状态并选择下一步运行的内容时，从节点返回[Command](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)。对于单独的路由，首选[conditional edges](/oss/javascript/langgraph/graph-api#conditional-edges)。

`Command` 返回的形状（完整图表如下）：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

const myNode = (state: typeof State.State) => {
  return new Command({
    // state update
    update: { foo: "bar" },
    // control flow
    goto: "myOtherNode",
  });
};
```

端到端示例使用三个节点：A、B 或 C。节点 A 更新状态并使用 `Command` 选择下一个节点，因此该图在 A、B 和 C 之间没有条件边。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph, StateSchema, GraphNode, Command, START } from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: z.string(),
});

const nodeA: GraphNode<{
  InputSchema: typeof State;
  Nodes: "nodeB" | "nodeC";
}> = (state) => {
  console.log("Called A");
  const value = Math.random() > 0.5 ? "b" : "c";
  const goto = value === "b" ? "nodeB" : "nodeC";

  return new Command({
    update: { foo: value },
    goto,
  });
};

const nodeB: GraphNode<typeof State> = (state) => {
  console.log("Called B");
  return { foo: state.foo + "b" };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log("Called C");
  return { foo: state.foo + "c" };
};
```

建造`StateGraph`。控制流存在于`nodeA`中，因此A、B和C之间不存在[conditional edges](/oss/javascript/langgraph/graph-api#conditional-edges)。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const graph = new StateGraph(State)
  .addNode("nodeA", nodeA, {
    ends: ["nodeB", "nodeC"],
  })
  .addNode("nodeB", nodeB)
  .addNode("nodeC", nodeC)
  .addEdge(START, "nodeA")
  .compile();
```

> [!警告]
>
> 将 `ends` 传递给 `addNode` 以列出 `nodeA` 可以导航到哪些节点。该声明是图形渲染所必需的，并告诉LangGraph`nodeA`可以导航到`nodeB`和`nodeC`。

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
    startNode([START]) --> a[nodeA]
    a -.-> b[nodeB]
    a -.-> c[nodeC]
    b --> endNode([END])
    c --> endNode

    classDef process fill:#E5F4FF,stroke:#006DDD,stroke-width:2px,color:#030710
    classDef terminal fill:#F2FAFF,stroke:#40668D,stroke-width:2px,color:#030710
    class a,b,c process
    class startNode,endNode terminal
```

虚线边是从 `nodeA` 出发的 `Command` 路线。根据节点 A 中的随机选择，重复调用采用不同的路径（A → B 或 A → C）。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ foo: "" });
console.log(result);
```

```
Called A
Called C
{ foo: 'cc' }
```

### 导航到父图中的节点

从[subgraph](/oss/javascript/langgraph/use-subgraphs)内的节点，路由到父图中具有`graph=Command.PARENT`的节点：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const myNode = (state: { foo: string }) => {
  return new Command({
    update: { foo: "bar" },
    goto: "otherSubgraph", // node in the parent graph
    graph: Command.PARENT,
  });
};
```

下面的示例将节点 A 转换为单节点子图，并将其添加到仍包含 B 和 C 的父图。> [!警告]
>
> **使用 `Command.PARENT`** 进行状态更新
> 当子图节点更新父图和子图[state schemas](/oss/javascript/langgraph/graph-api#schema)中都存在的键时，请在父图上为该键定义一个[reducer](/oss/javascript/langgraph/graph-api#reducers)。请参阅下面的示例。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  StateGraph,
  StateSchema,
  ReducedValue,
  GraphNode,
  Command,
  START,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  foo: new ReducedValue(  // [!code highlight]
    z.string().default(""),
    { reducer: (x, y) => x + y }
  ),
});

const nodeA: GraphNode<{
  InputSchema: typeof State;
  Nodes: "nodeB" | "nodeC";
}> = (state) => {
  console.log("Called A");
  const value = Math.random() > 0.5 ? "a" : "b";
  const goto = value === "a" ? "nodeB" : "nodeC";

  return new Command({
    update: { foo: value },  // [!code highlight]
    goto,
    // Closest parent graph relative to this subgraph
    graph: Command.PARENT,
  });
};

const subgraph = new StateGraph(State)
  .addNode("nodeA", nodeA)
  .addEdge(START, "nodeA")
  .compile();

const nodeB: GraphNode<typeof State> = (state) => {
  console.log("Called B");
  // Reducer appends; do not manually concatenate onto state.foo
  return { foo: "b" };
};

const nodeC: GraphNode<typeof State> = (state) => {
  console.log("Called C");
  return { foo: "c" };
};

const graph = new StateGraph(State)
  .addNode("subgraph", subgraph, { ends: ["nodeB", "nodeC"] })
  .addNode("nodeB", nodeB)
  .addNode("nodeC", nodeC)
  .addEdge(START, "subgraph")
  .compile();
```

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const result = await graph.invoke({ foo: "" });
console.log(result);
```

```
Called A
Called C
{ foo: 'bc' }
```

### 使用内部工具

从工具返回`Command(update=...)`，以在回合期间写入图形状态（例如，客户查找结果）。下面的片段假设 `get_user_info` / `getUserInfo` 和名为 `messages` 的消息历史记录密钥。完成应用程序中的导入和助手。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { tool } from "@langchain/core/tools";
import { Command } from "@langchain/langgraph";
import * as z from "zod";

const lookupUserInfo = tool(
  async (_input, runtime) => {
    const userId = runtime.serverInfo?.user?.identity as string | undefined;  // [!code highlight]
    const userInfo = getUserInfo(userId);
    return new Command({
      update: {
        userInfo,
        messages: [
          {
            role: "tool",
            content: "Successfully looked up user information",
            tool_call_id: runtime.toolCall.id,
          },
        ],
      },
    });
  },
  {
    name: "lookupUserInfo",
    description:
      "Look up user information to better assist with questions.",
    schema: z.object({}),
  }
);
```

> [!警告]
>
> 从工具返回[⟦T44⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)时，在`Command.update`中包含`messages`（或保存消息历史记录的任何状态键），并且该列表必须包含`ToolMessage`。 LLM 提供商需要包含工具调用的 AI 消息，后跟工具结果消息。

对于返回 [⟦T48⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command) 的工具，更喜欢预构建的 [⟦T49⟧](https://reference.langchain.com/javascript/langchain-langgraph/prebuilt/ToolNode)，它将这些对象传播到图状态中。在自定义工具调用节点中，自行传播工具返回的[⟦T50⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)。

## 中断后恢复使用 `Command` 作为 `invoke` / `stream` 的输入，仅在 [interrupt](/oss/javascript/langgraph/interrupts) 之后恢复（`resume=...`，恢复时可选择使用 `update`）。不要单独通过`Command(update=...)`继续对话：任何`Command`作为输入从最新的检查点恢复，而不是从`START`。通过简单的状态更新来开始新的回合。

有关完整的反模式示例，请参阅[Input to invoke or stream](/oss/javascript/langgraph/graph-api#input-to-invoke-or-stream)。有关中断模式，请参阅[Interrupts](/oss/javascript/langgraph/interrupts)。

## 另请参阅

* Graph API 概述中的[Send](/oss/javascript/langgraph/graph-api#send) 和 [Command](/oss/javascript/langgraph/graph-api#command)
* [Interrupts](/oss/javascript/langgraph/interrupts)
* [Control flow](/oss/javascript/langgraph/graph-api-control-flow)
* [Use subgraphs](/oss/javascript/langgraph/use-subgraphs)
* [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-send-command.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。