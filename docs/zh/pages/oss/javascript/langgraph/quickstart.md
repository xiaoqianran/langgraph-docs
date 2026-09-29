<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Quickstart | https://docs.langchain.com/oss/javascript/langgraph/quickstart -->

# 快速入门

This quickstart demonstrates how to build a calculator agent using the LangGraph Graph API or the Functional API.

<Prompt description="Build the LangGraph calculator quickstart" icon="sparkles">
  Build a LangGraph calculator agent in this working directory by following the LangGraph quickstart.

  ## 第 1 步：阅读指南

  Detect whether this project uses Python or TypeScript/JavaScript.获取并关注匹配的页面； treat it as the source of truth for package names, model strings, and code:

  * Python：[https://docs.langchain.com/oss/python/langgraph/quickstart.md](https://docs.langchain.com/oss/python/langgraph/quickstart.md)
  * 打字稿：[https://docs.langchain.com/oss/javascript/langgraph/quickstart.md](https://docs.langchain.com/oss/javascript/langgraph/quickstart.md)

  Ask the user whether to use the Graph API or the Functional API. If they have no preference, use the Graph API path.

  ## 第二步：安装依赖项

  Install the packages required by the chosen path with the package manager already used in this project.

  ## 步骤 3：配置模型凭据

  本快速入门默认使用 Anthropic。检查`ANTHROPIC_API_KEY`是否设置。 If it is not, ask the user to create a key and set it in the shell or a `.env` file, then stop and wait for confirmation.请勿发明、硬编码或提交 API 密钥。 If the user prefers another chat model provider from the integrations docs, adapt the example accordingly after confirming.

  ## 步骤 4：实现计算器代理Implement the selected quickstart path end to end: tools for add, multiply, and divide;代理图或功能工作流程； and a sample invocation that exercises tool calling. Print the final result so the user can verify the run.

  ## 规则

  * 请关注本快速入门。 Do not add deployment, evals, or unrelated frameworks unless the user asks.
  * Prefer the APIs and structure shown on the fetched guide over inventing a different agent pattern.
  * Ask rather than guess when a secret, API choice, or project convention is unclear.
</Prompt>

<Tip>
  **使用人工智能编码助手？**

  * Install the [LangChain Docs MCP servers](/use-these-docs) to give your agent access to up-to-date LangChain documentation and examples.

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

有关概念信息，请参阅 [Graph API overview](/oss/javascript/langgraph/graph-api) 和 [Functional API overview](/oss/javascript/langgraph/functional-api)。

<Info>
  对于此示例，您需要设置一个 [Claude (Anthropic)](https://www.anthropic.com/) 帐户并获取 API 密钥。然后，在终端中设置 `ANTHROPIC_API_KEY` 环境变量。请参阅 [chat model integrations](/oss/javascript/integrations/chat) 了解所有可用的提供商。如果您使用 [LangSmith Gateway](/langsmith/llm-gateway)，则可以 [bring your own provider keys](/langsmith/llm-gateway-quickstart#send-a-request) 或使用 [Gateway Credits](/langsmith/llm-gateway-credits) 无需提供者密钥即可访问模型。
</Info>

<Tabs>
  <Tab title="Use the Graph API">
    ## 1.定义工具和模型

    在此示例中，我们将使用 Claude Sonnet 4.5 模型并定义加法、乘法和除法工具。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { ChatAnthropic } from "@langchain/anthropic";
    import { tool } from "@langchain/core/tools";
    import * as z from "zod";

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-6",
      temperature: 0,
    });

    // Define tools
    const add = tool(({ a, b }) => a + b, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const multiply = tool(({ a, b }) => a * b, {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const divide = tool(({ a, b }) => a / b, {
      name: "divide",
      description: "Divide two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    // Augment the LLM with tools
    const toolsByName = {
      [add.name]: add,
      [multiply.name]: multiply,
      [divide.name]: divide,
    };
    const tools = Object.values(toolsByName);
    const modelWithTools = model.bindTools(tools);
    ```

    ## 2. 定义状态

    图的状态用于存储消息和 LLM 调用的数量。

    <Tip>
      LangGraph 中的状态在代理执行期间持续存在。

      `MessagesValue`提供了一个内置的reducer用于附加消息。 `llmCalls` 字段使用 `ReducedValue` 和 `(x, y) => x + y` 来累加计数。
    </Tip>

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import {
      StateGraph,
      StateSchema,
      MessagesValue,
      ReducedValue,
      GraphNode,
      ConditionalEdgeRouter,
      START,
      END,
    } from "@langchain/langgraph";
    import { z } from "zod/v4";

    const MessagesState = new StateSchema({
      messages: MessagesValue,
      llmCalls: new ReducedValue(
        z.number().default(0),
        { reducer: (x, y) => x + y }
      ),
    });
    ```

    ## 3.定义模型节点

    模型节点用于调用LLM并决定是否调用工具。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { SystemMessage } from "@langchain/core/messages";

    const llmCall: GraphNode<typeof MessagesState> = async (state) => {
      const response = await modelWithTools.invoke([
        new SystemMessage(
          "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
        ),
        ...state.messages,
      ]);
      return {
        messages: [response],
        llmCalls: 1,
      };
    };
    ```

    ## 4.定义工具节点工具节点用于调用工具并返回结果。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { AIMessage, ToolMessage } from "@langchain/core/messages";

    const toolNode: GraphNode<typeof MessagesState> = async (state) => {
      const lastMessage = state.messages.at(-1);

      if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
        return { messages: [] };
      }

      const result: ToolMessage[] = [];
      for (const toolCall of lastMessage.tool_calls ?? []) {
        const tool = toolsByName[toolCall.name];
        const observation = await tool.invoke(toolCall);
        result.push(observation);
      }

      return { messages: result };
    };
    ```

    ## 5.定义结束逻辑

    条件边函数用于根据 LLM 是否进行工具调用来路由到工具节点或末端。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    const shouldContinue: ConditionalEdgeRouter<{ InputSchema: typeof MessagesState; Nodes: "toolNode" }> = (state) => {
      const lastMessage = state.messages.at(-1);

      // Check if it's an AIMessage before accessing tool_calls
      if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
        return END;
      }

      // If the LLM makes a tool call, then perform an action
      if (lastMessage.tool_calls?.length) {
        return "toolNode";
      }

      // Otherwise, we stop (reply to the user)
      return END;
    };
    ```

    ## 6. 构建并编译代理

    该代理使用 [⟦T32⟧](https://reference.langchain.com/javascript/langchain-langgraph/index/StateGraph) 类构建，并使用 [⟦T33⟧](https://reference.langchain.com/javascript/classes/_langchain_langgraph.index.StateGraph.html#compile) 方法编译。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    const agent = new StateGraph(MessagesState)
      .addNode("llmCall", llmCall)
      .addNode("toolNode", toolNode)
      .addEdge(START, "llmCall")
      .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
      .addEdge("toolNode", "llmCall")
      .compile();

    // Invoke
    import { HumanMessage } from "@langchain/core/messages";
    const result = await agent.invoke({
      messages: [new HumanMessage("Add 3 and 4.")],
    });

    for (const message of result.messages) {
      console.log(`[${message.type}]: ${message.text}`);
    }
    ```

    <Tip>
      使用 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 跟踪和调试您的代理。按照[tracing quickstart](/langsmith/trace-with-langgraph)进行设置。准备好投入生产后，请参阅 [Deploy](/langsmith/deployment) 了解托管选项。

      我们建议您还设置 [LangSmith Engine](/langsmith/engine) 来监控您的痕迹、检测问题并提出修复建议。
    </Tip>

    恭喜！您已经使用 LangGraph Graph API 构建了第一个代理。

    <Accordion title="Full code example">
      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      // Step 1: Define tools and model

      import { ChatAnthropic } from "@langchain/anthropic";
      import { tool } from "@langchain/core/tools";
      import * as z from "zod";

      const model = new ChatAnthropic({
        model: "claude-sonnet-4-6",
        temperature: 0,
      });

      // Define tools
      const add = tool(({ a, b }) => a + b, {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const multiply = tool(({ a, b }) => a * b, {
        name: "multiply",
        description: "Multiply two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const divide = tool(({ a, b }) => a / b, {
        name: "divide",
        description: "Divide two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      // Augment the LLM with tools
      const toolsByName = {
        [add.name]: add,
        [multiply.name]: multiply,
        [divide.name]: divide,
      };
      const tools = Object.values(toolsByName);
      const modelWithTools = model.bindTools(tools);
      ```

      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      // Step 2: Define state

      import {
        StateGraph,
        StateSchema,
        MessagesValue,
        ReducedValue,
        GraphNode,
        ConditionalEdgeRouter,
        START,
        END,
      } from "@langchain/langgraph";
      import * as z from "zod";

      const MessagesState = new StateSchema({
        messages: MessagesValue,
        llmCalls: new ReducedValue(
          z.number().default(0),
          { reducer: (x, y) => x + y }
        ),
      });
      ```

      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      // Step 3: Define model node

      import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";

      const llmCall: GraphNode<typeof MessagesState> = async (state) => {
        return {
          messages: [await modelWithTools.invoke([
            new SystemMessage(
              "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
            ),
            ...state.messages,
          ])],
          llmCalls: 1,
        };
      };

      // Step 4: Define tool node

      const toolNode: GraphNode<typeof MessagesState> = async (state) => {
        const lastMessage = state.messages.at(-1);

        if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
          return { messages: [] };
        }

        const result: ToolMessage[] = [];
        for (const toolCall of lastMessage.tool_calls ?? []) {
          const tool = toolsByName[toolCall.name];
          const observation = await tool.invoke(toolCall);
          result.push(observation);
        }

        return { messages: result };
      };
      ```

      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      // Step 5: Define logic to determine whether to end
      import { ConditionalEdgeRouter, END } from "@langchain/langgraph";

      const shouldContinue: ConditionalEdgeRouter<{ InputSchema: typeof MessagesState; Nodes: "toolNode" }> = (state) => {
        const lastMessage = state.messages.at(-1);

        // Check if it's an AIMessage before accessing tool_calls
        if (!lastMessage || !AIMessage.isInstance(lastMessage)) {
          return END;
        }

        // If the LLM makes a tool call, then perform an action
        if (lastMessage.tool_calls?.length) {
          return "toolNode";
        }

        // Otherwise, we stop (reply to the user)
        return END;
      };
      ```

      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      // Step 6: Build and compile the agent
      import { HumanMessage } from "@langchain/core/messages";
      import { StateGraph, START, END } from "@langchain/langgraph";

      const agent = new StateGraph(MessagesState)
        .addNode("llmCall", llmCall)
        .addNode("toolNode", toolNode)
        .addEdge(START, "llmCall")
        .addConditionalEdges("llmCall", shouldContinue, ["toolNode", END])
        .addEdge("toolNode", "llmCall")
        .compile();

      // Invoke
      const result = await agent.invoke({
        messages: [new HumanMessage("Add 3 and 4.")],
      });

      for (const message of result.messages) {
        console.log(`[${message.type}]: ${message.text}`);
      }
      ```
    </Accordion>
  </Tab>

  <Tab title="Use the Functional API">
    ## 1.定义工具和模型

    在此示例中，我们将使用 Claude Sonnet 4.5 模型并定义加法、乘法和除法工具。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { ChatAnthropic } from "@langchain/anthropic";
    import { tool } from "@langchain/core/tools";
    import * as z from "zod";

    const model = new ChatAnthropic({
      model: "claude-sonnet-4-6",
      temperature: 0,
    });

    // Define tools
    const add = tool(({ a, b }) => a + b, {
      name: "add",
      description: "Add two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const multiply = tool(({ a, b }) => a * b, {
      name: "multiply",
      description: "Multiply two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    const divide = tool(({ a, b }) => a / b, {
      name: "divide",
      description: "Divide two numbers",
      schema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    });

    // Augment the LLM with tools
    const toolsByName = {
      [add.name]: add,
      [multiply.name]: multiply,
      [divide.name]: divide,
    };
    const tools = Object.values(toolsByName);
    const modelWithTools = model.bindTools(tools);

    ```

    ## 2.定义模型节点

    模型节点用于调用LLM并决定是否调用工具。

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { task, entrypoint } from "@langchain/langgraph";
    import { SystemMessage } from "@langchain/core/messages";

    const callLlm = task({ name: "callLlm" }, async (messages: BaseMessage[]) => {
      return modelWithTools.invoke([
        new SystemMessage(
          "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
        ),
        ...messages,
      ]);
    });
    ```

    ## 3.定义工具节点

    工具节点用于调用工具并返回结果。```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import type { ToolCall } from "@langchain/core/messages/tool";

    const callTool = task({ name: "callTool" }, async (toolCall: ToolCall) => {
      const tool = toolsByName[toolCall.name];
      return tool.invoke(toolCall);
    });
    ```

    ## 4.定义代理

    ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
    import { addMessages } from "@langchain/langgraph";
    import { type BaseMessage } from "@langchain/core/messages";

    const agent = entrypoint({ name: "agent" }, async (messages: BaseMessage[]) => {
      let modelResponse = await callLlm(messages);

      while (true) {
        if (!modelResponse.tool_calls?.length) {
          break;
        }

        // Execute tools
        const toolResults = await Promise.all(
          modelResponse.tool_calls.map((toolCall) => callTool(toolCall))
        );
        messages = addMessages(messages, [modelResponse, ...toolResults]);
        modelResponse = await callLlm(messages);
      }

      return messages;
    });

    // Invoke
    import { HumanMessage } from "@langchain/core/messages";

    const result = await agent.invoke([new HumanMessage("Add 3 and 4.")]);

    for (const message of result) {
      console.log(`[${message.getType()}]: ${message.text}`);
    }
    ```

    <Tip>
      使用 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-quickstart) 跟踪和调试您的代理。按照[tracing quickstart](/langsmith/trace-with-langgraph)进行设置。准备好投入生产后，请参阅 [Deploy](/langsmith/deployment) 了解托管选项。

      我们建议您还设置 [LangSmith Engine](/langsmith/engine) 来监控您的痕迹、检测问题并提出修复建议。
    </Tip>

    恭喜！您已经使用 LangGraph 功能 API 构建了第一个代理。

    <Accordion title="Full code example" icon="code">
      ```typescript theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
      import { ChatAnthropic } from "@langchain/anthropic";
      import { tool } from "@langchain/core/tools";
      import {
        task,
        entrypoint,
        addMessages,
      } from "@langchain/langgraph";
      import {
        SystemMessage,
        HumanMessage,
        type BaseMessage,
      } from "@langchain/core/messages";
      import type { ToolCall } from "@langchain/core/messages/tool";
      import * as z from "zod";

      // Step 1: Define tools and model

      const model = new ChatAnthropic({
        model: "claude-sonnet-4-6",
        temperature: 0,
      });

      // Define tools
      const add = tool(({ a, b }) => a + b, {
        name: "add",
        description: "Add two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const multiply = tool(({ a, b }) => a * b, {
        name: "multiply",
        description: "Multiply two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      const divide = tool(({ a, b }) => a / b, {
        name: "divide",
        description: "Divide two numbers",
        schema: z.object({
          a: z.number().describe("First number"),
          b: z.number().describe("Second number"),
        }),
      });

      // Augment the LLM with tools
      const toolsByName = {
        [add.name]: add,
        [multiply.name]: multiply,
        [divide.name]: divide,
      };
      const tools = Object.values(toolsByName);
      const modelWithTools = model.bindTools(tools);

      // Step 2: Define model node

      const callLlm = task({ name: "callLlm" }, async (messages: BaseMessage[]) => {
        return modelWithTools.invoke([
          new SystemMessage(
            "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
          ),
          ...messages,
        ]);
      });

      // Step 3: Define tool node

      const callTool = task({ name: "callTool" }, async (toolCall: ToolCall) => {
        const tool = toolsByName[toolCall.name];
        return tool.invoke(toolCall);
      });

      // Step 4: Define agent

      const agent = entrypoint({ name: "agent" }, async (messages: BaseMessage[]) => {
        let modelResponse = await callLlm(messages);

        while (true) {
          if (!modelResponse.tool_calls?.length) {
            break;
          }

          // Execute tools
          const toolResults = await Promise.all(
            modelResponse.tool_calls.map((toolCall) => callTool(toolCall))
          );
          messages = addMessages(messages, [modelResponse, ...toolResults]);
          modelResponse = await callLlm(messages);
        }

        return messages;
      });

      // Invoke

      const result = await agent.invoke([new HumanMessage("Add 3 and 4.")]);

      for (const message of result) {
        console.log(`[${message.type}]: ${message.text}`);
      }
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