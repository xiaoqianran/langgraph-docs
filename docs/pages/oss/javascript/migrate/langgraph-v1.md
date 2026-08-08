<!-- langgraph-docs: LangGraph v1 migration guide | https://docs.langchain.com/oss/javascript/migrate/langgraph-v1 -->

# LangGraph v1 migration guide

This guide outlines changes in LangGraph v1 and how to migrate from previous versions. For a high-level overview of what's new, see the [release notes](/oss/javascript/releases/langgraph-v1).

To upgrade,

<CodeGroup>
  ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  npm install @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pnpm add @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  yarn add @langchain/langgraph@latest @langchain/core@latest
  ```

  ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  bun add @langchain/langgraph@latest @langchain/core@latest
  ```
</CodeGroup>

## Summary of changes

| Area                             | What changed                                               |
| -------------------------------- | ---------------------------------------------------------- |
| React prebuilt                   | `createReactAgent` deprecated; use LangChain `createAgent` |
| Interrupts                       | Typed interrupts supported via `interrupts` config         |
| `toLangGraphEventStream` removed | Use `graph.stream` with the desired `encoding` format      |
| `useStream`                      | Supports custom transports                                 |

***

## Deprecation: `createReactAgent` → `createAgent`

LangGraph v1 deprecates the `createReactAgent` prebuilt. Use LangChain's `createAgent`, which runs on LangGraph and adds a flexible middleware system.

See the LangChain v1 docs for details:

* [Release notes](/oss/javascript/releases/langchain-v1#createagent)
* [Migration guide](/oss/javascript/migrate/langchain-v1#createagent)

<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { createAgent } from "langchain";

  const agent = createAgent({
    model,
    tools,
    systemPrompt: "You are a helpful assistant.", // [!code highlight]
  });
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { createReactAgent } from "@langchain/langgraph/prebuilts";

  const agent = createReactAgent({
    model,
    tools,
    prompt: "You are a helpful assistant.", // [!code highlight]
  });
  ```
</CodeGroup>

***

## Typed interrupts

You can now define interrupt types at graph construction to strictly type the values passed to and received from interrupts.

<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { StateGraph, interrupt } from "@langchain/langgraph";
  import * as z from "zod";

  const State = z.object({ foo: z.string() });

  const graphConfig = {
    interrupts: {
      approve: interrupt<{ reason: string }, { messages: string[] }>(),
    },
  }

  const graph = new StateGraph(State, graphConfig)
    .addNode("node", async (state, runtime) => {
      const value = runtime.interrupt.approve({ reason: "review" }); // [!code highlight]
      return { foo: value };
    })
    .compile();
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  import { StateGraph } from "@langchain/langgraph";

  const graph = new StateGraph(State)
    .addNode("node", async (state, runtime) => {
      const value = runtime.interrupt.approve({ reason: "review" }); // [!code highlight]
      return state;
    })
    .compile();
  ```
</CodeGroup>

See [Interrupts](/oss/javascript/langgraph/interrupts) to learn more.

***

## Event stream encoding

The low-level `toLangGraphEventStream` helper is removed. Streaming responses are handled by the SDK; when using low-level clients, select the wire format via an `encoding` option passed to `graph.stream`.

<CodeGroup>
  ```typescript v1 (new) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  const stream = await graph.stream(input, {
    encoding: "text/event-stream",
    streamMode: ["values", "messages"],
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" }, // [!code highlight]
  });
  ```

  ```typescript v0 (old) theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  return toLangGraphEventStreamResponse({
    stream: graph.streamEvents(input, {
      version: "v2",
      streamMode: ["values", "messages"],
    }),
  });
  ```
</CodeGroup>

***

## Breaking changes

### Dropped Node 18 support

All LangGraph packages now require **Node.js 22 or higher**. Node.js 18 reached [end of life](https://nodejs.org/en/about/releases/) in March 2025.

### New build outputs

Builds for all langgraph packages now use a bundler based approach instead of using raw typescript outputs. If you were importing files from the `dist/` directory (which is not recommended), you will need to update your imports to use the new module system.

***

<div>
  <Callout icon="terminal-2">
    [Connect these docs](/use-these-docs) to Claude, VSCode, and more via MCP for real-time answers.
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/javascript/migrate/langgraph-v1.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).
  </Callout>
</div>