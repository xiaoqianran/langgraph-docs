<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: LangSmith Observability | https://docs.langchain.com/oss/python/langgraph/observability -->

# 朗史密斯可观测性

跟踪是应用程序从输入到输出所采取的一系列步骤。每个单独的步骤都由一次运行表示。您可以使用[LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-observability)来可视化这些执行步骤。要使用它，[enable tracing for your application](/langsmith/trace-with-langgraph)。这使您能够执行以下操作：

* [Debug a locally running application](/langsmith/observability-studio#debug-langsmith-traces)。
* [Evaluate the application performance](/oss/python/langchain/test/evals)。
* [Monitor the application](/langsmith/dashboards)。

## 先决条件

在开始之前，请确保您具备以下条件：

* **LangSmith 帐户**：注册（免费）或通过 [smith.langchain.com](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-observability) 登录。
* **LangSmith API 密钥**：遵循 [Create an API key](/langsmith/create-account-api-key) 指南​​。

## 启用跟踪

要为您的应用程序启用跟踪，请设置以下环境变量：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=<your-api-key>
```

默认情况下，跟踪将记录到名为 `default` 的项目中。要配置自定义项目名称，请参阅[Log to a project](#log-to-a-project)。

欲了解更多信息，请参阅[Trace with LangGraph](/langsmith/trace-with-langgraph)。

## 有选择地跟踪

您可以选择使用 LangSmith 的 `tracing_context` 上下文管理器来跟踪应用程序的特定调用或部分：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import langsmith as ls

# This WILL be traced
with ls.tracing_context(enabled=True):
    agent.invoke({"messages": [{"role": "user", "content": "Send a test email to alice@example.com"}]})

# This will NOT be traced (if LANGSMITH_TRACING is not set)
agent.invoke({"messages": [{"role": "user", "content": "Send another email"}]})
```

## 登录到项目

<Accordion title="Statically">
  您可以通过设置 `LANGSMITH_PROJECT` 环境变量来为整个应用程序设置自定义项目名称：

  ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  export LANGSMITH_PROJECT=my-agent-project
  ```
</Accordion>

<Accordion title="Dynamically">
  您可以通过编程方式设置项目名称以进行特定操作：

  ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import langsmith as ls

  with ls.tracing_context(project_name="email-agent-test", enabled=True):
      response = agent.invoke({
          "messages": [{"role": "user", "content": "Send a welcome email"}]
      })
  ```
</Accordion>

## 将元数据添加到跟踪中您可以使用自定义元数据和标签来注释您的跟踪：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
response = agent.invoke(
    {"messages": [{"role": "user", "content": "Send a welcome email"}]},
    config={
        "tags": ["production", "email-assistant", "v1.0"],
        "metadata": {
            "user_id": "user_123",
            "session_id": "session_456",
            "environment": "production"
        }
    }
)
```

`tracing_context`还接受标签和元数据以进行细粒度控制：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
with ls.tracing_context(
    project_name="email-agent-test",
    enabled=True,
    tags=["production", "email-assistant", "v1.0"],
    metadata={"user_id": "user_123", "session_id": "session_456", "environment": "production"}):
    response = agent.invoke(
        {"messages": [{"role": "user", "content": "Send a welcome email"}]}
    )
```

此自定义元数据和标签将附加到 LangSmith 中的跟踪。

<Tip>
  要了解有关如何使用跟踪来调试、评估和监控代理的更多信息，请参阅 [LangSmith documentation](/langsmith/observability)。
</Tip>

## 使用匿名器来防止在跟踪中记录敏感数据

您可能想要屏蔽敏感数据以防止其被记录到 LangSmith。您可以创建 [anonymizers](/langsmith/mask-inputs-outputs#rule-based-masking-of-inputs-and-outputs) 并将其应用到
您的图表使用配置。此示例将从发送到 LangSmith 的跟踪中编辑与社会保障号格式 XXX-XX-XXXX 匹配的任何内容。

```python Python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain_core.tracers.langchain import LangChainTracer
from langgraph.graph import StateGraph, MessagesState
from langsmith import Client
from langsmith.anonymizer import create_anonymizer

anonymizer = create_anonymizer([
    # Matches SSNs
    { "pattern": r"\b\d{3}-?\d{2}-?\d{4}\b", "replace": "<ssn>" }
])

tracer_client = Client(anonymizer=anonymizer)
tracer = LangChainTracer(client=tracer_client)
# Define the graph
graph = (
    StateGraph(MessagesState)
    ...
    .compile()
    .with_config({'callbacks': [tracer]})
)
```

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/observability.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>