<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Choosing between Graph and Functional APIs | https://docs.langchain.com/oss/javascript/langgraph/choosing-apis -->

# 在图 API 和函数式 API 之间进行选择

LangGraph 提供了两种不同的 API 来构建代理工作流程：**Graph API** 和 **Functional API**。这两个 API 共享相同的底层运行时，并且可以在同一应用程序中一起使用，但它们是针对不同的用例和开发偏好而设计的。

本指南将帮助您根据您的具体要求了解何时使用每个 API。

## 快速决策指南

当您需要时，请使用 **Graph API**：

* **复杂的工作流程可视化**用于调试和记录
* **显式状态管理**，跨多个节点共享数据
* **具有多个决策点的条件分支**
* **稍后需要合并的并行执行路径**
* **团队协作**，视觉表示有助于理解

当您需要时，请使用 **Functional API**：

* **对现有程序代码进行最少的代码更改**
* **标准控制流**（if/else、循环、函数调用）
* **函数范围的状态**，没有显式的状态管理
* **快速原型制作**，样板更少
* **线性工作流程** 具有简单的分支逻辑

## 详细比较

### 何时使用图形 API[Graph API](/oss/javascript/langgraph/graph-api) 使用声明式方法，您可以定义节点、边和共享状态来创建可视化图形结构。

**1.复杂的决策树和分支逻辑**

当您的工作流程有多个取决于各种条件的决策点时，Graph API 会使这些分支变得明确且易于可视化。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import {
  StateGraph,
  StateSchema,
  MessagesValue,
  START,
  END,
  type GraphNode,
  type ConditionalEdgeRouter,
} from "@langchain/langgraph";

// Graph API: Clear visualization of decision paths
const AgentState = new StateSchema({
  messages: MessagesValue,
  currentTool: z.string(),
  retryCount: z.number().default(0),
});

const shouldContinue: ConditionalEdgeRouter<typeof AgentState> = (state) => {
  if (state.retryCount > 3) {
    return END;
  } else if (state.currentTool === "search") {
    return "processSearch";
  } else {
    return "callLlm";
  }
};

const workflow = new StateGraph(AgentState)
  .addNode("callLlm", callLlmNode)
  .addNode("processSearch", searchNode)
  .addConditionalEdges("callLlm", shouldContinue);
```

**2.跨多个组件的状态管理**

当您需要在工作流程的不同部分之间共享和协调状态时，Graph API 的显式状态管理非常有用。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import { StateSchema, type GraphNode } from "@langchain/langgraph";

// Multiple nodes can access and modify shared state
const WorkflowState = new StateSchema({
  userInput: z.string(),
  searchResults: z.array(z.string()).default([]),
  generatedResponse: z.string().optional(),
  validationStatus: z.string().optional(),
});

const searchNode: GraphNode<typeof WorkflowState> = async (state) => {
  // Access shared state
  const results = await search(state.userInput);
  return { searchResults: results };
};

const validationNode: GraphNode<typeof WorkflowState> = async (state) => {
  // Access results from previous node
  const isValid = await validate(state.generatedResponse);
  return { validationStatus: isValid ? "valid" : "invalid" };
};
```

**3.具有同步的并行处理**

当您需要并行运行多个操作然后合并它们的结果时，Graph API 可以自然地处理这个问题。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { START } from "@langchain/langgraph";

// Parallel processing of multiple data sources
workflow
  .addNode("fetchNews", fetchNews)
  .addNode("fetchWeather", fetchWeather)
  .addNode("fetchStocks", fetchStocks)
  .addNode("combineData", combineAllData)
  // All fetch operations run in parallel
  .addEdge(START, "fetchNews")
  .addEdge(START, "fetchWeather")
  .addEdge(START, "fetchStocks")
  // Combine waits for all parallel operations to complete
  .addEdge("fetchNews", "combineData")
  .addEdge("fetchWeather", "combineData")
  .addEdge("fetchStocks", "combineData");
```

**4.团队开发和文档**

Graph API 的可视化特性使团队更容易理解、记录和维护复杂的工作流程。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
// Clear separation of concerns - each team member can work on different nodes
workflow
  .addNode("dataIngestion", dataTeamFunction)
  .addNode("mlProcessing", mlTeamFunction)
  .addNode("businessLogic", productTeamFunction)
  .addNode("outputFormatting", frontendTeamFunction);
```

### 何时使用函数式 API

[Functional API](/oss/javascript/langgraph/functional-api) 使用命令式方法将 LangGraph 功能集成到标准程序代码中。

**1.现有程序代码**

当您拥有使用标准控制流的现有代码并希望以最少的重构添加 LangGraph 功能时。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { task, entrypoint } from "@langchain/langgraph";

// Functional API: Minimal changes to existing code
const processUserInput = task(
  "processUserInput",
  async (userInput: string) => {
    // Existing function with minimal changes
    return { processed: userInput.toLowerCase().trim() };
  }
);

const workflow = entrypoint(
  { checkpointer },
  async (userInput: string) => {
    // Standard control flow
    const processed = await processUserInput(userInput);

    let response: string;
    if (processed.processed.includes("urgent")) {
      response = await handleUrgentRequest(processed);
    } else {
      response = await handleNormalRequest(processed);
    }

    return response;
  }
);
```**2.具有简单逻辑的线性工作流程**

当您的工作流程主要是顺序的且具有简单的条件逻辑时。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, interrupt } from "@langchain/langgraph";

const essayWorkflow = entrypoint(
  { checkpointer },
  async (topic: string) => {
    // Linear flow with simple branching
    let outline = await createOutline(topic);

    if (outline.points.length < 3) {
      outline = await expandOutline(outline);
    }

    const draft = await writeDraft(outline);

    // Human review checkpoint
    const feedback = interrupt({ draft, action: "Please review" });

    let finalEssay: string;
    if (feedback === "approve") {
      finalEssay = draft;
    } else {
      finalEssay = await reviseEssay(draft, feedback);
    }

    return { essay: finalEssay };
  }
);
```

