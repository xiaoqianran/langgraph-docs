<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Choosing between Graph and Functional APIs | https://docs.langchain.com/oss/python/langgraph/choosing-apis -->

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

### 何时使用图形 API[Graph API](/oss/python/langgraph/graph-api) 使用声明式方法，您可以定义节点、边和共享状态来创建可视化图形结构。

**1.复杂的决策树和分支逻辑**

当您的工作流程有多个取决于各种条件的决策点时，Graph API 会使这些分支变得明确且易于可视化。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Graph API: Clear visualization of decision paths
from langgraph.graph import StateGraph
from typing import TypedDict

class AgentState(TypedDict):
    messages: list
    current_tool: str
    retry_count: int

def should_continue(state):
    if state["retry_count"] > 3:
        return "end"
    elif state["current_tool"] == "search":
        return "process_search"
    else:
        return "call_llm"

workflow = StateGraph(AgentState)
workflow.add_node("call_llm", call_llm_node)
workflow.add_node("process_search", search_node)
workflow.add_conditional_edges("call_llm", should_continue)
```

**2.跨多个组件的状态管理**

当您需要在工作流程的不同部分之间共享和协调状态时，Graph API 的显式状态管理非常有用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Multiple nodes can access and modify shared state
class WorkflowState(TypedDict):
    user_input: str
    search_results: list
    generated_response: str
    validation_status: str

def search_node(state):
    # Access shared state
    results = search(state["user_input"])
    return {"search_results": results}

def validation_node(state):
    # Access results from previous node
    is_valid = validate(state["generated_response"])
    return {"validation_status": "valid" if is_valid else "invalid"}
```

**3.具有同步的并行处理**

当您需要并行运行多个操作然后合并它们的结果时，Graph API 可以自然地处理这个问题。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Parallel processing of multiple data sources
workflow.add_node("fetch_news", fetch_news)
workflow.add_node("fetch_weather", fetch_weather)
workflow.add_node("fetch_stocks", fetch_stocks)
workflow.add_node("combine_data", combine_all_data)

# All fetch operations run in parallel
workflow.add_edge(START, "fetch_news")
workflow.add_edge(START, "fetch_weather")
workflow.add_edge(START, "fetch_stocks")

# Combine waits for all parallel operations to complete
workflow.add_edge("fetch_news", "combine_data")
workflow.add_edge("fetch_weather", "combine_data")
workflow.add_edge("fetch_stocks", "combine_data")
```

**4.团队开发和文档**

Graph API 的可视化特性使团队更容易理解、记录和维护复杂的工作流程。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Clear separation of concerns - each team member can work on different nodes
workflow.add_node("data_ingestion", data_team_function)
workflow.add_node("ml_processing", ml_team_function)
workflow.add_node("business_logic", product_team_function)
workflow.add_node("output_formatting", frontend_team_function)
```

### 何时使用函数式 API

[Functional API](/oss/python/langgraph/functional-api) 使用命令式方法将 LangGraph 功能集成到标准程序代码中。

**1.现有程序代码**

当您拥有使用标准控制流的现有代码并希望以最少的重构添加 LangGraph 功能时。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Functional API: Minimal changes to existing code
from langgraph.func import entrypoint, task

@task
def process_user_input(user_input: str) -> dict:
    # Existing function with minimal changes
    return {"processed": user_input.lower().strip()}

@entrypoint(checkpointer=checkpointer)
def workflow(user_input: str) -> str:
    # Standard Python control flow
    processed = process_user_input(user_input).result()

    if "urgent" in processed["processed"]:
        response = handle_urgent_request(processed).result()
    else:
        response = handle_normal_request(processed).result()

    return response
