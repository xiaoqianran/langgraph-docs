<!-- langgraph-docs: Thinking in the Graph API | https://docs.langchain.com/oss/javascript/langgraph/thinking-in-graph-api -->

# Thinking in the Graph API

Learn how to design agents with the LangGraph Graph API using nodes, edges, and shared state.

When you build an agent with the [Graph API](/oss/javascript/langgraph/graph-api), you break the process into discrete steps called **nodes**. Then you describe the decisions and transitions from each node. Finally, you connect nodes through a shared **state** that each node can read from and write to.

This walkthrough builds a customer support email agent with the Graph API. For the same scenario with the Functional API, see [Thinking in the Functional API](/oss/javascript/langgraph/thinking-in-functional-api). To choose between the APIs, see [Choosing between Graph and Functional APIs](/oss/javascript/langgraph/choosing-apis).

## Start with the process you want to automate

Imagine that you need to build an AI agent that handles customer support emails. Your product team has given you these requirements:

```txt theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
The agent should:

- Read incoming customer emails
- Classify them by urgency and topic
- Search relevant documentation to answer questions
- Draft appropriate responses
- Escalate complex issues to human agents

Example scenarios to handle:

1. Simple product question: "How do I reset my password?"
2. Bug report: "The export feature crashes when I select PDF format"
3. Urgent billing issue: "I was charged twice for my subscription!"
4. Feature request: "Can you add dark mode to the mobile app?"
5. Complex technical issue: "Our API integration fails intermittently with 504 errors"
```

To implement an agent with the Graph API, this guide shows you five steps. Steps 1 and 2 are planning. Steps 3 through 5 turn that plan into state, nodes, and a compiled graph you can run.

## Step 1: Map out your workflow as discrete steps

Start by identifying the distinct steps in your process. Each step becomes a **node** (a function that does one specific thing). Then sketch how these steps connect. Do this before writing code.

