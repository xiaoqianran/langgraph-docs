<!-- langgraph-docs: LangGraph overview | https://docs.langchain.com/oss/python/langgraph/overview -->

# LangGraph overview

Low-level orchestration framework and runtime for long-running, stateful agents

LangGraph is a low-level orchestration framework and runtime for long-running, stateful agents. You define workflows as graphs of shared state, nodes, and edges, and can mix deterministic steps with LLM-driven steps in the same graph.

LangGraph focuses on orchestration capabilities such as [durable execution](/oss/python/langgraph/persistence), [streaming](/oss/python/langgraph/streaming), and [human-in-the-loop](/oss/python/langgraph/interrupts). It does not prescribe prompts or agent architecture.

Before you start, learn the building blocks agents use, especially [models](/oss/python/langchain/models) and [tools](/oss/python/langchain/tools). Docs examples often use [LangChain](/oss/python/langchain/overview) for those integrations, but LangGraph does not require LangChain.

If you want a higher-level agent loop first, use [Deep Agents](/oss/python/deepagents/overview) or LangChain [agents](/oss/python/langchain/agents). Use LangGraph when you need explicit control over state and control flow.

**How LangChain products fit together**

* [Deep Agents](/oss/python/deepagents/overview) is an [agent harness](/oss/python/concepts/products#agent-harnesses-like-the-deep-agents-sdk): planning, subagents, filesystem tools, and context management on top of LangGraph.
* [LangChain](/oss/python/langchain/overview) is the agent framework: abstractions and integrations for models, tools, and agent loops.
* [LangGraph](/oss/python/langgraph/overview) is the orchestration runtime: durable execution, streaming, human-in-the-loop, and persistence.
* [LangSmith](/langsmith/observability) is the platform for tracing, evaluation, prompts, and deployment across frameworks.
* [LangSmith Engine](/langsmith/engine) detects issues in LangGraph agent traces and proposes fixes. You can open a pull request with the proposed fix from the Engine tab.
* [LangSmith Fleet](/langsmith/fleet/index) is the no-code agent builder for templates, integrations, and routine automation.

For a comparison of the open source stack, see [Frameworks, runtimes, and harnesses](/oss/python/concepts/products).

## &#x20;Install

```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
pip install -U langgraph
```

```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
uv add langgraph
```

Create a minimal graph:

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph, MessagesState, START, END

def mock_llm(state: MessagesState):
    return {"messages": [{"role": "ai", "content": "hello world"}]}

graph = StateGraph(MessagesState)
graph.add_node(mock_llm)
graph.add_edge(START, "mock_llm")
graph.add_edge("mock_llm", END)
graph = graph.compile()

graph.invoke({"messages": [{"role": "user", "content": "hi!"}]})
```

For a full calculator agent, see the [LangGraph quickstart](/oss/python/langgraph/quickstart).

## Capabilities

LangGraph provides the runtime primitives for stateful, long-running workflows. It does not abstract prompts or force a fixed agent architecture.

* **Deterministic and agentic steps**: Combine hand-coded nodes with model-driven nodes in one graph.
* [**Persistence**](/oss/python/langgraph/persistence): Checkpoint state and resume after failures or pauses.
* [**Human-in-the-loop**](/oss/python/langgraph/interrupts): Pause execution, inspect or edit state, then continue.
* [**Memory**](/oss/python/concepts/memory): Short-term thread state and longer-term memory across sessions.
* [**Streaming**](/oss/python/langgraph/streaming): Stream tokens, state updates, and other events as the graph runs.

## Integrations, deployment, and observability

LangGraph works on its own. However, you can also pair it with other LangCHain products:

> [card] [LangChain](/oss/python/langchain/overview)
>
> Integrations and agent abstractions built on LangGraph.

> [card] [LangSmith Deployment](/langsmith/deployment)
>
> Deploy and scale stateful agents, with visual prototyping in Studio.

> [card] [LangSmith Observability](/langsmith/observability)
>
> Trace requests, evaluate outputs, and monitor deployments.

## See also

* [LangGraph quickstart](/oss/python/langgraph/quickstart)
* [Graph API overview](/oss/python/langgraph/graph-api)
* [Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)
* [Frameworks, runtimes, and harnesses](/oss/python/concepts/products)

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/overview.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).