```**2.具有简单逻辑的线性工作流程**

当您的工作流程主要是顺序的且具有简单的条件逻辑时。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@entrypoint(checkpointer=checkpointer)
def essay_workflow(topic: str) -> dict:
    # Linear flow with simple branching
    outline = create_outline(topic).result()

    if len(outline["points"]) < 3:
        outline = expand_outline(outline).result()

    draft = write_draft(outline).result()

    # Human review checkpoint
    feedback = interrupt({"draft": draft, "action": "Please review"})

    if feedback == "approve":
        final_essay = draft
    else:
        final_essay = revise_essay(draft, feedback).result()

    return {"essay": final_essay}
```

**3.快速原型制作**

当您想要快速测试想法而无需定义状态模式和图形结构的开销时。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@entrypoint(checkpointer=checkpointer)
def quick_prototype(data: dict) -> dict:
    # Fast iteration - no state schema needed
    step1_result = process_step1(data).result()
    step2_result = process_step2(step1_result).result()

    return {"final_result": step2_result}
```

**4.函数范围的状态管理**

当您的状态自然地局限于各个功能并且不需要广泛共享时。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
@task
def analyze_document(document: str) -> dict:
    # Local state management within function
    sections = extract_sections(document)
    summaries = [summarize(section) for section in sections]
    key_points = extract_key_points(summaries)

    return {
        "sections": len(sections),
        "summaries": summaries,
        "key_points": key_points
    }

@entrypoint(checkpointer=checkpointer)
def document_processor(document: str) -> dict:
    analysis = analyze_document(document).result()
    # State is passed between functions as needed
    return generate_report(analysis).result()
```

## 结合两个 API

您可以在同一应用程序中同时使用这两个 API。当系统的不同部分有不同的要求时，这非常有用。

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
from langgraph.graph import StateGraph
from langgraph.func import entrypoint

# Complex multi-agent coordination using Graph API
coordination_graph = StateGraph(CoordinationState)
coordination_graph.add_node("orchestrator", orchestrator_node)
coordination_graph.add_node("agent_a", agent_a_node)
coordination_graph.add_node("agent_b", agent_b_node)

# Simple data processing using Functional API
@entrypoint()
def data_processor(raw_data: dict) -> dict:
    cleaned = clean_data(raw_data).result()
    transformed = transform_data(cleaned).result()
    return transformed

# Use the functional API result in the graph
def orchestrator_node(state):
    processed_data = data_processor.invoke(state["raw_data"])
    return {"processed_data": processed_data}
```

## API之间的迁移

### 从函数式 API 到图形 API

当您的功能工作流程变得复杂时，您可以迁移到 Graph API：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Before: Functional API
@entrypoint(checkpointer=checkpointer)
def complex_workflow(input_data: dict) -> dict:
    step1 = process_step1(input_data).result()

    if step1["needs_analysis"]:
        analysis = analyze_data(step1).result()
        if analysis["confidence"] > 0.8:
            result = high_confidence_path(analysis).result()
        else:
            result = low_confidence_path(analysis).result()
    else:
        result = simple_path(step1).result()

    return result

# After: Graph API
class WorkflowState(TypedDict):
    input_data: dict
    step1_result: dict
    analysis: dict
    final_result: dict

def should_analyze(state):
    return "analyze" if state["step1_result"]["needs_analysis"] else "simple_path"

def confidence_check(state):
    return "high_confidence" if state["analysis"]["confidence"] > 0.8 else "low_confidence"

workflow = StateGraph(WorkflowState)
workflow.add_node("step1", process_step1_node)
workflow.add_conditional_edges("step1", should_analyze)
workflow.add_node("analyze", analyze_data_node)
workflow.add_conditional_edges("analyze", confidence_check)
# ... add remaining nodes and edges
```

### 从图形到函数式 API

当您的图表对于简单的线性过程变得过于复杂时：

```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
# Before: Over-engineered Graph API
class SimpleState(TypedDict):
    input: str
    step1: str
    step2: str
    result: str

# After: Simplified Functional API
@entrypoint(checkpointer=checkpointer)
def simple_workflow(input_data: str) -> str:
    step1 = process_step1(input_data).result()
    step2 = process_step2(step1).result()
    return finalize_result(step2).result()
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