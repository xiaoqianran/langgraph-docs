<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Choosing between Graph and Functional APIs | https://docs.langchain.com/oss/javascript/langgraph/choosing-apis -->

# 在图 API 和函数式 API 之间进行选择

对于新工作流程，首选 LangGraph Graph API。包装其他框架以进行 LangSmith 部署时，请使用功能 API。

LangGraph 为代理工作流程提供两个 API：[Graph API](/oss/javascript/langgraph/graph-api) 和 [Functional API](/oss/javascript/langgraph/functional-api)。两者共享相同的运行时（持久性、流式传输、人机交互和内存）。

图形 API 是默认的。对于新的LangGraph代理以及任何受益于显式状态、分支或图形可视化的工作流程，更喜欢它。

当您需要在 LangSmith 部署上进行 [deploy other frameworks](/langsmith/deploy-other-frameworks) 时，请使用功能 API。使用 `@entrypoint` 和 `@task` 包装现有的 Claude Agent SDK、Strands、CrewAI、AutoGen 或类似代理，以便代理服务器可以通过持久性、流式传输和跟踪来运行它。

## 图形 API（默认）

使用 LangGraph 本身构建时选择 Graph API：

* 跨节点显式共享[state](/oss/javascript/langgraph/graph-api#state)
* 稍后合并的条件分支和并行路径
* 用于调试和记录的图表
* 团队审查工作流程结构

从 [Build checklist for the Graph API](/oss/javascript/langgraph/use-graph-api) 或 [Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api) 开始。

## 函数式API（其他框架）当您在另一个框架中已有代理并且想要 LangSmith 部署功能而无需将该代理重写为图形时，请选择功能 API：

* 对现有程序或框架代码进行最少的更改
* 标准控制流程（`if`/`else`、循环、函数调用）
* 函数范围的值而不是共享状态模式

对于包装和部署模式，请参阅[Deploy other frameworks](/langsmith/deploy-other-frameworks)。有关功能 API 概念和操作方法，请参阅 [Functional API overview](/oss/javascript/langgraph/functional-api)。

## 并排形状

同样的小工作流程在每个 API 中看起来都不同。此示例对一个数字进行分类，然后返回一条消息：

```ts Graph API theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
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

```ts Functional API theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { entrypoint, task } from "@langchain/langgraph";

const isEven = task("isEven", async (number: number) => {
  return number % 2 === 0;
});

const formatMessage = task("formatMessage", async (isEven: boolean) => {
  return isEven ? "The number is even." : "The number is odd.";
});

const workflow = entrypoint(
  { name: "workflow" },
  async (inputs: { number: number }) => {
    const even = await isEven(inputs.number);
    return await formatMessage(even);
  }
);

await workflow.invoke({ number: 7 });
```

Graph API 使状态和转换变得明确。功能 API 保留普通控制流并在任务之间传递值。|关注|图形API |函数式 API |
| - | - | - |
|风格|声明性节点、边和共享状态 |使用 `@entrypoint` / `@task` (Python) 或 `entrypoint` / `task` (TypeScript) 的命令式函数 |
|控制流程|边和条件边 |语言`if`/`else`、循环和调用 |
|状态|显式 [state](/oss/javascript/langgraph/graph-api#state) 和 [reducers](/oss/javascript/langgraph/graph-api#reducers) |范围限定为入口点和任务 |
|检查点|每个 [super-step](/oss/javascript/langgraph/graph-api) 之后的新检查点 |任务结果保存到入口点检查点 |
|可视化|一流的图表|无静态图形可视化（图形是在运行时构建的）|
|最适合| LangGraph 工作流程的默认设置 |包装其他框架进行部署 |

当线性功能 API 子工作流位于图形 API 协调器内部时，您仍然可以将这两个 API 组合在一个应用程序中，反之亦然。

## 另请参阅

* [Build checklist for the Graph API](/oss/javascript/langgraph/use-graph-api)
* [Thinking in the Graph API](/oss/javascript/langgraph/thinking-in-graph-api)
* [Graph API overview](/oss/javascript/langgraph/graph-api)
* [Deploy other frameworks](/langsmith/deploy-other-frameworks)
* [Functional API overview](/oss/javascript/langgraph/functional-api)

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/choosing-apis.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。