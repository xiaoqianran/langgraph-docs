<!-- langgraph-docs: Visualize your graph | https://docs.langchain.com/oss/javascript/langgraph/graph-api-visualize -->

# Visualize your graph

Render LangGraph graphs as Mermaid diagrams or PNG images for debugging and documentation.

Render a compiled graph as Mermaid text or a PNG image to inspect topology and debug routing. For an interactive UI, use [LangSmith Studio](/langsmith/studio) with a [local server](/oss/javascript/langgraph/local-server).

You can visualize any compiled graph that exposes `getGraphAsync()`, including [`StateGraph`](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph).

The examples below use the same small graph in both languages: two nodes, a conditional edge from `node1`, and a loop back from `node2`.

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

## Mermaid

Call `draw_mermaid()` on the drawable graph to get Mermaid syntax. Paste the string into any Mermaid renderer, or keep it in docs and PRs.

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

Render the graph as a `.png`. This uses the Mermaid.ink API to generate the diagram.

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await app.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
```

## See also

* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Use the Graph API](/oss/javascript/langgraph/use-graph-api)
* [LangSmith Studio](/langsmith/studio)
* [Run a local server](/oss/javascript/langgraph/local-server)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/graph-api-visualize.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).