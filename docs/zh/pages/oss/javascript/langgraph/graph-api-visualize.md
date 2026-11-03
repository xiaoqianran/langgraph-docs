<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Visualize your graph | https://docs.langchain.com/oss/javascript/langgraph/graph-api-visualize -->

# 可视化你的图表

将 LangGraph 图形渲染为 Mermaid 图或 PNG 图像以进行调试和记录。

将编译后的图形渲染为 Mermaid 文本或 PNG 图像，以检查拓扑和调试路由。对于交互式 UI，请将 [LangSmith Studio](/langsmith/studio) 与 [local server](/oss/javascript/langgraph/local-server) 结合使用。

您可以可视化公开 `getGraphAsync()` 的任何编译图，包括 [⟦T5⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph)。

下面的示例在两种语言中使用相同的小图：两个节点、来自 `node1` 的条件边以及来自 `node2` 的循环。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  ConditionalEdgeRouter,
  END,
  GraphNode,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";
import * as z from "zod";

const State = new StateSchema({
  value: z.number(),
});

const node1: GraphNode<typeof State> = (state) => {
  return { value: state.value + 1 };
};

const node2: GraphNode<typeof State> = (state) => {
  return { value: state.value * 2 };
};

const router: ConditionalEdgeRouter<{ InputSchema: typeof State; Nodes: "node2" }> = (state) => {
  if (state.value < 10) {
    return "node2";
  }
  return END;
};

const app = new StateGraph(State)
  .addNode("node1", node1)
  .addNode("node2", node2)
  .addEdge(START, "node1")
  .addConditionalEdges("node1", router)
  .addEdge("node2", "node1")
  .compile();
```

## 美人鱼

在可绘制图上调用 `draw_mermaid()` 以获得 Mermaid 语法。将字符串粘贴到任何 Mermaid 渲染器中，或将其保留在文档和 PR 中。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const drawableGraph = await app.getGraphAsync();
console.log(drawableGraph.drawMermaid());
```

```
---
config:
  flowchart:
    curve: linear
---
graph TD;
	__start__([<p>__start__</p>]):::first
	node1(node1)
	node2(node2)
	__end__([<p>__end__</p>]):::last
	__start__ --> node1;
	node1 -.-> __end__;
	node1 -.-> node2;
	node2 --> node1;
	classDef default fill:#f2f0ff,line-height:1.2
	classDef first fill-opacity:0
	classDef last fill:#bfb6fc
```

## PNG

将图形渲染为 `.png`。这使用 Mermaid.ink API 来生成图表。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await app.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
```

## 另请参阅

* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Use the Graph API](/oss/javascript/langgraph/use-graph-api)
* [LangSmith Studio](/langsmith/studio)
* [Run a local server](/oss/javascript/langgraph/local-server)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-visualize.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。