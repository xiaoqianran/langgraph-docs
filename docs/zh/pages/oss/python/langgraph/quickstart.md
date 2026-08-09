<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Quickstart | https://docs.langchain.com/oss/python/langgraph/quickstart -->

# 快速入门

本快速入门演示了如何使用 LangGraph 图形 API 或功能 API 构建计算器代理。

<Tip>
  **使用人工智能编码助手？**

  * 安装[LangChain Docs MCP server](/use-these-docs)，让您的代理能够访问最新的LangChain文档和示例。
  * 安装[LangChain Skills](https://github.com/langchain-ai/langchain-skills)以提高代理在LangChain生态系统任务上的性能。
</Tip>

* [Use the Graph API](#use-the-graph-api) 如果您更喜欢将代理定义为节点和边的图。
* [Use the Functional API](#use-the-functional-api) 如果您希望将代理定义为单个函数。

有关概念信息，请参阅 [Graph API overview](/oss/python/langgraph/graph-api) 和 [Functional API overview](/oss/python/langgraph/functional-api)。

<Info>
  对于此示例，您需要设置一个 [Claude (Anthropic)](https://www.anthropic.com/) 帐户并获取 API 密钥。然后，在终端中设置 `ANTHROPIC_API_KEY` 环境变量。请参阅 [chat model integrations](/oss/python/integrations/chat) 了解所有可用的提供商。如果您使用 [LangSmith Gateway](/langsmith/llm-gateway)，则可以使用 [bring your own provider keys](/langsmith/llm-gateway-quickstart) 或使用 [Gateway Credits](/langsmith/llm-gateway-credits) 在没有提供者密钥的情况下访问模型。
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
      LangGraph 中的状态在代理执行期间持续存在。带有 `operator.add` 的 `Annotated` 类型确保新消息附加到现有列表而不是替换它。
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
    ```

    ## 5.定义结束逻辑

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

    该代理使用 [⟦T15⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph) 类构建，并使用 [⟦T16⟧](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/compile) 方法编译。

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
      使用 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 跟踪和调试您的代理。按照[tracing quickstart](/langsmith/trace-with-langgraph)进行设置。准备好投入生产后，请参阅 [Deploy](/langsmith/deployment) 了解托管选项。

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
    ## 1.定义工具和模型在此示例中，我们将使用 Claude Sonnet 4.5 模型并定义加法、乘法和除法工具。

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
      [⟦T17⟧](https://reference.langchain.com/python/langgraph/func/task) 装饰器将函数标记为可以作为代理的一部分执行的任务。可以在入口点函数中同步或异步调用任务。
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
    ```

    ## 3.定义工具节点

    工具节点用于调用工具并返回结果。

    ```python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    @task
    def call_tool(tool_call: ToolCall):
        """Performs the tool call"""
        tool = tools_by_name[tool_call["name"]]
        return tool.invoke(tool_call)

    ```

    ## 4.定义代理

    该代理是使用 [⟦T18⟧](https://reference.langchain.com/python/langgraph/func/entrypoint) 函数构建的。

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

    恭喜！您已经使用 LangGraph 功能 API 构建了第一个代理。<Accordion title="Full code example" icon="code">
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
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/quickstart.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>