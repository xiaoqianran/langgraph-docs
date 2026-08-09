<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Trace LangGraph applications | https://docs.langchain.com/langsmith/trace-with-langgraph -->

# 跟踪 LangGraph 应用程序

LangSmith 与 LangGraph（Python 和 JS）顺利集成，以帮助您跟踪代理，无论您使用的是 LangChain 模块还是其他 SDK。

## 与浪链一起

如果您在 LangGraph 中使用 LangChain 模块，则只需设置一些环境变量即可启用跟踪。

本指南将介绍一个基本示例。有关配置的更多详细信息，请参阅[Trace With LangChain](/langsmith/trace-with-langchain)指南。

### 1.安装

安装 LangGraph 库以及适用于 Python 和 JS 的 OpenAI 集成（我们在下面的代码片段中使用 OpenAI 集成）。

有关可用软件包的完整列表，请参阅 [LangChain Python docs](https://docs.langchain.com/oss/python/integrations/providers/overview) 和 [LangChain JS docs](https://docs.langchain.com/oss/javascript/integrations/providers/overview)。

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install langchain_openai langgraph
  ```

  ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  yarn add @langchain/openai @langchain/langgraph
  ```

  ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm install @langchain/openai @langchain/langgraph
  ```

  ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pnpm add @langchain/openai @langchain/langgraph
  ```
</CodeGroup>

### 2. 配置您的环境

```bash wrap theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=<your-api-key>
# This example uses OpenAI, but you can use any LLM provider of choice
export OPENAI_API_KEY=<your-openai-api-key>
# For LangSmith API keys linked to multiple workspaces, set the LANGSMITH_WORKSPACE_ID environment variable to specify which workspace to use.
export LANGSMITH_WORKSPACE_ID=<your-workspace-id>
```

<Note>
  如果您的帐户位于美国以外的区域（默认），还需将 `LANGSMITH_ENDPOINT` 设置为您所在区域的 API URL。如果没有这个，您的 API 密钥将不会被识别，并且请求将无法通过身份验证。

  <table>
    <thead>
      <tr>
        <th>地区</th>
      </tr>
    </thead>

    <tbody>
      <tr>
        <td>GCP 美国</td>
      </tr>

      <tr>
        <td>GCP 欧盟</td>
      </tr>

      <tr>
        <td>GCP 亚太地区</td>
      </tr><tr>
        <td>AWS 美国</td>
      </tr>
    </tbody>
  </table>

  例如，欧盟账户：`export LANGSMITH_ENDPOINT="https://eu.api.smith.langchain.com"`。不要在 URL 中添加尾部斜杠，因为这可能会导致身份验证错误。
</Note>

<Info>
  如果您将 LangChain.js 与 LangSmith 一起使用并且不在无服务器环境中，我们还建议显式设置以下内容以减少延迟：

  `export LANGCHAIN_CALLBACKS_BACKGROUND=true`

  如果您处于无服务器环境中，我们建议相反设置以允许跟踪在函数结束之前完成：

  `export LANGCHAIN_CALLBACKS_BACKGROUND=false`

  请参阅[this LangChain.js guide](https://js.langchain.com/docs/how_to/callbacks_serverless)了解更多信息。
</Info>

### 3. 记录跟踪

设置好环境后，您就可以像平常一样调用 LangChain runnables。 LangSmith 将推断正确的跟踪配置：

<CodeGroup>
  ```python Python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  from typing import Literal
  from langchain.messages import HumanMessage
  from langchain_openai import ChatOpenAI
  from langchain.tools import tool
  from langgraph.prebuilt import ToolNode
  from langgraph.graph import StateGraph, MessagesState

  @tool
  def search(query: str):
      """Call to surf the web."""
      if "sf" in query.lower() or "san francisco" in query.lower():
          return "It's 60 degrees and foggy."
      return "It's 90 degrees and sunny."

  tools = [search]
  tool_node = ToolNode(tools)

  model = ChatOpenAI(model="gpt-5.5", temperature=0).bind_tools(tools)

  def should_continue(state: MessagesState) -> Literal["tools", "__end__"]:
      messages = state['messages']
      last_message = messages[-1]
      if last_message.tool_calls:
          return "tools"
      return "__end__"

  def call_model(state: MessagesState):
      messages = state['messages']
      # Invoking `model` will automatically infer the correct tracing context
      response = model.invoke(messages)
      return {"messages": [response]}

  workflow = StateGraph(MessagesState)
  workflow.add_node("agent", call_model)
  workflow.add_node("tools", tool_node)
  workflow.add_edge("__start__", "agent")
  workflow.add_conditional_edges(
      "agent",
      should_continue,
  )
  workflow.add_edge("tools", 'agent')

  app = workflow.compile()

  final_state = app.invoke(
      {"messages": [HumanMessage(content="what is the weather in sf")]},
      config={"configurable": {"thread_id": 42}}
  )

  final_state["messages"][-1].content
  ```

  ```typescript TypeScript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { HumanMessage, AIMessage } from "@langchain/core/messages";
  import { tool } from "@langchain/core/tools";
  import { z } from "zod";
  import { ChatOpenAI } from "@langchain/openai";
  import { StateGraph, StateGraphArgs } from "@langchain/langgraph";
  import { ToolNode } from "@langchain/langgraph/prebuilt";

  interface AgentState {
    messages: HumanMessage[];
  }

  const graphState: StateGraphArgs<AgentState>["channels"] = {
    messages: {
      reducer: (x: HumanMessage[], y: HumanMessage[]) => x.concat(y),
    },
  };

  const searchTool = tool(async ({ query }: { query: string }) => {
    if (query.toLowerCase().includes("sf") || query.toLowerCase().includes("san francisco")) {
      return "It's 60 degrees and foggy."
    }
    return "It's 90 degrees and sunny."
  }, {
    name: "search",
    description:
      "Call to surf the web.",
    schema: z.object({
      query: z.string().describe("The query to use in your search."),
    }),
  });

  const tools = [searchTool];
  const toolNode = new ToolNode<AgentState>(tools);

  const model = new ChatOpenAI({
    model: "gpt-5.5",
    temperature: 0,
  }).bindTools(tools);

  function shouldContinue(state: AgentState) {
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    return "__end__";
  }

  async function callModel(state: AgentState) {
    const messages = state.messages;
    // Invoking `model` will automatically infer the correct tracing context
    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  const workflow = new StateGraph<AgentState>({ channels: graphState })
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  const app = workflow.compile();

  const finalState = await app.invoke(
    { messages: [new HumanMessage("what is the weather in sf")] },
    { configurable: { thread_id: "42" } }
  );

  finalState.messages[finalState.messages.length - 1].content;
  ```
</CodeGroup>

### 查看跟踪

**详情查看**

单击跟踪，然后切换到右上角的 **详细信息** 视图。您在 LangSmith 中的跟踪应该是 [look like this](https://smith.langchain.com/public/79061a0f-c602-4012-b022-03fd46bce89e/r)。

**消息查看**

LangSmith UI 中的 **消息** 视图显示用户和代理之间的简化对话历史记录。该视图从顶级跟踪中提取消息（包括用户的初始请求、工具调用和代理的最终响应），并以类似聊天的格式表示它们。## 没有浪链

如果您在 LangGraph 中使用其他 SDK 或自定义函数，则需要 [wrap or decorate them appropriately](/langsmith/annotate-code#use-%40traceable-%2F-traceable) （使用 Python 中的 `@traceable` 装饰器或 JS 中的 `traceable` 函数，或者类似 SDK 的 `wrap_openai` ）。如果这样做，LangSmith 将自动从这些包装的方法中嵌套跟踪。

这是一个例子。您还可以查看此页面以获取更多信息。

### 1.安装

安装 LangGraph 库以及适用于 Python 和 JS 的 OpenAI SDK（我们在下面的代码片段中使用 OpenAI 集成）。

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install openai langsmith langgraph
  ```

  ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  yarn add openai langsmith @langchain/langgraph
  ```

  ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm install openai langsmith @langchain/langgraph
  ```

  ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pnpm add openai langsmith @langchain/langgraph
  ```
</CodeGroup>

### 2. 配置您的环境

```bash wrap theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=<your-api-key>
# This example uses OpenAI, but you can use any LLM provider of choice
export OPENAI_API_KEY=<your-openai-api-key>
```

<Note>
  如果您的帐户位于美国以外的区域（默认），还需将 `LANGSMITH_ENDPOINT` 设置为您所在区域的 API URL。如果没有这个，您的 API 密钥将不会被识别，并且请求将无法通过身份验证。

  <table>
    <thead>
      <tr>
        <th>地区</th>
      </tr>
    </thead>

    <tbody>
      <tr>
        <td>GCP 美国</td>
      </tr>

      <tr>
        <td>GCP 欧盟</td>
      </tr>

      <tr>
        <td>GCP 亚太地区</td>
      </tr>

      <tr>
        <td>AWS 美国</td>
      </tr>
    </tbody>
  </table>例如，欧盟账户：`export LANGSMITH_ENDPOINT="https://eu.api.smith.langchain.com"`。不要在 URL 中添加尾部斜杠，因为这可能会导致身份验证错误。
</Note>

<Info>
  如果您将 LangChain.js 与 LangSmith 一起使用并且不在无服务器环境中，我们还建议显式设置以下内容以减少延迟：

  `export LANGCHAIN_CALLBACKS_BACKGROUND=true`

  如果您处于无服务器环境中，我们建议相反设置以允许跟踪在函数结束之前完成：

  `export LANGCHAIN_CALLBACKS_BACKGROUND=false`

  请参阅[this LangChain.js guide](https://js.langchain.com/docs/how_to/callbacks_serverless)了解更多信息。
</Info>

### 3. 记录跟踪

设置好环境后，您想要跟踪 [wrap or decorate the custom functions/SDKs](/langsmith/annotate-code#use-%40traceable-%2F-traceable)。然后 LangSmith 将推断出正确的跟踪配置：

<CodeGroup>
  ```python Python theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import json
  import openai
  import operator
  from langsmith import traceable
  from langsmith.wrappers import wrap_openai
  from typing import Annotated, Literal, TypedDict
  from langgraph.graph import StateGraph

  class State(TypedDict):
      messages: Annotated[list, operator.add]

  tool_schema = {
      "type": "function",
      "function": {
          "name": "search",
          "description": "Call to surf the web.",
          "parameters": {
              "type": "object",
              "properties": {"query": {"type": "string"}},
              "required": ["query"],
          },
      },
  }

  # Decorating the tool function will automatically trace it with the correct context
  @traceable(run_type="tool", name="Search Tool")
  def search(query: str):
      """Call to surf the web."""
      if "sf" in query.lower() or "san francisco" in query.lower():
          return "It's 60 degrees and foggy."
      return "It's 90 degrees and sunny."

  tools = [search]

  def call_tools(state):
      function_name_to_function = {"search": search}
      messages = state["messages"]
      tool_call = messages[-1]["tool_calls"][0]
      function_name = tool_call["function"]["name"]
      function_arguments = tool_call["function"]["arguments"]
      arguments = json.loads(function_arguments)
      function_response = function_name_to_function[function_name](**arguments)
      tool_message = {
          "tool_call_id": tool_call["id"],
          "role": "tool",
          "name": function_name,
          "content": function_response,
      }
      return {"messages": [tool_message]}

  wrapped_client = wrap_openai(openai.Client())

  def should_continue(state: State) -> Literal["tools", "__end__"]:
      messages = state["messages"]
      last_message = messages[-1]
      if last_message["tool_calls"]:
          return "tools"
      return "__end__"

  def call_model(state: State):
      messages = state["messages"]
      # Calling the wrapped client will automatically infer the correct tracing context
      response = wrapped_client.chat.completions.create(
          messages=messages, model="gpt-5.4-mini", tools=[tool_schema]
      )
      raw_tool_calls = response.choices[0].message.tool_calls
      tool_calls = [tool_call.to_dict() for tool_call in raw_tool_calls] if raw_tool_calls else []
      response_message = {
          "role": "assistant",
          "content": response.choices[0].message.content,
          "tool_calls": tool_calls,
      }
      return {"messages": [response_message]}

  workflow = StateGraph(State)
  workflow.add_node("agent", call_model)
  workflow.add_node("tools", call_tools)
  workflow.add_edge("__start__", "agent")
  workflow.add_conditional_edges(
      "agent",
      should_continue,
  )
  workflow.add_edge("tools", 'agent')

  app = workflow.compile()

  final_state = app.invoke(
      {"messages": [{"role": "user", "content": "what is the weather in sf"}]}
  )

  final_state["messages"][-1]["content"]
  ```

  ```typescript TypeScript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  **Note:** The below example requires `langsmith>=0.1.39` and `@langchain/langgraph>=0.0.31`

  import OpenAI from "openai";
  import { StateGraph } from "@langchain/langgraph";
  import { wrapOpenAI } from "langsmith/wrappers/openai";
  import { traceable } from "langsmith/traceable";

  type GraphState = {
    messages: OpenAI.ChatCompletionMessageParam[];
  };

  const wrappedClient = wrapOpenAI(new OpenAI({}));

  const toolSchema: OpenAI.ChatCompletionTool = {
    type: "function",
    function: {
      name: "search",
      description: "Use this tool to query the web.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
          },
        },
        required: ["query"],
      }
    }
  };

  // Wrapping the tool function will automatically trace it with the correct context
  const search = traceable(async ({ query }: { query: string }) => {
    if (
      query.toLowerCase().includes("sf") ||
      query.toLowerCase().includes("san francisco")
    ) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  }, { run_type: "tool", name: "Search Tool" });

  const callTools = async ({ messages }: GraphState) => {
    const mostRecentMessage = messages[messages.length - 1];
    const toolCalls = (mostRecentMessage as OpenAI.ChatCompletionAssistantMessageParam).tool_calls;
    if (toolCalls === undefined || toolCalls.length === 0) {
      throw new Error("No tool calls passed to node.");
    }
    const toolNameMap = {
      search,
    };
    const functionName = toolCalls[0].function.name;
    const functionArguments = JSON.parse(toolCalls[0].function.arguments);
    const response = await toolNameMap[functionName](functionArguments);
    const toolMessage = {
      tool_call_id: toolCalls[0].id,
      role: "tool",
      name: functionName,
      content: response,
    }
    return { messages: [toolMessage] };
  };

  const callModel = async ({ messages }: GraphState) => {
    // Calling the wrapped client will automatically infer the correct tracing context
    const response = await wrappedClient.chat.completions.create({
      messages,
      model: "gpt-5.4-mini",
      tools: [toolSchema],
    });
    const responseMessage = {
      role: "assistant",
      content: response.choices[0].message.content,
      tool_calls: response.choices[0].message.tool_calls ?? [],
    };
    return { messages: [responseMessage] };
  };

  const shouldContinue = ({ messages }: GraphState) => {
    const lastMessage =
      messages[messages.length - 1] as OpenAI.ChatCompletionAssistantMessageParam;
    if (
      lastMessage?.tool_calls !== undefined &&
      lastMessage?.tool_calls.length > 0
    ) {
      return "tools";
    }
    return "__end__";
  }

  const workflow = new StateGraph<GraphState>({
    channels: {
      messages: {
        reducer: (a: any, b: any) => a.concat(b),
      }
    }
  });

  const graph = workflow
    .addNode("model", callModel)
    .addNode("tools", callTools)
    .addEdge("__start__", "model")
    .addConditionalEdges("model", shouldContinue, {
      tools: "tools",
      __end__: "__end__",
    })
    .addEdge("tools", "model")
    .compile();

  await graph.invoke({
    messages: [{ role: "user", content: "what is the weather in sf" }]
  });
  ```
</CodeGroup>

### 查看跟踪

**详情查看**

单击跟踪，然后切换到右上角的 **详细信息** 视图。您在 LangSmith 中的跟踪应该是 [look like this](https://smith.langchain.com/public/c3d128fa-c618-4b0e-b9d0-ccbb619440d8/r)。

**消息查看**

LangSmith UI 中的 **消息** 视图显示用户和代理之间的简化对话历史记录。该视图从顶级跟踪中提取消息（包括用户的初始请求、工具调用和代理的最终响应），并以类似聊天的格式表示它们。

***<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/langsmith/trace-with-langgraph.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>