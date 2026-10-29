<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangSmith Observability | https://docs.langchain.com/oss/javascript/langgraph/observability -->

# LangSmith 可观测性

跟踪是代理从输入到输出所采取的一系列步骤。每个单独的步骤都由一次运行表示。您可以使用[LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-observability)来可视化这些执行步骤。要使用它，[enable tracing for your agent](/langsmith/trace-with-langgraph)。这使您能够执行以下操作：

* [Debug a locally running agent](/langsmith/observability-studio#debug-langsmith-traces)。
* [Evaluate the agent performance](/oss/javascript/langchain/test/evals)。
* [Monitor the agent](/langsmith/dashboards)。

## 先决条件

在开始之前，请确保您具备以下条件：

* **LangSmith帐户**：注册（免费）或在[smith.langchain.com](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-observability)登录。
* **A LangSmith API 密钥**：遵循 [Create an API key](/langsmith/create-account-api-key) 指南。

## 启用跟踪

> [!注意]
>
> 在发送跟踪之前，在[agent-based workspace](/langsmith/agents)、[create an agent](/langsmith/create-an-agent) 中进行一次。使用[agent addressing](/langsmith/log-traces-to-agent)选择其标识符和环境。如果集成需要 `project_name`，请使用所选环境的 [⟦T5⟧](/langsmith/create-an-agent#use-an-environment-project) 作为兼容性值。

要为代理启用跟踪，请设置以下环境变量：

```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export LANGSMITH_AGENT_ID="<your-agent-id>"
export LANGSMITH_AGENT_ENVIRONMENT="production"
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=<your-api-key>
```

跟踪显示在设置期间配置的目标中。

欲了解更多信息，请参阅[Trace with LangGraph](/langsmith/trace-with-langgraph)。

## 有选择地跟踪

您可以选择使用 LangSmith 的 `tracing_context` 上下文管理器来跟踪代理的特定调用或部分：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";

// This WILL be traced
const tracer = new LangChainTracer();
await agent.invoke(
  {
    messages: [{role: "user", content: "Send a test email to alice@example.com"}]
  },
  { callbacks: [tracer] }
);

// This will NOT be traced (if LANGSMITH_TRACING is not set)
await agent.invoke(
  {
    messages: [{role: "user", content: "Send another email"}]
  }
);
```

## 选择代理和环境

使用`LANGSMITH_AGENT_ID`和`LANGSMITH_AGENT_ENVIRONMENT`选择注册的代理和环境。对于每个请求路由，请在代码中传递代理地址。参见[Log traces to an agent](/langsmith/log-traces-to-agent)。> **基于项目的工作区和自托管 LangSmith**
>
> 将 `LANGSMITH_PROJECT` 设置为跟踪项目名称，而不是设置代理变量。对于在基于代理的工作区中需要 `project_name` 的集成，请使用环境的 [⟦T11⟧](/langsmith/create-an-agent#use-an-environment-project) 作为兼容性值。

## 将元数据添加到跟踪中

您可以使用自定义元数据和标签来注释您的跟踪：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";

const tracer = new LangChainTracer();
await agent.invoke(
  {
    messages: [{role: "user", content: "Send a test email to alice@example.com"}]
  },
  config: {
    tags: ["production", "email-assistant", "v1.0"],
    metadata: {
      userId: "user123",
      sessionId: "session456",
      environment: "production"
    }
  },
);

```

此自定义元数据和标签将附加到 LangSmith 中的跟踪。

> [!提示]
>
> 要了解有关如何使用跟踪来调试、评估和监控代理的更多信息，请参阅 [LangSmith documentation](/langsmith/observability)。

## 使用匿名器来防止在跟踪中记录敏感数据

您可能想要屏蔽敏感数据以防止其被记录到LangSmith。您可以创建 [anonymizers](/langsmith/mask-inputs-outputs#rule-based-masking-of-inputs-and-outputs) 并将其应用到
您的图表使用配置。此示例将从发送到 LangSmith 的跟踪中编辑与社会保障号格式 XXX-XX-XXXX 匹配的任何内容。

```typescript TypeScript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateGraph } from "@langchain/langgraph";
import { LangChainTracer } from "@langchain/core/tracers/tracer_langchain";
import { StateAnnotation } from "./state.js";
import { createAnonymizer } from "langsmith/anonymizer"
import { Client } from "langsmith"

const anonymizer = createAnonymizer([
  // Matches SSNs
  { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/, replace: "<ssn>" }
])

const langsmithClient = new Client({ anonymizer })
const tracer = new LangChainTracer({
  client: langsmithClient,
});

export const graph = new StateGraph(StateAnnotation)
  .compile()
  .withConfig({ callbacks: [tracer] });
```

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/observability.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。