![Graph API control flow: START through classify and draft, then human review or send, to END](https://mintcdn.com/langchain-5e9cc07a/fVUPpLd2squx_ubj/images/langgraph-graph-thinking-flow.svg?fit=max\&auto=format\&n=fVUPpLd2squx_ubj\&q=85\&s=76cebca75b2c16990b7f0dc883b4a050)

Solid arrows are fixed edges: you declare them when you build the graph because the next node is known before a run. Dashed arrows are routes chosen at runtime inside a node with [`Command`](https://reference.langchain.com/javascript/langchain-langgraph/index/Command).

Now that the components are identified, clarify what each node needs to do:

* `Read Email`: Extract and parse the email content
* `Classify Intent`: Use an LLM to categorize urgency and topic, then route to search, bug tracking, or draft
* `Doc Search`: Query your knowledge base for relevant information
* `Bug Track`: Create or update an issue in a tracking system
* `Draft Reply`: Generate an appropriate response, then route to human review or send
* `Human Review`: Escalate to a human agent for approval or handling
* `Send Reply`: Dispatch the email response

> [!TIP]
>
> Some nodes always continue on a fixed edge (`Read Email` to `Classify Intent`). Others choose the next node with `Command` (`Classify Intent`, `Draft Reply`, `Human Review`).

## Step 2: Identify what each step needs to do

For each node from Step 1, decide what kind of work it is and what context it needs. Use the categories below, then expand the email-agent examples for concrete fields and retry choices.

> [card] [LLM steps](#llm-steps)
>
> Use when you need to understand, analyze, generate text, or make reasoning decisions

> [card] [Data steps](#data-steps)
>
> Use when you need to retrieve information from external sources

> [card] [Action steps](#action-steps)
>
> Use when you need to perform external actions

> [card] [User input steps](#user-input-steps)
>
> Use when you need human intervention

### LLM steps

When a step needs to understand, analyze, generate text, or make reasoning decisions:

> [accordion] Classify intent
>
> * Static context (prompt): Classification categories, urgency definitions, response format
> * Dynamic context (from state): Email content, sender information
> * Desired outcome: Structured classification that determines routing

> [accordion] Draft reply
>
> * Static context (prompt): Tone guidelines, company policies, response templates
> * Dynamic context (from state): Classification results, search results
> * Desired outcome: Professional email response ready for review

### Data steps

When a step needs to retrieve information from external sources:

> [accordion] Document search
>
> * Parameters: Query built from intent and topic
> * Retry strategy: Yes, with exponential backoff for transient failures
> * Caching: Could cache common queries to reduce API calls

### Action steps

When a step needs to perform an external action:

> [accordion] Send reply
>
> * When to execute: After approval (human or automated)
> * Retry strategy: Yes, with exponential backoff for network issues
> * Should not cache: Each send is a unique action

> [accordion] Bug track
>
> * When to execute: Always when intent is "bug"
> * Retry strategy: Yes, critical to not lose bug reports
> * Returns: Ticket ID to include in the response

### User input steps

When a step needs human intervention:

> [accordion] Human review
>
> * Context for decision: Original email, draft response, urgency, classification
> * Expected input format: Approval boolean plus optional edited response
> * When triggered: High urgency, billing, or complex issues
> * On rejection: End the run without sending (human handles the email outside the graph)

## Step 3: Design your state

State is the shared [memory](/oss/javascript/concepts/memory) accessible to all nodes in your agent. Think of it as the notebook your agent uses to keep track of everything it learns and decides as it works through the process.

### What belongs in state?

Ask yourself these questions about each piece of data:

> [card] Include in state
>
> Does it need to persist across steps? If yes, it goes in state.

> [card] Do not store
>
> Can you derive it from other data? If yes, compute it when needed instead of storing it in state.

For the email agent, track:

* The original email and sender info (cannot reconstruct these later)
* Classification results (needed by later nodes)
* Search results or ticket context (expensive to re-fetch)
* The draft response (needs to persist through review)
* Execution metadata (for debugging and recovery)

### Keep state raw, format prompts on demand

> [!TIP]
>
> Store raw data in state, not formatted prompt text. Format prompts inside nodes when you need them.

That separation means:

* Different nodes can format the same data differently
* You can change prompt templates without changing the state schema
* Debugging shows the data each node received, not a baked-in prompt string

Define the state now. The nodes in the next steps use these fields.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { StateSchema } from "@langchain/langgraph";
import * as z from "zod";

const EmailClassificationSchema = z.object({
  intent: z.enum(["question", "bug", "billing", "feature", "complex"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  topic: z.string(),
  summary: z.string(),
});

const EmailAgentState = new StateSchema({
  emailContent: z.string(),
  senderEmail: z.string(),
  emailId: z.string(),
  classification: EmailClassificationSchema.optional(),
  searchResults: z.array(z.string()).optional(),
  draftResponse: z.string().optional(),
});

type EmailClassification = z.infer<typeof EmailClassificationSchema>;
```

## Step 4: Build your nodes

A node is a function that takes the current state and returns updates to it. When the node also chooses the next step, return a `Command`.

### Handle errors appropriately

Before you fill in node bodies, consider how each node can fail. Attach retries on nodes that call external APIs. Use `interrupt()` for human input. Use this table as a guide:

| Error type | Who fixes it | Strategy | When to use |
| - | - | - | - |
| Transient errors (network issues, rate limits) | System (automatic) | Retry policy on the node | Temporary failures that usually resolve on retry |
| LLM-recoverable errors (tool failures, parsing issues) | LLM | Store the error in state and route back | The model can adjust with more context |
| User-fixable errors (missing information, unclear instructions) | Human | Pause with `interrupt()` | Need user input to proceed |
| Recoverable failure after retries | Developer | `error_handler` (Python) / `errorHandler` (TypeScript) | Run a compensation branch after retry exhaustion |
| Unexpected errors | Developer | Fail the run | Bugs that need a code fix |

For retry policies, timeouts, compensation handlers, LLM-recoverable loops, when to let errors bubble up, and graph-wide defaults, see [Fault tolerance](/oss/javascript/langgraph/fault-tolerance#recovery-strategies).

For this example, attach a retry policy when you add a node that can hit transient failures:

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
workflow.addNode("searchDocumentation", searchDocumentation, {
  retryPolicy: { maxAttempts: 3 },
});
```

### Implementing the email agent nodes

Turn each unit of work into a node. Each node reads the shared state, does one piece of work, and returns updates. When the next step depends on the result, return a `Command` with both the update and the destination. Human review is still a node: it calls `interrupt()` inside the function, not a separate graph primitive.

The stubs below show the signatures, state updates, and routing for the email agent. Replace the placeholder bodies with your real LLM calls and API integrations. Put these nodes in the same file as the state from Step 3.

`read_email` is a passthrough in this walkthrough. Keeping it as its own node still gives you a checkpoint before classification and a place to add real MIME parsing later.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  Command,
  END,
  type GraphNode,
  interrupt,
} from "@langchain/langgraph";

const readEmail: GraphNode<typeof EmailAgentState> = async (state) => {
  return {};
};

const classifyIntent: GraphNode<typeof EmailAgentState> = async (state) => {
  // Placeholder: replace with a real LLM call.
  // This heuristic matches the try-out sample so interrupt() runs.
  const lowered = state.emailContent.toLowerCase();
  let classification: EmailClassification;
  if (lowered.includes("charged") || lowered.includes("billing")) {
    classification = {
      intent: "billing",
      urgency: "high",
      topic: "billing",
      summary: "Customer reports a billing problem",
    };
  } else if (lowered.includes("crash") || lowered.includes("bug")) {
    classification = {
      intent: "bug",
      urgency: "medium",
      topic: "product bug",
      summary: "Customer reports a bug",
    };
  } else {
    classification = {
      intent: "question",
      urgency: "low",
      topic: "general",
      summary: "Customer question",
    };
  }

  let goto: "searchDocumentation" | "bugTracking" | "draftReply";
  if (classification.intent === "question" || classification.intent === "feature") {
    goto = "searchDocumentation";
  } else if (classification.intent === "bug") {
    goto = "bugTracking";
  } else {
    goto = "draftReply";
  }

  return new Command({ update: { classification }, goto });
};

const searchDocumentation: GraphNode<typeof EmailAgentState> = async (state) => {
  const classification = state.classification!;
  return new Command({
    update: { searchResults: [`Docs related to ${classification.topic}`] },
    goto: "draftReply",
  });
};

const bugTracking: GraphNode<typeof EmailAgentState> = async (state) => {
  const ticketId = "BUG-12345";
  return new Command({
    update: { searchResults: [`Bug ticket ${ticketId} created`] },
    goto: "draftReply",
  });
};

const draftResponse: GraphNode<typeof EmailAgentState> = async (state) => {
  const classification = state.classification!;
  const context = state.searchResults ?? [];
  let draft = `Thanks for your email about ${classification.topic}.`;
  if (context.length > 0) {
    draft += ` Context: ${context[0]}`;
  }

  const needsReview =
    classification.intent === "billing" ||
    classification.intent === "complex" ||
    classification.urgency === "high" ||
    classification.urgency === "critical";

  return new Command({
    update: { draftResponse: draft },
    goto: needsReview ? "humanReview" : "sendReply",
  });
};

const humanReview: GraphNode<typeof EmailAgentState> = async (state) => {
  const classification = state.classification!;

  // Nodes re-run from the start on resume. Keep work before interrupt() idempotent.
  const humanDecision = interrupt({
    emailId: state.emailId,
    originalEmail: state.emailContent,
    draftResponse: state.draftResponse,
    urgency: classification.urgency,
    intent: classification.intent,
    action: "Please review and approve/edit this response",
  });

  if (humanDecision?.approved) {
    return new Command({
      update: {
        draftResponse: humanDecision.editedResponse ?? state.draftResponse,
      },
      goto: "sendReply",
    });
  }
  // Rejection: human handles the email outside the graph
  return new Command({ update: {}, goto: END });
};

const sendReply: GraphNode<typeof EmailAgentState> = async (state) => {
  return {};
};
```

You now have node functions. Next, wire them into a compiled graph.

## Step 5: Wire it together

Connect the nodes into a graph. Because routing lives inside `Command` nodes, you only need a few fixed edges. Compile with a [checkpointer](/oss/javascript/langgraph/persistence), which is required for `interrupt()` to pause and resume.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { END, MemorySaver, START, StateGraph } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const app = new StateGraph(EmailAgentState)
  .addNode("readEmail", readEmail)
  .addNode("classifyIntent", classifyIntent, {
    ends: ["searchDocumentation", "bugTracking", "draftReply"],
  })
  .addNode("searchDocumentation", searchDocumentation, {
    ends: ["draftReply"],
    retryPolicy: { maxAttempts: 3 },
  })
  .addNode("bugTracking", bugTracking, {
    ends: ["draftReply"],
    retryPolicy: { maxAttempts: 3 },
  })
  .addNode("draftReply", draftResponse, {
    ends: ["humanReview", "sendReply"],
  })
  .addNode("humanReview", humanReview, {
    ends: ["sendReply", END],
  })
  .addNode("sendReply", sendReply)
  .addEdge(START, "readEmail")
  .addEdge("readEmail", "classifyIntent")
  .addEdge("sendReply", END)
  .compile({ checkpointer });
```

When a TypeScript node returns `Command`, pass `ends` to `addNode` so LangGraph knows the valid destinations.

### Try out your agent

After the graph is compiled, invoke it with a sample email. With the placeholder classifier above, this urgent billing message is treated as high urgency, so the run drafts a reply, hits `interrupt()`, and you can practice resume. Use the same `thread_id` for the first invoke and the resume invoke.

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command } from "@langchain/langgraph";

const config = { configurable: { thread_id: "customer_123" } };

const result = await app.invoke(
  {
    emailContent: "I was charged twice for my subscription! This is urgent!",
    senderEmail: "customer@example.com",
    emailId: "email_123",
  },
  config
);
// The graph pauses at humanReview when urgency is high

await app.invoke(
  new Command({
    resume: {
      approved: true,
      editedResponse:
        "We sincerely apologize for the double charge. I've initiated an immediate refund...",
    },
  }),
  config
);
```

The graph pauses at `interrupt()`, saves state to the checkpointer, and waits. When you resume with `Command(resume=...)`, the `human_review` node re-runs from the start, `interrupt()` returns your resume value, and the graph continues. The `thread_id` keeps this conversation's state together.

## Summary and next steps

### Key insights

Building this email agent shows the Graph API way of thinking:

> [card] [Break into discrete steps](#step-1-map-out-your-workflow-as-discrete-steps)
>
> Each node does one thing well. Node boundaries are where the graph checkpoints, so failures and resumes redo less work.

> [card] [State is shared memory](#step-3-design-your-state)
>
> Store raw data, not formatted text. Different nodes can use the same information in different ways.

> [card] [Nodes are functions](#step-4-build-your-nodes)
>
> They take state, do work, and return updates. When they route, they return both the update and the next destination with `Command`.

> [card] [Errors are part of the flow](#handle-errors-appropriately)
>
> Transient failures get node retry policies, user-fixable problems pause with `interrupt()`, and unexpected errors fail the run.

> [card] [Human input is first-class](/oss/javascript/langgraph/interrupts)
>
> `interrupt()` pauses execution and saves state. On resume, the node re-runs from the start, so keep work before `interrupt()` idempotent.

> [card] [Graph structure stays minimal](#step-5-wire-it-together)
>
> You declare essential edges. Nodes that need dynamic routing return `Command`, which keeps control flow explicit and traceable.

### Node granularity trade-offs

Most applications can use the breakdown above. Read this section when you are deciding whether to merge or split nodes.

LangGraph checkpoints at **node** boundaries. When a run resumes after an interrupt or failure, it restarts from the beginning of the node where execution stopped. Smaller nodes mean more frequent checkpoints and less work to repeat.

Why this breakdown fits the email agent:

* **Isolation of external services:** Doc Search and Bug Track are separate nodes so retries stay scoped to those API calls.
* **Visibility:** Classification is its own node, so you can inspect the structured result before the next action.
* **Different failure modes:** LLM calls, lookups, and email sends get different retry policies.
* **Testing:** Smaller nodes are easier to unit test and reuse.

Merging `Read Email` and `Classify Intent` into one node is valid. You lose a checkpoint between them and repeat both on failure. For most agents, the observability benefit of separate nodes is worth it.

Caching search results is an application-level choice inside your node functions. LangGraph does not prescribe a cache API for that. More nodes do not necessarily mean slower runs: by default, checkpoints write in the background ([async durability mode](/oss/javascript/langgraph/checkpointers#durability-modes)).

### Where to go from here

This walkthrough introduces Graph API design. Extend it with the how-tos and related guides:

> [card] [Build checklist](/oss/javascript/langgraph/use-graph-api)
>
> Decision guide for state, control flow, Send, Command, and nodes

> [card] [Define and update state](/oss/javascript/langgraph/graph-api-state)
>
> Schemas, reducers, messages, and private channels

> [card] [Control flow](/oss/javascript/langgraph/graph-api-control-flow)
>
> Sequences, branches, loops, and recursion limits

> [card] [Send and Command](/oss/javascript/langgraph/graph-api-send-command)
>
> Map-reduce fan-out and update-and-route in one step

> [card] [Configure nodes](/oss/javascript/langgraph/graph-api-nodes)
>
> Retries, timeouts, runtime context, and caching

> [card] [Thinking in the Functional API](/oss/javascript/langgraph/thinking-in-functional-api)
>
> The same email agent with entrypoints and tasks

> [card] [Human-in-the-loop patterns](/oss/javascript/langgraph/interrupts)
>
> Tool approval, batch approval, and other interrupt patterns

> [card] [Add memory](/oss/javascript/langgraph/add-memory)
>
> Short-term checkpointers and long-term stores

> [card] [Fault tolerance](/oss/javascript/langgraph/fault-tolerance)
>
> Retries, timeouts, error handlers, and graph defaults

> [card] [Subgraphs](/oss/javascript/langgraph/use-subgraphs)
>
> Nested graphs for complex multi-step operations

> [card] [Streaming](/oss/javascript/langgraph/streaming)
>
> Real-time progress updates for users

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/thinking-in-graph-api.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).