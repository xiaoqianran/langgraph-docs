<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Use time-travel | https://docs.langchain.com/oss/javascript/langgraph/use-time-travel -->

# 使用时间旅行

> 重放过去的执行并分叉以探索 LangGraph 中的替代路径

## 概述

LangGraph 支持通过 [checkpoints](/oss/javascript/langgraph/checkpointers#checkpoints) 进行时间旅行：

* **[Replay](#replay)**：从之前的检查点重试。
* **[Fork](#fork)**：从具有修改状态的先前检查点分支以探索替代路径。

两者都通过从先前的检查点恢复来工作。检查点之前的节点不会重新执行（结果已保存）。检查点之后的节点重新执行，包括任何LLM调用、API请求和[interrupts](/oss/javascript/langgraph/interrupts)（可能会产生不同的结果）。

## 重播

使用先前检查点的配置调用图表以从该点重放。

<Warning>
  重播重新执行节点——它不仅仅是从缓存中读取。 LLM 调用、API 请求和 [interrupts](/oss/javascript/langgraph/interrupts) 再次触发，可能会返回不同的结果。从最终检查点（无`next`节点）重放是无操作的。
</Warning>

<img src="https://mintcdn.com/langchain-5e9cc07a/dL5Sn6Cmy9pwtY0V/oss/images/re_play.png?fit=max&auto=format&n=dL5Sn6Cmy9pwtY0V&q=85&s=d7b34b85c106e55d181ae1f4afb50251" alt="Replay" width="2276" height="986" data-path="oss/images/re_play.png" />

使用 [⟦T8⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#getStateHistory) 找到要重放的检查点，然后使用该检查点的配置调用 [⟦T9⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.CompiledStateGraph.html#invoke)：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { v7 as uuid7 } from "uuid";
import { StateGraph, MemorySaver, START } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  topic: Annotation<string>(),
  joke: Annotation<string>(),
});

function generateTopic(state: typeof StateAnnotation.State) {
  return { topic: "socks in the dryer" };
}

function writeJoke(state: typeof StateAnnotation.State) {
  return { joke: `Why do ${state.topic} disappear? They elope!` };
}

const checkpointer = new MemorySaver();
const graph = new StateGraph(StateAnnotation)
  .addNode("generateTopic", generateTopic)
  .addNode("writeJoke", writeJoke)
  .addEdge(START, "generateTopic")
  .addEdge("generateTopic", "writeJoke")
  .compile({ checkpointer });

// Step 1: Run the graph
const config = { configurable: { thread_id: uuid7() } };
const result = await graph.invoke({}, config);

// Step 2: Find a checkpoint to replay from
const states = [];
for await (const state of graph.getStateHistory(config)) {
  states.push(state);
}

// Step 3: Replay from a specific checkpoint
const beforeJoke = states.find((s) => s.next.includes("writeJoke"));
const replayResult = await graph.invoke(null, beforeJoke.config);
// writeJoke re-executes (runs again), generateTopic does not
```

## 叉子

Fork 从过去的检查点创建一个具有修改状态的新分支。在先前的检查点上调用 [⟦T10⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#updateState) 创建分叉，然后使用 [⟦T11⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.CompiledStateGraph.html#invoke) 和 `None` 继续执行。

<img src="https://mintcdn.com/langchain-5e9cc07a/-_xGPoyjhyiDWTPJ/oss/images/checkpoints_full_story.jpg?fit=max&auto=format&n=-_xGPoyjhyiDWTPJ&q=85&s=a52016b2c44b57bd395d6e1eac47aa36" alt="Fork" width="3705" height="2598" data-path="oss/images/checkpoints_full_story.jpg" /><Warning>
  `update_state` **不**回滚线程。它创建一个从指定点分支的新检查点。原始的执行历史保持不变。
</Warning>

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Find checkpoint before writeJoke
const states = [];
for await (const state of graph.getStateHistory(config)) {
  states.push(state);
}
const beforeJoke = states.find((s) => s.next.includes("writeJoke"));

// Fork: update state to change the topic
const forkConfig = await graph.updateState(
  beforeJoke.config,
  { topic: "chickens" },
);

// Resume from the fork — writeJoke re-executes with the new topic
const forkResult = await graph.invoke(null, forkConfig);
console.log(forkResult.joke); // A joke about chickens, not socks
```

### 来自特定节点

当您调用[⟦T14⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#updateState)时，将使用指定节点的编写器（包括[reducers](/oss/javascript/langgraph/graph-api#reducers)）应用值。检查点将该节点记录为已生成更新，并从该节点的后继节点恢复执行。

默认情况下，LangGraph 从检查点的版本历史记录中推断 `as_node`。当从特定检查点分叉时，这个推论几乎总是正确的。

在以下情况下明确指定 `as_node`：

* **并行分支**：多个节点在同一步骤中更新状态，LangGraph 无法确定哪个是最后一个（`InvalidUpdateError`）。
* **没有执行历史**：在新线程上设置状态（常见于[testing](/oss/javascript/langgraph/test)）。
* **跳过节点**：将`as_node`设置为较晚的节点，使图认为该节点已经运行。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// graph: generateTopic -> writeJoke

// Treat this update as if generateTopic produced it.
// Execution resumes at writeJoke (the successor of generateTopic).
const forkConfig = await graph.updateState(
  beforeJoke.config,
  { topic: "chickens" },
  { asNode: "generateTopic" },
);
```

## 中断

如果您的图表将 [⟦T19⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/interrupt) 用于 [human-in-the-loop](/oss/javascript/langgraph/interrupts) 工作流程，则在时间旅行期间始终会重新触发中断。包含中断的节点重新执行，并且`interrupt()`暂停以等待新的`Command(resume=...)`。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { interrupt, Command } from "@langchain/langgraph";

function askHuman(state: { value: string[] }) {
  const answer = interrupt("What is your name?");
  return { value: [`Hello, ${answer}!`] };
}

function finalStep(state: { value: string[] }) {
  return { value: ["Done"] };
}

// ... build graph with checkpointer ...

// First run: hits interrupt
await graph.invoke({ value: [] }, config);
// Resume with answer
await graph.invoke(new Command({ resume: "Alice" }), config);

// Replay from before askHuman
const states = [];
for await (const state of graph.getStateHistory(config)) {
  states.push(state);
}
const beforeAsk = states.filter((s) => s.next.includes("askHuman")).pop();

const replayResult = await graph.invoke(null, beforeAsk.config);
// Pauses at interrupt — waiting for new Command({ resume: ... })

// Fork from before askHuman
const forkConfig = await graph.updateState(beforeAsk.config, { value: ["forked"] });
const forkResult = await graph.invoke(null, forkConfig);
// Pauses at interrupt — waiting for new Command({ resume: ... })

// Resume the forked interrupt with a different answer
await graph.invoke(new Command({ resume: "Bob" }), forkConfig);
// Result: { value: ["forked", "Hello, Bob!", "Done"] }
```

### 多个中断如果您的图表在多个点收集输入（例如，多步骤表单），您可以在中断之间进行分叉以更改稍后的答案，而无需重新询问之前的问题。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Fork from BETWEEN the two interrupts (after askName, before askAge)
const states = [];
for await (const state of graph.getStateHistory(config)) {
  states.push(state);
}
const between = states.filter((s) => s.next.includes("askAge")).pop();

const forkConfig = await graph.updateState(between.config, { value: ["modified"] });
const result = await graph.invoke(null, forkConfig);
// askName result preserved ("name:Alice")
// askAge pauses at interrupt — waiting for new answer
```

## 子图

[subgraphs](/oss/javascript/langgraph/use-subgraphs) 的时间旅行取决于子图是否有自己的检查点。这决定了您可以进行时间旅行的检查点的粒度。

<Tabs>
  <Tab title="Inherited checkpointer (default)">
    默认情况下，子图继承父图的检查点。父级将整个子图视为**单个超级步骤** - 整个子图执行只有一个父级检查点。从子图重新执行之前开始的时间旅行。

    您无法时间旅行到默认子图中*节点之间的点 - 您只能从父级开始时间旅行。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    // Subgraph without its own checkpointer (default)
    const subgraph = new StateGraph(StateAnnotation)
      .addNode("stepA", stepA)       // Has interrupt()
      .addNode("stepB", stepB)       // Has interrupt()
      .addEdge(START, "stepA")
      .addEdge("stepA", "stepB")
      .compile();  // No checkpointer — inherits from parent

    const graph = new StateGraph(StateAnnotation)
      .addNode("subgraphNode", subgraph)
      .addEdge(START, "subgraphNode")
      .compile({ checkpointer });

    // Complete both interrupts
    await graph.invoke({ value: [] }, config);
    await graph.invoke(new Command({ resume: "Alice" }), config);
    await graph.invoke(new Command({ resume: "30" }), config);

    // Time travel from before the subgraph
    const states = [];
    for await (const state of graph.getStateHistory(config)) {
      states.push(state);
    }
    const beforeSub = states.filter((s) => s.next.includes("subgraphNode")).pop();

    const forkConfig = await graph.updateState(beforeSub.config, { value: ["forked"] });
    const result = await graph.invoke(null, forkConfig);
    // The entire subgraph re-executes from scratch
    // You cannot time travel to a point between stepA and stepB
    ```
  </Tab>

  <Tab title="Subgraph checkpointer">
    在子图上设置 `checkpointer=True` 以赋予其自己的检查点历史记录。这会在子图**内**的每个步骤创建检查点，允许您从子图中的特定点进行时间旅行 - 例如，在两个中断之间。

    使用 [⟦T23⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.pregel.Pregel.html#getState) 和 `subgraphs=True` 访问子图自己的检查点配置，然后从中分叉：

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    // Subgraph with its own checkpointer
    const subgraph = new StateGraph(StateAnnotation)
      .addNode("stepA", stepA)       // Has interrupt()
      .addNode("stepB", stepB)       // Has interrupt()
      .addEdge(START, "stepA")
      .addEdge("stepA", "stepB")
      .compile({ checkpointer: true });  // Own checkpoint history

    const graph = new StateGraph(StateAnnotation)
      .addNode("subgraphNode", subgraph)
      .addEdge(START, "subgraphNode")
      .compile({ checkpointer });

    // Run until stepA interrupt, then resume -> hits stepB interrupt
    await graph.invoke({ value: [] }, config);
    await graph.invoke(new Command({ resume: "Alice" }), config);

    // Get the subgraph's own checkpoint (between stepA and stepB)
    const parentState = await graph.getState(config, { subgraphs: true });
    const subConfig = parentState.tasks[0].state.config;

    // Fork from the subgraph checkpoint
    const forkConfig = await graph.updateState(subConfig, { value: ["forked"] });
    const result = await graph.invoke(null, forkConfig);
    // stepB re-executes, stepA's result is preserved
    ```
  </Tab>
</Tabs>有关配置子图检查点的更多信息，请参阅[subgraph persistence](/oss/javascript/langgraph/use-subgraphs#subgraph-persistence)。

***

<div className="source-links">
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/use-time-travel.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>