**3.快速原型制作**

当您想要快速测试想法而无需定义状态模式和图形结构的开销时。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint } from "@langchain/langgraph";

const quickPrototype = entrypoint(
  { checkpointer },
  async (data: Record<string, unknown>) => {
    // Fast iteration - no state schema needed
    const step1Result = await processStep1(data);
    const step2Result = await processStep2(step1Result);

    return { finalResult: step2Result };
  }
);
```

**4.函数范围的状态管理**

当您的状态自然地局限于各个功能并且不需要广泛共享时。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { task, entrypoint } from "@langchain/langgraph";

const analyzeDocument = task("analyzeDocument", async (document: string) => {
  // Local state management within function
  const sections = extractSections(document);
  const summaries = await Promise.all(sections.map(summarize));
  const keyPoints = extractKeyPoints(summaries);

  return {
    sections: sections.length,
    summaries,
    keyPoints,
  };
});

const documentProcessor = entrypoint(
  { checkpointer },
  async (document: string) => {
    const analysis = await analyzeDocument(document);
    // State is passed between functions as needed
    return await generateReport(analysis);
  }
);
```

## 结合两个 API

您可以在同一应用程序中同时使用这两个 API。当系统的不同部分有不同的要求时，这非常有用。

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import {
  StateGraph,
  StateSchema,
  entrypoint,
  type GraphNode,
} from "@langchain/langgraph";

// Define state for complex multi-agent coordination
const CoordinationState = new StateSchema({
  rawData: z.record(z.string(), z.unknown()),
  processedData: z.record(z.string(), z.unknown()).optional(),
});

// Simple data processing using Functional API
const dataProcessor = entrypoint({}, async (rawData: Record<string, unknown>) => {
  const cleaned = await cleanData(rawData);
  const transformed = await transformData(cleaned);
  return transformed;
});

// Use the functional API result in the graph
const orchestratorNode: GraphNode<typeof CoordinationState> = async (state) => {
  const processedData = await dataProcessor.invoke(state.rawData);
  return { processedData };
};

// Complex multi-agent coordination using Graph API
const coordinationGraph = new StateGraph(CoordinationState)
  .addNode("orchestrator", orchestratorNode)
  .addNode("agentA", agentANode)
  .addNode("agentB", agentBNode);
```

## API之间的迁移

### 从函数式 API 到图形 API

当您的功能工作流程变得复杂时，您可以迁移到 Graph API：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as z from "zod";
import { entrypoint } from "@langchain/langgraph";

// Before: Functional API
const complexWorkflow = entrypoint(
  { checkpointer },
  async (inputData: Record<string, unknown>) => {
    const step1 = await processStep1(inputData);

    let result: unknown;
    if (step1.needsAnalysis) {
      const analysis = await analyzeData(step1);
      if (analysis.confidence > 0.8) {
        result = await highConfidencePath(analysis);
      } else {
        result = await lowConfidencePath(analysis);
      }
    } else {
      result = await simplePath(step1);
    }

    return result;
  }
);

// After: Graph API
import {
  StateGraph,
  StateSchema,
  type GraphNode,
  type ConditionalEdgeRouter,
} from "@langchain/langgraph";

const WorkflowState = new StateSchema({
  inputData: z.record(z.string(), z.unknown()),
  step1Result: z.record(z.string(), z.unknown()).optional(),
  analysis: z.record(z.string(), z.unknown()).optional(),
  finalResult: z.unknown().optional(),
});

const shouldAnalyze: ConditionalEdgeRouter<typeof WorkflowState> = (state) => {
  return state.step1Result?.needsAnalysis ? "analyze" : "simplePath";
};

const confidenceCheck: ConditionalEdgeRouter<typeof WorkflowState> = (state) => {
  return (state.analysis?.confidence as number) > 0.8
    ? "highConfidence"
    : "lowConfidence";
};

const workflow = new StateGraph(WorkflowState)
  .addNode("step1", processStep1Node)
  .addConditionalEdges("step1", shouldAnalyze)
  .addNode("analyze", analyzeDataNode)
  .addConditionalEdges("analyze", confidenceCheck);
// ... add remaining nodes and edges
```

### 从图形到函数式 API

当您的图表对于简单的线性过程变得过于复杂时：

```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { z } from "zod/v4";
import { StateGraph, StateSchema, entrypoint } from "@langchain/langgraph";

// Before: Over-engineered Graph API
const SimpleState = new StateSchema({
  input: z.string(),
  step1: z.string().optional(),
  step2: z.string().optional(),
  result: z.string().optional(),
});

// After: Simplified Functional API
const simpleWorkflow = entrypoint(
  { checkpointer },
  async (inputData: string) => {
    const step1 = await processStep1(inputData);
    const step2 = await processStep2(step1);
    return await finalizeResult(step2);
  }
);
```

## 总结

当您需要显式控制工作流结构、复杂分支、并行处理或团队协作优势时，请选择 **Graph API**。

当您想要以最小的更改将 LangGraph 功能添加到现有代码、具有简单的线性工作流程或需要快速原型设计功能时，请选择 **Functional API**。这两个 API 都提供相同的核心 LangGraph 功能（持久性、流式传输、人机循环、内存），但将它们封装在不同的范例中，以适应不同的开发风格和用例。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/choosing-apis.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>