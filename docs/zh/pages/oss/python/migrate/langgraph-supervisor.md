<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Migrate from langgraph-supervisor | https://docs.langchain.com/oss/python/migrate/langgraph-supervisor -->

# 从 langgraph-supervisor 迁移

使用 create_agent 和工具包装的子代理从 langgraph-supervisor 包迁移到子代理模式。

[⟦T7⟧](https://github.com/langchain-ai/langgraph-supervisor-py) 软件包不再主动维护。相反，请使用[subagents](/oss/python/langchain/multi-agent/subagents)模式：主要代理通过将其称为[tools](/oss/python/langchain/tools)来协调专业工人。

本指南介绍如何从 `create_supervisor` 迁移到 [⟦T9⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)，包括使用 [⟦T10⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 和外部 API 回调的设置。

## 变更摘要

| langgraph-supervisor | langgraph-supervisor推荐更换 |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_supervisor` 以工作代理作为图节点 | [⟦T12⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 与包装为 [⟦T13⟧](https://reference.langchain.com/python/langchain-core/tools/convert/tool) 函数的子代理 || `output_mode` 消息历史记录 |在工具包装器中格式化子代理输出（请参阅[subagent outputs](/oss/python/langchain/multi-agent/subagents#subagent-outputs)）|
| `create_handoff_tool` 用于自定义路由 |自定义 [⟦T16⟧](https://reference.langchain.com/python/langchain-core/tools/convert/tool) 调用 `subagent.invoke(...)` |
|嵌套主管（主管的`create_supervisor`）|包装为 [⟦T19⟧](https://reference.langchain.com/python/langchain-core/tools/convert/tool) 的子代理，调用其他子代理 |

## 基本迁移

在`langgraph-supervisor`中，工作代理是图节点，监督者使用切换工具在它们之间路由：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph_supervisor import create_supervisor
from langgraph.prebuilt import create_react_agent

research_agent = create_react_agent(
    model=model,
    tools=[web_search],
    name="research_expert",
    prompt="You are a research expert.",
)

math_agent = create_react_agent(
    model=model,
    tools=[add, multiply],
    name="math_expert",
    prompt="You are a math expert.",
)

workflow = create_supervisor(
    [research_agent, math_agent],
    model=model,
    prompt="Route research questions to research_expert and math to math_expert.",
)
app = workflow.compile(checkpointer=checkpointer)
```

通过将每个工作人员包装为主代理上的工具来迁移到子代理模式：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

research_agent = create_agent(
    model=model,
    tools=[web_search],
    system_prompt="You are a research expert.",
)

math_agent = create_agent(
    model=model,
    tools=[add, multiply],
    system_prompt="You are a math expert.",
)


@tool("research_expert", description="Research expert for current events and web lookups.")
def call_research_agent(query: str) -> str:
    result = research_agent.invoke({"messages": [{"role": "user", "content": query}]})
    return result["messages"][-1].content


@tool("math_expert", description="Math expert for calculations.")
def call_math_agent(query: str) -> str:
    result = math_agent.invoke({"messages": [{"role": "user", "content": query}]})
    return result["messages"][-1].content


supervisor = create_agent(
    model=model,
    tools=[call_research_agent, call_math_agent],
    system_prompt=(
        "Route research questions to research_expert and math to math_expert."
    ),
    checkpointer=InMemorySaver(),
)
```

有关完整演练，请参阅 [Build a personal assistant with subagents](/oss/python/langchain/multi-agent/subagents-personal-assistant)。

## 迁移中断和恢复流程

常见的 `langgraph-supervisor` 设置在工作代理工具内使用 [⟦T22⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 来暂停执行，直到外部服务完成：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Before: create_supervisor with a subgraph node
#
# Supervisor (create_supervisor)
#   └── ResearchAgent (subgraph node)
#         └── preview_tool
#               ├── fire_external_api()      # kicks off async job
#               ├── result = interrupt(...)  # pauses graph, waits for callback
#               └── render_results(result)   # runs after resume
```

对于子代理模式，可以使用相同的流程。子代理工具内的[⟦T23⟧](https://reference.langchain.com/python/langgraph/types/interrupt)通过工具包装的[⟦T24⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)层向上传播到最外面的图。您的外部回调仍然可以通过 `Command(resume=result)` 恢复。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import interrupt


@tool
def preview_tool(document_id: str) -> str:
    """Run an async enrichment preview and wait for results."""
    job_id = fire_external_api(document_id)
    result = interrupt({"job_id": job_id, "status": "pending"})
    return render_results(result)


research_agent = create_agent(
    model=model,
    tools=[preview_tool],
    system_prompt="You are a research agent.",
)

@tool("research_agent", description="Research and enrichment tasks.")
def call_research_agent(query: str) -> str:
    result = research_agent.invoke({"messages": [{"role": "user", "content": query}]})
    return result["messages"][-1].content

supervisor = create_agent(
    model=model,
    tools=[call_research_agent],
    system_prompt="Delegate research tasks to research_agent.",
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "1"}}
```

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.types import Command

# Invoke — preview_tool calls interrupt() and the graph pauses
response = supervisor.invoke(
    {"messages": [{"role": "user", "content": "Preview enrichment for doc-123"}]},
    config=config,
)
# response contains __interrupt__

# External service completes and calls back into your app
supervisor.invoke(Command(resume=external_result), config=config)
```### 中断传播的要求

要使 [⟦T26⟧](https://reference.langchain.com/python/langgraph/types/interrupt) 通过嵌套的 [⟦T27⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 层向上冒泡，请遵循以下规则：

1. **仅编译带有检查点的最外层图。** 让子代理不带 `checkpointer=...`，以便它们使用 [per-invocation persistence](/oss/python/langgraph/use-subgraphs#per-invocation-default) 并在运行时继承父级的检查点。
2. **将 `thread_id` 传入 `configurable`。** 外部 `invoke()` 或 `stream_events()` 调用必须包含 `thread_id`，以便图表可以检查点并恢复。

这些规则适用于任意嵌套的设置。例如，自定义 [⟦T34⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 外层、中间 [⟦T35⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 主管和内部 [⟦T36⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 子代理都遵循相同的机制：

```txt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
Custom StateGraph (outer, with checkpointer)
  └── prospecting_agent (create_agent, no checkpointer)
        └── call_powerup_agent tool → powerup_agent.invoke(...)
              └── powerup_agent (create_agent, no checkpointer)
                    └── preview_tool → interrupt(...)
```

当`preview_tool`调用[⟦T38⟧](https://reference.langchain.com/python/langgraph/types/interrupt)时，异常会通过[⟦T39⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)层和表面冒泡，就像外部[⟦T41⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)调用结果上的`__interrupt__`一样。您现有的 `Command(resume=result)` 回调路径仍然有效。

有关中断如何通过子图传播的更多信息，请参阅[Subgraph persistence: Interrupts](/oss/python/langgraph/use-subgraphs#per-invocation-default)和[Checkpointing and state inspection](/oss/python/langchain/multi-agent/subagents#checkpointing-and-state-inspection)。

## 何时使用自定义 StateGraph

当您需要将确定性步骤与代理步骤混合时，请使用自定义 [⟦T43⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)。例如，固定路由、验证或外部 API 调用以及 [⟦T44⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent) 节点。

## 迁移嵌套主管`langgraph-supervisor` 通过编译监督程序并将其传递给另一个 `create_supervisor` 调用来支持多级层次结构。使用子代理模式，您有两种选择：

1. **扁平化为单个主管**，每个叶代理使用一个工具。当每个工人都是独立的时候，这是最简单的方法。
2. **Nest 工具在需要中间协调时调用**。将中间层代理（本身是带有自己的子代理工具的[⟦T47⟧](https://reference.langchain.com/python/langchain/agents/factory/create_agent)）包装为顶级主管上的工具。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver

# Middle-tier agent with its own subagents
billing_team = create_agent(
    model=model,
    tools=[call_refunds_agent, call_invoices_agent],
    system_prompt="Coordinate billing specialists.",
)

@tool("billing_team", description="Handle billing, refunds, and invoices.")
def call_billing_team(query: str) -> str:
    result = billing_team.invoke({"messages": [{"role": "user", "content": query}]})
    return result["messages"][-1].content

# Top-level supervisor
top_supervisor = create_agent(
    model=model,
    tools=[call_billing_team, call_support_agent],
    system_prompt="Route billing to billing_team and general support to support_agent.",
    checkpointer=InMemorySaver(),
)
```

如果您需要静态子图发现、每层检查点命名空间或级别之间的共享状态键，请改用自定义 [⟦T48⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 和 [subgraph nodes](/oss/python/langgraph/use-subgraphs#add-a-subgraph-as-a-node)。

## 迁移消息历史记录选项

`create_supervisor` 公开 `output_mode` 来控制工作人员消息在对话历史记录中的显示方式：

* `full_history`：包含来自工作代理的所有消息。
* `last_message`：仅包含工作人员的最终响应。

使用子代理模式，可以在工具包装器中控制它。仅返回 `last_message` 行为的最终消息，或返回 `full_history` 行为的完整对话的格式化摘要。有关将附加状态传递回主管的模式，请参阅[Subagent outputs](/oss/python/langchain/multi-agent/subagents#subagent-outputs)。

## 另请参阅* [Subagents](/oss/python/langchain/multi-agent/subagents)：模式概述和设计决策
* [Build a personal assistant with subagents](/oss/python/langchain/multi-agent/subagents-personal-assistant)：分步主管教程
* [Use subgraphs](/oss/python/langgraph/use-subgraphs)：子图持久化、中断和状态检查
* [Interrupts](/oss/python/langgraph/interrupts)：暂停和恢复图形执行
* [LangGraph v1 migration guide](/oss/python/migrate/langgraph-v1)：从`create_react_agent`迁移到`create_agent`

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/python/migrate/langgraph-supervisor.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>