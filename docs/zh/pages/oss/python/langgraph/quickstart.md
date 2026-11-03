<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Quickstart | https://docs.langchain.com/oss/python/langgraph/quickstart -->

# 快速入门

本快速入门演示了如何使用 LangGraph 图形 API 或功能 API 构建计算器代理。

> [!提示]
>
> **使用人工智能编码助手？**
>
> * 安装 [LangChain Docs MCP servers](/use-these-docs) 以使您的代理能够访问最新的 LangChain 文档和示例。
>
> 连接 LangChain 文档 MCP 服务器
>
> 将两个 LangChain 文档 MCP 服务器连接到我的编码代理，以便它可以查找当前的 LangChain、LangGraph 和 LangSmith 文档和 API 参考。
>
> 要添加的服务器：
>
> * `docs-langchain`: [https://docs.langchain.com/mcp](https://docs.langchain.com/mcp)
> * `reference-langchain`: [https://reference.langchain.com/mcp](https://reference.langchain.com/mcp)
>
> 检测我正在使用的代理或编辑器（Claude Code、Cursor、Codex CLI、Claude Desktop、Deep Agents Code、VS Code、Antigravity 或其他 MCP 兼容客户端）。使用 [https://docs.langchain.com/use-these-docs.md](https://docs.langchain.com/use-these-docs.md) 中的匹配设置：
>
> * Claude 代码：`claude mcp add --transport http` 对于每个服务器（默认情况下是项目范围；仅当我要求全局访问时才使用`--scope user`）。
> * Codex CLI：`codex mcp add` 以及每个服务器 URL。
> * 光标、Deep Agents 代码、VS 代码或反重力：使用我的客户页面上显示的字段名称将两个条目合并到 MCP 设置 JSON 中。
> * Claude Desktop：在“设置”>“连接器”下添加两个 URL。
>> 不要发明备用 MCP URL。配置后，确认两台服务器均已列出并且可访问。
> * 安装 [LangChain Skills](https://github.com/langchain-ai/langchain-skills) 以提高代理在 LangChain 生态系统任务上的性能。
>
> 安装LangChain技巧
>
> 为我的编码代理安装 LangChain 技能，以便它可以更好地执行 LangChain、LangGraph 和 Deep Agents 任务。
>
> 使用 [https://github.com/langchain-ai/langchain-skills](https://github.com/langchain-ai/langchain-skills) 中的代理技能安装程序：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
>   npx skills add langchain-ai/langchain-skills --skill '*' --yes
>   ```
>
> 如果我要求全局安装，请使用：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
>   npx skills add langchain-ai/langchain-skills --skill '*' --yes --global
>   ```
>
> 检测我正在使用哪个代理或编辑器。如果我使用 Claude Code 并且更喜欢插件路径，请按照该存储库自述文件中的市场安装（`/plugin marketplace add` 然后`/plugin install`）。不要发明备用技能包名称或安装 URL。安装后，确认代理可以使用该技能。

## 先决条件

在开始之前，请确保您拥有模型提供商（例如 Gemini、Anthropic、OpenAI）提供的 API 密钥。
请参阅 [chat model integrations](/oss/python/integrations/chat) 了解所有可用的提供商。

如果您使用 [LangSmith Gateway](/langsmith/llm-gateway)，则可以使用 [bring your own provider keys](/langsmith/llm-gateway-quickstart) 或使用 [Gateway Credits](/langsmith/llm-gateway-credits) 在没有提供者密钥的情况下访问模型。

## 设置

安装 `langgraph`、`langchain` 和 `langchain-anthropic`：

```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
pip install -U langgraph langchain langchain-anthropic
```

```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
uv add langgraph langchain langchain-anthropic
```

此示例使用Anthropic。在 shell 或 `.env` 文件中设置 API 密钥：

```bash Shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export ANTHROPIC_API_KEY="your-api-key"
```

```bash .env theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
ANTHROPIC_API_KEY=your-api-key
```要使用其他提供程序，请参阅 [chat model integrations](/oss/python/integrations/chat) 并在后续步骤中调整模型初始化。

## 1.选择API

两条路径都构建相同的计算器代理：模型可以调用工具，然后代理再次调用模型，直到返回最终答案。

* [Use the Graph API](#use-the-graph-api) 如果您更喜欢将代理定义为节点和边的图。
* [Use the Functional API](#use-the-functional-api) 如果您希望将代理定义为单个函数。

选择一个选项卡。创建一个文件。在上一步下方添加每个步骤的代码。

不确定该选哪个？参见[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)。有关概念信息，请参阅 [Graph API overview](/oss/python/langgraph/graph-api) 和 [Functional API overview](/oss/python/langgraph/functional-api)。> [选项卡] 使用图形 API
>
> 构建 LangGraph 图形 API 计算器快速入门
>
> 按照 LangGraph 快速入门，在此工作目录中使用 Graph API 构建 LangGraph 计算器代理。
>
> ## 第 1 步：阅读指南
>
> 检测该项目是否使用Python或TypeScript/JavaScript。获取并关注匹配的页面；将其视为包名称、模型字符串和代码的真实来源：
>
> * Python: [https://docs.langchain.com/oss/python/langgraph/quickstart.md](https://docs.langchain.com/oss/python/langgraph/quickstart.md)
> * 打字稿：[https://docs.langchain.com/oss/javascript/langgraph/quickstart.md](https://docs.langchain.com/oss/javascript/langgraph/quickstart.md)
>
> 仅使用 **使用图形 API** 选项卡。不要实现功能 API 路径。
>
> ## 步骤2：安装依赖项
>
> 使用本项目中已使用的包管理器安装 Graph API 路径所需的包。
>
> ## 步骤 3：配置模型凭据
>
> 本快速入门默认使用 Anthropic。检查是否设置了`ANTHROPIC_API_KEY`。如果不是，则要求用户创建一个密钥并将其设置在 shell 或`.env` 文件中，然后停止并等待确认。请勿发明、硬编码或提交 API 密钥。如果用户更喜欢集成文档中的另一个聊天模型提供程序，请在确认后相应地调整示例。
>
> ## 步骤 4：实现计算器代理
>> 定义工具和模型，然后定义图形 API 状态、节点、边以及指南中编译的图形。
>
> ## 步骤 5：可选 LangSmith 跟踪
>
> 询问用户是否想要跟踪。如果是，请他们自行设置`LANGSMITH_TRACING=true`和`LANGSMITH_API_KEY`。不要发明 LangSmith 钥匙。
>
> ## 步骤 6：运行代理
>
> 根据指南中的示例算术查询调用代理并打印最终结果。
>
> ## 规则
>
> * 请关注本快速入门。除非用户要求，否则不要添加部署、评估或不相关的框架。
> * 更喜欢获取的指南中显示的 Graph API 结构，而不是发明不同的代理模式。
> * 当秘密、提供商选择或项目约定不清楚时，询问而不是猜测。
>
> ## 2.定义工具和模型
>
> 此示例使用 Claude Sonnet 模型并定义加法、乘法和除法工具。
>
> 为代理创建文件（`agent.py` 或 `agent.ts`）。添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.tools import tool
> from langchain.chat_models import init_chat_model
>
>
> model = init_chat_model(
>     "claude-sonnet-4-6",
>     temperature=0
> )
>
>
> # Define tools
> @tool
> def multiply(a: int, b: int) -> int:
>     """Multiply `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a * b
>
>
> @tool
> def add(a: int, b: int) -> int:
>     """Adds `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a + b
>
>
> @tool
> def divide(a: int, b: int) -> float:
>     """Divide `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a / b
>
>
> # Augment the LLM with tools
> tools = [add, multiply, divide]
> tools_by_name = {tool.name: tool for tool in tools}
> model_with_tools = model.bind_tools(tools)
> ```
>
> ## 3. 定义状态
>
> 图表的状态存储消息和 LLM 调用的数量。
>
> 在工具和模型下面添加以下内容：
>
>> [!提示]
>>
>> LangGraph 中的状态在代理执行期间持续存在。
>>>> 带有 `operator.add` 的 `Annotated` 类型将新消息追加到列表中而不是替换它。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.messages import AnyMessage
> from typing_extensions import TypedDict, Annotated
> import operator
>
>
> class MessagesState(TypedDict):
>     messages: Annotated[list[AnyMessage], operator.add]
>     llm_calls: int
> ```
>
> ## 4.定义模型节点
>
> 模型节点调用LLM并决定是否调用工具。
>
> 在状态架构下添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.messages import SystemMessage
>
>
> def llm_call(state: dict):
>     """LLM decides whether to call a tool or not"""
>
>     return {
>         "messages": [
>             model_with_tools.invoke(
>                 [
>                     SystemMessage(
>                         content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
>                     )
>                 ]
>                 + state["messages"]
>             )
>         ],
>         "llm_calls": state.get('llm_calls', 0) + 1
>     }
> ```
>
> ## 5.定义工具节点
>
> 工具节点调用工具并返回结果。
>
> 在模型节点下添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.messages import ToolMessage
>
>
> def tool_node(state: dict):
>     """Performs the tool call"""
>
>     result = []
>     for tool_call in state["messages"][-1].tool_calls:
>         tool = tools_by_name[tool_call["name"]]
>         observation = tool.invoke(tool_call["args"])
>         result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
>     return {"messages": result}
> ```
>
> ## 6.定义结束逻辑
>
> 条件边函数路由到工具节点或末尾，具体取决于 LLM 是否进行了工具调用。
>
> 在工具节点下面添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from typing import Literal
> from langgraph.graph import StateGraph, START, END
>
>
> def should_continue(state: MessagesState) -> Literal["tool_node", END]:
>     """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
>
>     messages = state["messages"]
>     last_message = messages[-1]
>
>     # If the LLM makes a tool call, then perform an action
>     if last_message.tool_calls:
>         return "tool_node"
>
>     # Otherwise, we stop (reply to the user)
>     return END
> ```
>
> ## 7. 构建并编译代理
>
> 在路由功能下面添加以下内容。使用 [⟦T43⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 构建图表并使用 [⟦T44⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile) 进行编译：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> # Build workflow
> agent_builder = StateGraph(MessagesState)
>
> # Add nodes
> agent_builder.add_node("llm_call", llm_call)
> agent_builder.add_node("tool_node", tool_node)
>
> # Add edges to connect nodes
> agent_builder.add_edge(START, "llm_call")
> agent_builder.add_conditional_edges(
>     "llm_call",
>     should_continue,
>     ["tool_node", END]
> )
> agent_builder.add_edge("tool_node", "llm_call")
>
> # Compile the agent
> agent = agent_builder.compile()
> ```
>
> ## 8. 设置 LangSmith 跟踪
>
> [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 显示代理运行时的工具调用和模型响应。
>
> 此步骤是可选的。在 [smith.langchain.com](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 注册，创建 API 密钥，并在运行代理之前在 shell 中设置这些环境变量：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> export LANGSMITH_TRACING=true
> export LANGSMITH_API_KEY="your-langsmith-api-key"
> ```
>
> ## 9. 运行代理
>
> 在编译后的图表下方添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.messages import HumanMessage
>
> messages = [HumanMessage(content="Add 3 and 4.")]
> messages = agent.invoke({"messages": messages})
> for m in messages["messages"]:
>     m.pretty_print()
> ```
>
> 运行文件：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> python agent.py
> ```
>> 您应该看到人工消息、对 `add` 的工具调用、工具结果 `7` 以及最终的助理回复。确切的文本因型号而异，但工具结果是`7`。
>
> 要检查您的文件，请将其与完整示例进行比较：
>
>> [手风琴] 完整代码示例
>>
>> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> > # Step 2: Define tools and model
> >
> > from langchain.tools import tool
> > from langchain.chat_models import init_chat_model
> >
> >
> > model = init_chat_model(
> >     "claude-sonnet-4-6",
> >     temperature=0
> > )
> >
> >
> > # Define tools
> > @tool
> > def multiply(a: int, b: int) -> int:
> >     """Multiply `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a * b
> >
> >
> > @tool
> > def add(a: int, b: int) -> int:
> >     """Adds `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a + b
> >
> >
> > @tool
> > def divide(a: int, b: int) -> float:
> >     """Divide `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a / b
> >
> >
> > # Augment the LLM with tools
> > tools = [add, multiply, divide]
> > tools_by_name = {tool.name: tool for tool in tools}
> > model_with_tools = model.bind_tools(tools)
> >
> > # Step 3: Define state
> >
> > from langchain.messages import AnyMessage
> > from typing_extensions import TypedDict, Annotated
> > import operator
> >
> >
> > class MessagesState(TypedDict):
> >     messages: Annotated[list[AnyMessage], operator.add]
> >     llm_calls: int
> >
> > # Step 4: Define model node
> > from langchain.messages import SystemMessage
> >
> >
> > def llm_call(state: MessagesState):
> >     """LLM decides whether to call a tool or not"""
> >
> >     return {
> >         "messages": [
> >             model_with_tools.invoke(
> >                 [
> >                     SystemMessage(
> >                         content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
> >                     )
> >                 ]
> >                 + state["messages"]
> >             )
> >         ],
> >         "llm_calls": state.get('llm_calls', 0) + 1
> >     }
> >
> >
> > # Step 5: Define tool node
> >
> > from langchain.messages import ToolMessage
> >
> >
> > def tool_node(state: MessagesState):
> >     """Performs the tool call"""
> >
> >     result = []
> >     for tool_call in state["messages"][-1].tool_calls:
> >         tool = tools_by_name[tool_call["name"]]
> >         observation = tool.invoke(tool_call["args"])
> >         result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
> >     return {"messages": result}
> >
> > # Step 6: Define end logic
> >
> > from typing import Literal
> > from langgraph.graph import StateGraph, START, END
> >
> >
> > # Conditional edge function to route to the tool node or end based upon whether the LLM made a tool call
> > def should_continue(state: MessagesState) -> Literal["tool_node", END]:
> >     """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""
> >
> >     messages = state["messages"]
> >     last_message = messages[-1]
> >
> >     # If the LLM makes a tool call, then perform an action
> >     if last_message.tool_calls:
> >         return "tool_node"
> >
> >     # Otherwise, we stop (reply to the user)
> >     return END
> >
> > # Step 7: Build and compile the agent
> >
> > # Build workflow
> > agent_builder = StateGraph(MessagesState)
> >
> > # Add nodes
> > agent_builder.add_node("llm_call", llm_call)
> > agent_builder.add_node("tool_node", tool_node)
> >
> > # Add edges to connect nodes
> > agent_builder.add_edge(START, "llm_call")
> > agent_builder.add_conditional_edges(
> >     "llm_call",
> >     should_continue,
> >     ["tool_node", END]
> > )
> > agent_builder.add_edge("tool_node", "llm_call")
> >
> > # Compile the agent
> > agent = agent_builder.compile()
> >
> >
> > # Step 8: Set up LangSmith tracing (optional)
> > # export LANGSMITH_TRACING=true
> > # export LANGSMITH_API_KEY="your-langsmith-api-key"
> >
> > # Step 9: Run the agent
> > from langchain.messages import HumanMessage
> > messages = [HumanMessage(content="Add 3 and 4.")]
> > messages = agent.invoke({"messages": messages})
> > for m in messages["messages"]:
> >     m.pretty_print()
> > ```

> [选项卡] 使用功能 API
>
> 构建 LangGraph 函数式 API 计算器快速入门
>
> 按照 LangGraph 快速入门，在此工作目录中使用功能 API 构建 LangGraph 计算器代理。
>
> ## 第 1 步：阅读指南
>
> 检测该项目是否使用Python或TypeScript/JavaScript。获取并关注匹配的页面；将其视为包名称、模型字符串和代码的真实来源：
>
> * Python: [https://docs.langchain.com/oss/python/langgraph/quickstart.md](https://docs.langchain.com/oss/python/langgraph/quickstart.md)
> * 打字稿：[https://docs.langchain.com/oss/javascript/langgraph/quickstart.md](https://docs.langchain.com/oss/javascript/langgraph/quickstart.md)
>
> 仅使用 **使用功能 API** 选项卡。不要实现 Graph API 路径。
>
> ## 步骤2：安装依赖项
>
> 使用本项目中已使用的包管理器安装功能 API 路径所需的包。
>
> ## 步骤 3：配置模型凭据
>> 本快速入门默认使用 Anthropic。检查是否设置了`ANTHROPIC_API_KEY`。如果不是，则要求用户创建一个密钥并将其设置在 shell 或 `.env` 文件中，然后停止并等待确认。请勿发明、硬编码或提交 API 密钥。如果用户更喜欢集成文档中的另一个聊天模型提供程序，请在确认后相应地调整示例。
>
> ## 步骤 4：实现计算器代理
>
> 定义工具和模型，然后定义功能 API 任务和指南中的入口点。
>
> ## 步骤 5：可选 LangSmith 跟踪
>
> 询问用户是否想要跟踪。如果是，请他们自行设置`LANGSMITH_TRACING=true`和`LANGSMITH_API_KEY`。不要发明 LangSmith 钥匙。
>
> ## 步骤 6：运行代理
>
> 根据指南中的示例算术查询调用代理并打印最终结果。
>
> ## 规则
>
> * 请关注本快速入门。除非用户要求，否则不要添加部署、评估或不相关的框架。
> * 更喜欢所获取的指南中显示的功能 API 结构，而不是发明不同的代理模式。
> * 当秘密、提供商选择或项目约定不清楚时，询问而不是猜测。
>
> ## 2.定义工具和模型
>> 此示例使用 Claude Sonnet 模型并定义加法、乘法和除法工具。
>
> 为代理创建文件（`agent.py` 或 `agent.ts`）。添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.tools import tool
> from langchain.chat_models import init_chat_model
>
>
> model = init_chat_model(
>     "claude-sonnet-4-6",
>     temperature=0
> )
>
>
> # Define tools
> @tool
> def multiply(a: int, b: int) -> int:
>     """Multiply `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a * b
>
>
> @tool
> def add(a: int, b: int) -> int:
>     """Adds `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a + b
>
>
> @tool
> def divide(a: int, b: int) -> float:
>     """Divide `a` and `b`.
>
>     Args:
>         a: First int
>         b: Second int
>     """
>     return a / b
>
>
> # Augment the LLM with tools
> tools = [add, multiply, divide]
> tools_by_name = {tool.name: tool for tool in tools}
> model_with_tools = model.bind_tools(tools)
>
> from langgraph.graph import add_messages
> from langchain.messages import (
>     SystemMessage,
>     HumanMessage,
>     ToolCall,
> )
> from langchain_core.messages import BaseMessage
> from langgraph.func import entrypoint, task
> ```
>
> ## 3.定义模型任务
>
> 模型任务调用LLM并决定是否调用工具。
>
> 在工具和模型下面添加以下内容：
>
>> [!提示]
>>
>> [⟦T54⟧](https://reference.langchain.com/python/langgraph/func/task) 装饰器将函数标记为代理中的任务。从入口点同步或异步调用任务。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> @task
> def call_llm(messages: list[BaseMessage]):
>     """LLM decides whether to call a tool or not"""
>     return model_with_tools.invoke(
>         [
>             SystemMessage(
>                 content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
>             )
>         ]
>         + messages
>     )
> ```
>
> ## 4.定义工具任务
>
> 工具任务调用工具并返回结果。
>
> 在模型任务下面添加以下内容：
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> @task
> def call_tool(tool_call: ToolCall):
>     """Performs the tool call"""
>     tool = tools_by_name[tool_call["name"]]
>     return tool.invoke(tool_call)
>
> ```
>
> ## 5. 定义代理
>
> 在任务下方添加以下内容。使用[⟦T55⟧](https://reference.langchain.com/python/langgraph/func/entrypoint)定义代理：
>
>> [!注意]
>>
>> 功能 API 在单个函数中使用普通控制流（循环和条件），而不是显式节点和边。
>
> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> @entrypoint()
> def agent(messages: list[BaseMessage]):
>     model_response = call_llm(messages).result()
>
>     while True:
>         if not model_response.tool_calls:
>             break
>
>         # Execute tools
>         tool_result_futures = [
>             call_tool(tool_call) for tool_call in model_response.tool_calls
>         ]
>         tool_results = [fut.result() for fut in tool_result_futures]
>         messages = add_messages(messages, [model_response, *tool_results])
>         model_response = call_llm(messages).result()
>
>     messages = add_messages(messages, model_response)
>     return messages
> ```
>
> ## 6. 设置 LangSmith 跟踪
>
> [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 在代理运行时显示工具调用和模型响应。
>
> 此步骤是可选的。在 [smith.langchain.com](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 注册，创建 API 密钥，并在运行代理之前在 shell 中设置这些环境变量：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> export LANGSMITH_TRACING=true
> export LANGSMITH_API_KEY="your-langsmith-api-key"
> ```
>
> ## 7. 运行代理
>
> 在入口点下方添加以下内容：
>> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> from langchain.messages import HumanMessage
>
> messages = [HumanMessage(content="Add 3 and 4.")]
> messages = agent.invoke(messages)
> for m in messages:
>     m.pretty_print()
> ```
>
> 运行文件：
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> python agent.py
> ```
>
> 您应该看到人工消息、对 `add` 的工具调用、工具结果 `7` 以及最终的助理回复。确切的文本因型号而异，但工具结果是`7`。
>
> 要检查您的文件，请将其与完整示例进行比较：
>
>> [手风琴] 完整代码示例
>>
>> ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> > # Step 2: Define tools and model
> >
> > from langchain.tools import tool
> > from langchain.chat_models import init_chat_model
> >
> >
> > model = init_chat_model(
> >     "claude-sonnet-4-6",
> >     temperature=0
> > )
> >
> >
> > # Define tools
> > @tool
> > def multiply(a: int, b: int) -> int:
> >     """Multiply `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a * b
> >
> >
> > @tool
> > def add(a: int, b: int) -> int:
> >     """Adds `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a + b
> >
> >
> > @tool
> > def divide(a: int, b: int) -> float:
> >     """Divide `a` and `b`.
> >
> >     Args:
> >         a: First int
> >         b: Second int
> >     """
> >     return a / b
> >
> >
> > # Augment the LLM with tools
> > tools = [add, multiply, divide]
> > tools_by_name = {tool.name: tool for tool in tools}
> > model_with_tools = model.bind_tools(tools)
> >
> > from langgraph.graph import add_messages
> > from langchain.messages import (
> >     SystemMessage,
> >     HumanMessage,
> >     ToolCall,
> > )
> > from langchain_core.messages import BaseMessage
> > from langgraph.func import entrypoint, task
> >
> >
> > # Step 3: Define model task
> >
> > @task
> > def call_llm(messages: list[BaseMessage]):
> >     """LLM decides whether to call a tool or not"""
> >     return model_with_tools.invoke(
> >         [
> >             SystemMessage(
> >                 content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
> >             )
> >         ]
> >         + messages
> >     )
> >
> >
> > # Step 4: Define tool task
> >
> > @task
> > def call_tool(tool_call: ToolCall):
> >     """Performs the tool call"""
> >     tool = tools_by_name[tool_call["name"]]
> >     return tool.invoke(tool_call)
> >
> >
> > # Step 5: Define agent
> >
> > @entrypoint()
> > def agent(messages: list[BaseMessage]):
> >     model_response = call_llm(messages).result()
> >
> >     while True:
> >         if not model_response.tool_calls:
> >             break
> >
> >         # Execute tools
> >         tool_result_futures = [
> >             call_tool(tool_call) for tool_call in model_response.tool_calls
> >         ]
> >         tool_results = [fut.result() for fut in tool_result_futures]
> >         messages = add_messages(messages, [model_response, *tool_results])
> >         model_response = call_llm(messages).result()
> >
> >     messages = add_messages(messages, model_response)
> >     return messages
> >
> > # Step 6: Set up LangSmith tracing (optional)
> > # export LANGSMITH_TRACING=true
> > # export LANGSMITH_API_KEY="your-langsmith-api-key"
> >
> > # Step 7: Run the agent
> > messages = [HumanMessage(content="Add 3 and 4.")]
> > messages = agent.invoke(messages)
> > for m in messages:
> >     m.pretty_print()
> > ```

## 后续步骤

您现在有一个正在工作的计算器代理。继续以下主题之一：

* **学习 API**：[Choosing between Graph and Functional APIs](/oss/python/langgraph/choosing-apis)，然后是 [Build checklist for the Graph API](/oss/python/langgraph/use-graph-api) 或 [Build checklist for the Functional API](/oss/python/langgraph/use-functional-api)。
* **添加持久性**：使用[checkpointer](/oss/python/langgraph/persistence)，以便运行可以跨会话暂停和恢复。
* **添加人机交互**：使用 [interrupts](/oss/python/langgraph/interrupts) 暂停以进行批准或编辑。
* **流结果**：按照 [streaming](/oss/python/langgraph/streaming) 获取令牌和状态更新。
* **深入了解**：[Thinking in the Graph API](/oss/python/langgraph/thinking-in-graph-api)、[Thinking in the Functional API](/oss/python/langgraph/thinking-in-functional-api) 和 [Workflows and agents](/oss/python/langgraph/workflows-agents)。
* **部署**：使用 [LangSmith Deployment](/langsmith/deployment) 托管代理。
* **评估**：使用 [LangSmith evaluation](/langsmith/evaluation-quickstart) 测试行为。

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/quickstart.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。