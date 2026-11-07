<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Build checklist for the Graph API | https://docs.langchain.com/oss/javascript/langgraph/use-graph-api -->

# 为 Graph API 构建清单

使用 Graph API 构建时决定状态、控制流、发送、命令和节点选项。

本指南将逐步介绍您在构建图表时做出的决策。有关安装和端到端代理示例，请参阅[LangGraph quickstart](/oss/javascript/langgraph/quickstart)。有关设计演练，请参阅[Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api)。有关概念，请参阅[Graph API overview](/oss/javascript/langgraph/graph-api)。

## 构建你的图表

按顺序完成这些决定。每个步骤都包含一个简短的示例以及指向完整食谱的操作方法的链接。

**1.定义共享状态**

决定数据节点共享哪些数据以及更新如何合并。

* 选择一个模式（`TypedDict`、数据类或 TypeScript 中的`StateSchema`）。
* 为多个节点写入的任何键添加[reducer](/oss/javascript/langgraph/graph-api#reducers)（例如，附加消息）。
* 当图表应向调用者隐藏内部通道时，使用私有或输入/输出模式。

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

这里`foo`覆盖。 `bar` 连接。

对于 schema、reducer、消息和私有状态，请参阅 [Define and update state](/oss/javascript/langgraph/graph-api-state)。

**2.选择控制流**

决定工作如何在节点之间移动。* **顺序**：按顺序固定步骤。
* **分支**：条件边从状态中选择下一个节点。
* **并行**：扇出到多个节点，然后扇入（通常使用减速器）。
* **循环**：循环直到出现终止条件，或使用 [recursion limit](/oss/javascript/langgraph/graph-api#recursion-limit) 运行上限。

此序列检查数字是否为偶数，然后格式化消息：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  END,
  START,
  StateGraph,
  StateSchema,
  type GraphNode,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  number: z.number(),
  isEven: z.boolean().optional(),
  message: z.string().optional(),
});

const checkEven: GraphNode<typeof State> = (state) => ({
  isEven: state.number % 2 === 0,
});

const formatMessage: GraphNode<typeof State> = (state) => ({
  message: state.isEven ? "The number is even." : "The number is odd.",
});

const graph = new StateGraph(State)
  .addNode("checkEven", checkEven)
  .addNode("formatMessage", formatMessage)
  .addEdge(START, "checkEven")
  .addEdge("checkEven", "formatMessage")
  .addEdge("formatMessage", END)
  .compile();

await graph.invoke({ number: 7 });
```

对于分支、并行路径和循环，请参阅[Build sequences, branches, and loops](/oss/javascript/langgraph/graph-api-control-flow)。

**3.决定您是否需要发送或命令**

大多数图只需要节点、边和条件边。除非遇到以下情况之一，否则请保持在边缘布线。有关模式和示例，请参阅[Use Send and Command](/oss/javascript/langgraph/graph-api-send-command)。

当默认模型不够时，可以使用额外的功能：

* 当您必须为每个项目运行一次相同的节点，每个项目都有自己的输入，并且项目计数仅在运行时（map-reduce / Orchestrator-worker）时才知道时，请使用[⟦T9⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Send)。
* 当一个步骤必须更新状态并选择下一个节点、在 [interrupt](/oss/javascript/langgraph/interrupts) 之后恢复或从工具更新状态时，请使用 [⟦T10⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/Command)。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command, Send } from "@langchain/langgraph";

// Send: fan out one worker per item
graph.addConditionalEdges("nodeA", (state) => {
  return state.subjects.map(
    (subject) => new Send("generateJoke", { subject })
  );
});

// Command: update state and route in one return
graph.addNode(
  "myNode",
  (state) => {
    return new Command({
      update: { foo: "bar" },
      goto: "myOtherNode",
    });
  },
  { ends: ["myOtherNode"] }
);
```

**4.根据需要配置节点**

当可靠性或成本很重要时添加运行时选项：* 不稳定或缓慢步骤的重试和超时
* 错误处理程序和图范围节点默认值
* 缓存昂贵的重复工作
* 不属于状态的依赖项的运行时上下文或配置

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const graph = new StateGraph(State)
  .addNode("nodeName", nodeFunction, { retryPolicy: {} })
  .compile();
```

参见[Configure nodes](/oss/javascript/langgraph/graph-api-nodes)。

**5.可视化图表**

渲染 Mermaid 或 PNG 图以检查拓扑并调试路由。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const drawableGraph = await graph.getGraphAsync();
console.log(drawableGraph.drawMermaid());
```

参见[Visualize your graph](/oss/javascript/langgraph/graph-api-visualize)。

## 后续步骤

* [Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api)：使用电子邮件代理进行设计演练
* [Graph API overview](/oss/javascript/langgraph/graph-api)：状态、节点、边、`Send`和`Command`的概念
* [Define and update state](/oss/javascript/langgraph/graph-api-state)
* [Build sequences, branches, and loops](/oss/javascript/langgraph/graph-api-control-flow)
* [Use Send and Command](/oss/javascript/langgraph/graph-api-send-command)
* [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)
* [Visualize your graph](/oss/javascript/langgraph/graph-api-visualize)
* [LangGraph quickstart](/oss/javascript/langgraph/quickstart)：端到端计算器代理

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-graph-api.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。