<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Quickstart | https://docs.langchain.com/oss/python/langgraph/quickstart -->

# 快速入门

本快速入门演示了如何使用 LangGraph 图形 API 或功能 API 构建计算器代理。

<Prompt description="Build the LangGraph calculator quickstart" icon="sparkles">
  按照 LangGraph 快速入门，在此工作目录中构建 LangGraph 计算器代理。

  ## 第 1 步：阅读指南

  检测该项目是否使用Python或TypeScript/JavaScript。获取并关注匹配的页面；将其视为包名称、模型字符串和代码的真实来源：

  * Python：[https://docs.langchain.com/oss/python/langgraph/quickstart.md](https://docs.langchain.com/oss/python/langgraph/quickstart.md)
  * 打字稿：[https://docs.langchain.com/oss/javascript/langgraph/quickstart.md](https://docs.langchain.com/oss/javascript/langgraph/quickstart.md)

  询问用户是使用图形 API 还是功能 API。如果他们没有偏好，请使用 Graph API 路径。

  ## 第二步：安装依赖项

  使用本项目中已使用的包管理器安装所选路径所需的包。

  ## 步骤 3：配置模型凭据

  本快速入门默认使用 Anthropic。检查`ANTHROPIC_API_KEY`是否设置。如果不是，则要求用户创建一个密钥并将其设置在 shell 或 `.env` 文件中，然后停止并等待确认。请勿发明、硬编码或提交 API 密钥。如果用户更喜欢集成文档中的另一个聊天模型提供程序，请在确认后相应地调整示例。

  ## 步骤 4：实现计算器代理端到端实施所选的快速入门路径：加法、乘法和除法工具；代理图或功能工作流程；以及练习工具调用的示例调用。打印最终结果，以便用户验证运行。

  ## 规则

  * 请关注本快速入门。除非用户要求，否则不要添加部署、评估或不相关的框架。
  * 优先选择获取的指南中显示的 API 和结构，而不是发明不同的代理模式。
  * 当秘密、API 选择或项目约定不清楚时，询问而不是猜测。
</Prompt>

<Tip>
  **使用人工智能编码助手？**

  * 安装 [LangChain Docs MCP servers](/use-these-docs) 以使您的代理能够访问最新的 LangChain 文档和示例。

    <Prompt description="Connect LangChain docs MCP servers" icon="plug">
      将两个 LangChain 文档 MCP 服务器连接到我的编码代理，以便它可以查找当前的 LangChain、LangGraph 和 LangSmith 文档和 API 参考。

      要添加的服务器：

      * `docs-langchain`: [https://docs.langchain.com/mcp](https://docs.langchain.com/mcp)
      * `reference-langchain`: [https://reference.langchain.com/mcp](https://reference.langchain.com/mcp)

      检测我正在使用的代理或编辑器（Claude Code、Cursor、Codex CLI、Claude Desktop、Deep Agents Code、VS Code、Antigravity 或其他 MCP 兼容客户端）。使用 [https://docs.langchain.com/use-these-docs.md](https://docs.langchain.com/use-these-docs.md) 中的匹配设置：* Claude 代码：`claude mcp add --transport http` 适用于每个服务器（默认情况下为项目范围；仅当我要求全局访问时才使用`--scope user`）。
      * Codex CLI：`codex mcp add` 以及每个服务器 URL。
      * 光标、Deep Agents 代码、VS 代码或反重力：使用该页面上为我的客户显示的字段名称将两个条目合并到 MCP 设置 JSON 中。
      * Claude Desktop：在“设置”>“连接器”下添加两个 URL。

      不要发明备用 MCP URL。配置后，确认两台服务器均已列出并且可访问。
    </Prompt>
  * 安装[LangChain Skills](https://github.com/langchain-ai/langchain-skills)以提高代理在LangChain生态系统任务上的性能。

    <Prompt description="Install LangChain Skills" icon="puzzle">
      为我的编码代理安装 LangChain 技能，以便它可以更好地执行 LangChain、LangGraph 和 Deep Agents 任务。

      使用 [https://github.com/langchain-ai/langchain-skills](https://github.com/langchain-ai/langchain-skills) 中的代理技能安装程序：

      ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      npx skills add langchain-ai/langchain-skills --skill '*' --yes
      ```

      如果我要求全局安装，请使用：

      ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      npx skills add langchain-ai/langchain-skills --skill '*' --yes --global
      ```

      检测我正在使用哪个代理或编辑器。如果我使用 Claude Code 并且更喜欢插件路径，请按照该存储库自述文件中的市场安装（`/plugin marketplace add` 然后`/plugin install`）。不要发明备用技能包名称或安装 URL。安装后，确认代理可以使用该技能。
    </Prompt>
</Tip>* [Use the Graph API](#use-the-graph-api) 如果您更喜欢将代理定义为节点和边的图。
* [Use the Functional API](#use-the-functional-api) 如果您希望将代理定义为单个函数。

有关概念信息，请参阅 [Graph API overview](/oss/python/langgraph/graph-api) 和 [Functional API overview](/oss/python/langgraph/functional-api)。

<Info>
  对于本示例，您需要设置一个 [Claude (Anthropic)](https://www.anthropic.com/) 帐户并获取 API 密钥。然后，在终端中设置 `ANTHROPIC_API_KEY` 环境变量。请参阅[chat model integrations](/oss/python/integrations/chat)了解所有可用的提供商。如果您使用 [LangSmith Gateway](/langsmith/llm-gateway)，则可以使用 [bring your own provider keys](/langsmith/llm-gateway-quickstart#send-a-request) 或使用 [Gateway Credits](/langsmith/llm-gateway-credits) 来访问模型而无需提供程序密钥。
</Info>

<Tabs>
  <Tab title="Use the Graph API">
    ## 1.定义工具和模型

    在此示例中，我们将使用 Claude Sonnet 4.5 模型并定义加法、乘法和除法工具。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langchain.tools import tool
    from langchain.chat_models import init_chat_model


    model = init_chat_model(
        "claude-sonnet-4-6",
        temperature=0
    )


    # Define tools
    @tool
    def multiply(a: int, b: int) -> int:
        """Multiply `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a * b


    @tool
    def add(a: int, b: int) -> int:
        """Adds `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a + b


    @tool
    def divide(a: int, b: int) -> float:
        """Divide `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a / b


    # Augment the LLM with tools
    tools = [add, multiply, divide]
    tools_by_name = {tool.name: tool for tool in tools}
    model_with_tools = model.bind_tools(tools)
    ```

    ## 2. 定义状态

    图的状态用于存储消息和 LLM 调用的数量。

    <Tip>
      LangGraph 中的状态在代理执行期间持续存在。

      带有 `operator.add` 的 `Annotated` 类型确保新消息附加到现有列表而不是替换它。
    </Tip>

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langchain.messages import AnyMessage
    from typing_extensions import TypedDict, Annotated
    import operator


    class MessagesState(TypedDict):
        messages: Annotated[list[AnyMessage], operator.add]
        llm_calls: int
    ```

    ## 3.定义模型节点

    模型节点用于调用LLM并决定是否调用工具。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langchain.messages import SystemMessage


    def llm_call(state: dict):
        """LLM decides whether to call a tool or not"""

        return {
            "messages": [
                model_with_tools.invoke(
                    [
                        SystemMessage(
                            content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
                        )
                    ]
                    + state["messages"]
                )
            ],
            "llm_calls": state.get('llm_calls', 0) + 1
        }
    ```

    ## 4.定义工具节点

    工具节点用于调用工具并返回结果。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langchain.messages import ToolMessage


    def tool_node(state: dict):
        """Performs the tool call"""

        result = []
        for tool_call in state["messages"][-1].tool_calls:
            tool = tools_by_name[tool_call["name"]]
            observation = tool.invoke(tool_call["args"])
            result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
        return {"messages": result}
    ```## 5.定义结束逻辑

    条件边函数用于根据 LLM 是否进行工具调用来路由到工具节点或末端。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from typing import Literal
    from langgraph.graph import StateGraph, START, END


    def should_continue(state: MessagesState) -> Literal["tool_node", END]:
        """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

        messages = state["messages"]
        last_message = messages[-1]

        # If the LLM makes a tool call, then perform an action
        if last_message.tool_calls:
            return "tool_node"

        # Otherwise, we stop (reply to the user)
        return END
    ```

    ## 6. 构建并编译代理

    该代理使用 [⟦T26⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 类构建，并使用 [⟦T27⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile) 方法编译。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    # Build workflow
    agent_builder = StateGraph(MessagesState)

    # Add nodes
    agent_builder.add_node("llm_call", llm_call)
    agent_builder.add_node("tool_node", tool_node)

    # Add edges to connect nodes
    agent_builder.add_edge(START, "llm_call")
    agent_builder.add_conditional_edges(
        "llm_call",
        should_continue,
        ["tool_node", END]
    )
    agent_builder.add_edge("tool_node", "llm_call")

    # Compile the agent
    agent = agent_builder.compile()

    # Show the agent
    from IPython.display import Image, display
    display(Image(agent.get_graph(xray=True).draw_mermaid_png()))

    # Invoke
    from langchain.messages import HumanMessage
    messages = [HumanMessage(content="Add 3 and 4.")]
    messages = agent.invoke({"messages": messages})
    for m in messages["messages"]:
        m.pretty_print()
    ```

    <Tip>
      使用 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 跟踪和调试您的代理。按照[tracing quickstart](/langsmith/trace-with-langgraph)进行设置。准备好投入生产时，请参阅 [Deploy](/langsmith/deployment) 了解托管选项。

      我们建议您还设置 [LangSmith Engine](/langsmith/engine) 来监视您的痕迹、检测问题并提出修复建议。
    </Tip>

    恭喜！您已经使用 LangGraph Graph API 构建了第一个代理。

    <Accordion title="Full code example">
      ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      # Step 1: Define tools and model

      from langchain.tools import tool
      from langchain.chat_models import init_chat_model


      model = init_chat_model(
          "claude-sonnet-4-6",
          temperature=0
      )


      # Define tools
      @tool
      def multiply(a: int, b: int) -> int:
          """Multiply `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a * b


      @tool
      def add(a: int, b: int) -> int:
          """Adds `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a + b


      @tool
      def divide(a: int, b: int) -> float:
          """Divide `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a / b


      # Augment the LLM with tools
      tools = [add, multiply, divide]
      tools_by_name = {tool.name: tool for tool in tools}
      model_with_tools = model.bind_tools(tools)

      # Step 2: Define state

      from langchain.messages import AnyMessage
      from typing_extensions import TypedDict, Annotated
      import operator


      class MessagesState(TypedDict):
          messages: Annotated[list[AnyMessage], operator.add]
          llm_calls: int

      # Step 3: Define model node
      from langchain.messages import SystemMessage


      def llm_call(state: MessagesState):
          """LLM decides whether to call a tool or not"""

          return {
              "messages": [
                  model_with_tools.invoke(
                      [
                          SystemMessage(
                              content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
                          )
                      ]
                      + state["messages"]
                  )
              ],
              "llm_calls": state.get('llm_calls', 0) + 1
          }


      # Step 4: Define tool node

      from langchain.messages import ToolMessage


      def tool_node(state: MessagesState):
          """Performs the tool call"""

          result = []
          for tool_call in state["messages"][-1].tool_calls:
              tool = tools_by_name[tool_call["name"]]
              observation = tool.invoke(tool_call["args"])
              result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
          return {"messages": result}

      # Step 5: Define logic to determine whether to end

      from typing import Literal
      from langgraph.graph import StateGraph, START, END


      # Conditional edge function to route to the tool node or end based upon whether the LLM made a tool call
      def should_continue(state: MessagesState) -> Literal["tool_node", END]:
          """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

          messages = state["messages"]
          last_message = messages[-1]

          # If the LLM makes a tool call, then perform an action
          if last_message.tool_calls:
              return "tool_node"

          # Otherwise, we stop (reply to the user)
          return END

      # Step 6: Build agent

      # Build workflow
      agent_builder = StateGraph(MessagesState)

      # Add nodes
      agent_builder.add_node("llm_call", llm_call)
      agent_builder.add_node("tool_node", tool_node)

      # Add edges to connect nodes
      agent_builder.add_edge(START, "llm_call")
      agent_builder.add_conditional_edges(
          "llm_call",
          should_continue,
          ["tool_node", END]
      )
      agent_builder.add_edge("tool_node", "llm_call")

      # Compile the agent
      agent = agent_builder.compile()


      from IPython.display import Image, display
      # Show the agent
      display(Image(agent.get_graph(xray=True).draw_mermaid_png()))

      # Invoke
      from langchain.messages import HumanMessage
      messages = [HumanMessage(content="Add 3 and 4.")]
      messages = agent.invoke({"messages": messages})
      for m in messages["messages"]:
          m.pretty_print()

      ```
    </Accordion>
  </Tab>

  <Tab title="Use the Functional API">
    ## 1.定义工具和模型

    在此示例中，我们将使用 Claude Sonnet 4.5 模型并定义加法、乘法和除法工具。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    from langchain.tools import tool
    from langchain.chat_models import init_chat_model


    model = init_chat_model(
        "claude-sonnet-4-6",
        temperature=0
    )


    # Define tools
    @tool
    def multiply(a: int, b: int) -> int:
        """Multiply `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a * b


    @tool
    def add(a: int, b: int) -> int:
        """Adds `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a + b


    @tool
    def divide(a: int, b: int) -> float:
        """Divide `a` and `b`.

        Args:
            a: First int
            b: Second int
        """
        return a / b


    # Augment the LLM with tools
    tools = [add, multiply, divide]
    tools_by_name = {tool.name: tool for tool in tools}
    model_with_tools = model.bind_tools(tools)

    from langgraph.graph import add_messages
    from langchain.messages import (
        SystemMessage,
        HumanMessage,
        ToolCall,
    )
    from langchain_core.messages import BaseMessage
    from langgraph.func import entrypoint, task
    ```

    ## 2.定义模型节点

    模型节点用于调用LLM并决定是否调用工具。

    <Tip>
      [⟦T28⟧](https://reference.langchain.com/python/langgraph/func/task) 装饰器将函数标记为可以作为代理的一部分执行的任务。可以在入口点函数中同步或异步调用任务。
    </Tip>

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @task
    def call_llm(messages: list[BaseMessage]):
        """LLM decides whether to call a tool or not"""
        return model_with_tools.invoke(
            [
                SystemMessage(
                    content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
                )
            ]
            + messages
        )
    ```## 3.定义工具节点

    工具节点用于调用工具并返回结果。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @task
    def call_tool(tool_call: ToolCall):
        """Performs the tool call"""
        tool = tools_by_name[tool_call["name"]]
        return tool.invoke(tool_call)

    ```

    ## 4.定义代理

    该代理是使用 [⟦T29⟧](https://reference.langchain.com/python/langgraph/func/entrypoint) 函数构建的。

    <Note>
      在功能 API 中，您无需显式定义节点和边，而是在单个函数中编写标准控制流逻辑（循环、条件）。
    </Note>

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @entrypoint()
    def agent(messages: list[BaseMessage]):
        model_response = call_llm(messages).result()

        while True:
            if not model_response.tool_calls:
                break

            # Execute tools
            tool_result_futures = [
                call_tool(tool_call) for tool_call in model_response.tool_calls
            ]
            tool_results = [fut.result() for fut in tool_result_futures]
            messages = add_messages(messages, [model_response, *tool_results])
            model_response = call_llm(messages).result()

        messages = add_messages(messages, model_response)
        return messages

    # Invoke
    messages = [HumanMessage(content="Add 3 and 4.")]
    stream = agent.stream_events(messages, version="v3")
    for snapshot in stream.values:
        print(snapshot)
        print("\n")
    ```

    <Tip>
      使用 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 跟踪和调试您的代理。按照[tracing quickstart](/langsmith/trace-with-langgraph)进行设置。准备好投入生产后，请参阅 [Deploy](/langsmith/deployment) 了解托管选项。

      我们建议您还设置 [LangSmith Engine](/langsmith/engine) 来监控您的痕迹、检测问题并提出修复建议。
    </Tip>

    恭喜！您已经使用 LangGraph 功能 API 构建了第一个代理。

    <Accordion title="Full code example" icon="code">
      ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      # Step 1: Define tools and model

      from langchain.tools import tool
      from langchain.chat_models import init_chat_model


      model = init_chat_model(
          "claude-sonnet-4-6",
          temperature=0
      )


      # Define tools
      @tool
      def multiply(a: int, b: int) -> int:
          """Multiply `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a * b


      @tool
      def add(a: int, b: int) -> int:
          """Adds `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a + b


      @tool
      def divide(a: int, b: int) -> float:
          """Divide `a` and `b`.

          Args:
              a: First int
              b: Second int
          """
          return a / b


      # Augment the LLM with tools
      tools = [add, multiply, divide]
      tools_by_name = {tool.name: tool for tool in tools}
      model_with_tools = model.bind_tools(tools)

      from langgraph.graph import add_messages
      from langchain.messages import (
          SystemMessage,
          HumanMessage,
          ToolCall,
      )
      from langchain_core.messages import BaseMessage
      from langgraph.func import entrypoint, task


      # Step 2: Define model node

      @task
      def call_llm(messages: list[BaseMessage]):
          """LLM decides whether to call a tool or not"""
          return model_with_tools.invoke(
              [
                  SystemMessage(
                      content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
                  )
              ]
              + messages
          )


      # Step 3: Define tool node

      @task
      def call_tool(tool_call: ToolCall):
          """Performs the tool call"""
          tool = tools_by_name[tool_call["name"]]
          return tool.invoke(tool_call)


      # Step 4: Define agent

      @entrypoint()
      def agent(messages: list[BaseMessage]):
          model_response = call_llm(messages).result()

          while True:
              if not model_response.tool_calls:
                  break

              # Execute tools
              tool_result_futures = [
                  call_tool(tool_call) for tool_call in model_response.tool_calls
              ]
              tool_results = [fut.result() for fut in tool_result_futures]
              messages = add_messages(messages, [model_response, *tool_results])
              model_response = call_llm(messages).result()

          messages = add_messages(messages, model_response)
          return messages

      # Invoke
      messages = [HumanMessage(content="Add 3 and 4.")]
      stream = agent.stream_events(messages, version="v3")
      for snapshot in stream.values:
          print(snapshot)
          print("\n")
      ```
    </Accordion>
  </Tab>
</Tabs>

***

<div>
  <Callout icon="terminal-2">
    [Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/quickstart.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>