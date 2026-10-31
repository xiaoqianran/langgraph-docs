<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Build a custom SQL agent | https://docs.langchain.com/oss/javascript/langgraph/sql-agent -->

# 构建自定义 SQL 代理

在本教程中，我们将构建一个自定义代理，它可以使用 LangGraph 回答有关 SQL 数据库的问题。

LangChain 提供内置 [agent](/oss/javascript/langchain/agents) 实现，使用 [LangGraph](/oss/javascript/langgraph/overview) 原语实现。如果需要更深入的定制，可以直接在LangGraph中实现代理。本指南演示了 SQL 代理的示例实现。实用介绍请参见[building a SQL agent using higher-level LangChain abstractions](/oss/javascript/langchain/sql-agent)。

> [!警告]
>
> 构建 SQL 数据库的问答系统需要执行模型生成的 SQL 查询。这样做存在固有的风险。确保数据库连接权限的范围始终尽可能缩小，以满足代理的需求。这将减轻（但不能消除）构建模型驱动系统的风险。

[prebuilt agent](/oss/javascript/langchain/sql-agent)让我们快速上手，但我们依靠系统提示来限制其行为 - 例如，我们指示代理始终从“列表表”工具开始，并始终在执行查询之前运行查询检查器工具。我们可以通过定制代理来在LangGraph中实施更高程度的控制。在这里，我们实现了一个简单的 ReAct-agent 设置，其中包含用于特定工具调用的专用节点。我们将使用与预构建代理相同的 \[state]。

### 概念

我们将涵盖以下概念：

* [Tools](/oss/javascript/langchain/tools) 用于从 SQL 数据库读取
* LangGraph [Graph API](/oss/javascript/langgraph/graph-api)，包括状态、节点、边和条件边。
* [Human-in-the-loop](/oss/javascript/langgraph/interrupts)流程

## 设置

### 安装

```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
npm i langchain @langchain/core @langchain/langgraph @langchain/openai sqlite3 zod
```

```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
yarn add langchain @langchain/core @langchain/langgraph @langchain/openai sqlite3 zod
```

```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
pnpm add langchain @langchain/core @langchain/langgraph @langchain/openai sqlite3 zod
```

### LangSmith

设置 [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-sql-agent) 来检查您的连锁店或代理内部发生的情况。然后设置以下环境变量：

```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
export LANGSMITH_TRACING="true"
export LANGSMITH_API_KEY="..."
```

## 1. 选择法学硕士

选择支持[tool-calling](/oss/javascript/integrations/providers/overview)的型号：

> [标签] OpenAI
>
> 👉 阅读[OpenAI chat model integration docs](/oss/javascript/integrations/chat/openai/)
>
> ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/openai
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm install @langchain/openai
> ```
>
> ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> yarn add @langchain/openai
> ```
>
> ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> bun add @langchain/openai
> ```
>
> ```typescript initChatModel theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { initChatModel } from "langchain";
>
> process.env.OPENAI_API_KEY = "your-api-key";
>
> const model = await initChatModel("gpt-5.5");
> ```
>
> ```typescript Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatOpenAI } from "@langchain/openai";
>
> const model = new ChatOpenAI({
>   model: "gpt-5.5",
>   apiKey: "your-api-key"
> });
> ```

> [标签] Anthropic
>
> 👉 阅读[Anthropic chat model integration docs](/oss/javascript/integrations/chat/anthropic/)
>
> ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/anthropic
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm install @langchain/anthropic
> ```
>
> ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> yarn add @langchain/anthropic
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm add @langchain/anthropic
> ```
>
> ```typescript initChatModel theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { initChatModel } from "langchain";
>
> process.env.ANTHROPIC_API_KEY = "your-api-key";
>
> const model = await initChatModel("claude-sonnet-4-6");
> ```
>
> ```typescript Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatAnthropic } from "@langchain/anthropic";
>
> const model = new ChatAnthropic({
>   model: "claude-sonnet-4-6",
>   apiKey: "your-api-key"
> });
> ```

> [选项卡] 天蓝色
>
> 👉 阅读[Azure chat model integration docs](/oss/javascript/integrations/chat/azure/)
>
> ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/azure
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm install @langchain/azure
> ```
>
> ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> yarn add @langchain/azure
> ```
>
> ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> bun add @langchain/azure
> ```
>
> ```typescript initChatModel theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { initChatModel } from "langchain";
>
> process.env.AZURE_OPENAI_API_KEY = "your-api-key";
> process.env.AZURE_OPENAI_ENDPOINT = "your-endpoint";
> process.env.OPENAI_API_VERSION = "your-api-version";
>
> const model = await initChatModel("azure_openai:gpt-5.5");
> ```
>
> ```typescript Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { AzureChatOpenAI } from "@langchain/openai";
>
> const model = new AzureChatOpenAI({
>   model: "gpt-5.5",
>   azureOpenAIApiKey: "your-api-key",
>   azureOpenAIApiEndpoint: "your-endpoint",
>   azureOpenAIApiVersion: "your-api-version"
> });
> ```

> [选项卡] 谷歌双子座
>
> 👉 阅读[ChatGoogle chat model integration docs](/oss/javascript/integrations/chat/google)
>
> ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/google
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm install @langchain/google
> ```
>
> ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> yarn add @langchain/google
> ```
>
> ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> bun add @langchain/google
> ```
>
> ```typescript initChatModel theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { initChatModel } from "langchain";
>
> process.env.GOOGLE_API_KEY = "your-api-key";
>
> const model = await initChatModel("google:gemini-3.7-flash");
> ```
>
> ```typescript Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatGoogle } from "@langchain/google/node";
>
> const model = new ChatGoogle({
>   model: "gemini-3.7-flash",
>   apiKey: "your-api-key"
> });
> ```

> [标签] 基岩匡威
>
> 👉 阅读[AWS Bedrock chat model integration docs](/oss/javascript/integrations/chat/bedrock_converse/)
>
> ```bash npm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/aws
> ```
>
> ```bash pnpm theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> pnpm install @langchain/aws
> ```
>
> ```bash yarn theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> yarn add @langchain/aws
> ```
>
> ```bash bun theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> bun add @langchain/aws
> ```
>
> ```typescript initChatModel theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { initChatModel } from "langchain";
>
> // Follow the steps here to configure your credentials:
> // https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html
>
> const model = await initChatModel("bedrock:gpt-5.5");
> ```
>
> ```typescript Model Class theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { ChatBedrockConverse } from "@langchain/aws";
>
> // Follow the steps here to configure your credentials:
> // https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html
>
> const model = new ChatBedrockConverse({
>   model: "gpt-5.5",
>   region: "us-east-2"
> });
> ```

以下示例中显示的输出使用OpenAI。## 2.配置数据库

您将为本教程创建一个 [SQLite database](https://www.sqlitetutorial.net/sqlite-sample-database/)。 SQLite 是一个轻量级数据库，易于设置和使用。我们将加载 `chinook` 数据库，这是代表数字媒体商店的示例数据库。

为了方便起见，我们将数据库 (`Chinook.db`) 托管在公共 GCS 存储桶上。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import fs from "node:fs/promises";
import path from "node:path";

const url =
  "https://storage.googleapis.com/benchmarks-artifacts/chinook/Chinook.db";
const localPath = path.resolve("Chinook.db");

async function resolveDbPath() {
  const exists = await fs
    .access(localPath)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    console.log(`${localPath} already exists, skipping download.`);
    return localPath;
  }
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(`Failed to download DB. Status code: ${resp.status}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  await fs.writeFile(localPath, buf);
  console.log(`File downloaded and saved as ${localPath}`);
  return localPath;
}
```

我们将使用`sqlite3`库与数据库交互：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import sqlite3 from "sqlite3";

const dialect = "sqlite";

async function runQuery(query: string, params: unknown[] = []): Promise<any[]> {
  const dbPath = await resolveDbPath();
  const db = new sqlite3.Database(dbPath);
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      db.close();
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

const tableRows = await runQuery(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
);
const tableNames = tableRows.map((row) => String(row.name));
console.log(`Dialect: ${dialect}`);
console.log(`Available tables: ${tableNames.join(", ")}`);
const sampleResults = await runQuery("SELECT * FROM Artist LIMIT 5;");
console.log(`Sample output: ${JSON.stringify(sampleResults)}`);
```

```
Dialect: sqlite
Available tables: Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track
Sample output: [{"ArtistId":1,"Name":"AC/DC"},{"ArtistId":2,"Name":"Accept"},{"ArtistId":3,"Name":"Aerosmith"},{"ArtistId":4,"Name":"Alanis Morissette"},{"ArtistId":5,"Name":"Alice In Chains"}]
```

## 3.添加数据库交互工具

> [!警告]
>
> 以下数据库工具是最小包装器，仅用于演示目的。它们的目的不是为了安全或在生产中使用。在执行模型生成的 SQL 之前，使用范围狭窄的数据库权限并添加特定于应用程序的验证。

我们将创建自定义工具来与数据库交互：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { tool } from "langchain";
import * as z from "zod";

async function getTableNames() {
  const rows = await runQuery(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';",
  );
  return rows.map((row) => String(row.name));
}

function quoteSqliteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

const listTablesTool = tool(
  async () => {
    const tableNames = await getTableNames();
    return tableNames.join(", ");
  },
  {
    name: "sql_db_list_tables",
    description:
      "Input is an empty string, output is a comma-separated list of tables in the database.",
    schema: z.object({}),
  },
);

const getSchemaTool = tool(
  async ({ table_names }) => {
    const validTables = new Set(await getTableNames());
    const results: string[] = [];
    for (const table of table_names.split(",").map((t) => t.trim())) {
      if (!validTables.has(table)) {
        results.push(`Error: table_names {'${table}'} not found in database`);
        continue;
      }
      const schemaRows = await runQuery(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?;",
        [table],
      );
      const schema = schemaRows[0]?.sql;
      if (schema) {
        results.push(String(schema));
        try {
          const rows = await runQuery(
            `SELECT * FROM ${quoteSqliteIdentifier(table)} LIMIT 3;`,
          );
          if (rows.length > 0) {
            const colNames = Object.keys(rows[0]);
            results.push(
              `/*\n3 rows from ${table} table:\n${colNames.join("\t")}\n` +
                rows
                  .map((row) =>
                    colNames.map((col) => String(row[col])).join("\t"),
                  )
                  .join("\n") +
                "\n*/",
            );
          }
        } catch (e) {
          results.push(`Error fetching sample rows: ${e}`);
        }
      }
    }
    return results.join("\n\n");
  },
  {
    name: "sql_db_schema",
    description:
      "Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables. Be sure that the tables actually exist by calling sql_db_list_tables first! Example Input: table1, table2, table3",
    schema: z.object({
      table_names: z.string().describe("Comma-separated list of table names"),
    }),
  },
);

const queryTool = tool(
  async ({ query }) => {
    try {
      const result = await runQuery(query);
      return JSON.stringify(result);
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "sql_db_query",
    description:
      "Input to this tool is a detailed and correct SQL query, output is a result from the database. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again.",
    schema: z.object({
      query: z.string().describe("SQL query to execute"),
    }),
  },
);

const tools = [listTablesTool, getSchemaTool, queryTool];

for (const toolItem of tools) {
  console.log(`${toolItem.name}: ${toolItem.description}\n`);
}
```

```
sql_db_list_tables: Input is an empty string, output is a comma-separated list of tables in the database.

sql_db_schema: Input to this tool is a comma-separated list of tables, output is the schema and sample rows for those tables. Be sure that the tables actually exist by calling sql_db_list_tables first! Example Input: table1, table2, table3

sql_db_query: Input to this tool is a detailed and correct SQL query, output is a result from the database. If the query is not correct, an error message will be returned. If an error is returned, rewrite the query, check the query, and try again.
```

## 4. 定义应用步骤

我们构建专用节点的步骤如下：

* 列出数据库表
* 调用“获取模式”工具
* 生成查询
* 检查查询

将这些步骤放入专用节点中可以让我们 (1) 在需要时强制调用工具，以及 (2) 自定义与每个步骤相关的提示。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  END,
  GraphNode,
  MessagesValue,
  START,
  StateGraph,
  StateSchema,
} from "@langchain/langgraph";

// Create tool nodes for schema and query execution
const getSchemaNode = new ToolNode([getSchemaTool]);
const runQueryNode = new ToolNode([queryTool]);

// Define state schema
const MessagesState = new StateSchema({
  messages: MessagesValue,
});

// Example: create a predetermined tool call
const listTables: GraphNode<typeof MessagesState> = async (state) => {
  const toolCall = {
    name: "sql_db_list_tables",
    args: {},
    id: "abc123",
    type: "tool_call" as const,
  };
  const toolCallMessage = new AIMessage({
    content: "",
    tool_calls: [toolCall],
  });

  const toolMessage = await listTablesTool.invoke({});
  const response = new AIMessage(`Available tables: ${toolMessage}`);

  return {
    messages: [
      toolCallMessage,
      new ToolMessage({ content: toolMessage, tool_call_id: "abc123" }),
      response,
    ],
  };
};

// Example: force a model to create a tool call
const callGetSchema: GraphNode<typeof MessagesState> = async (state) => {
  const llmWithTools = model!.bindTools([getSchemaTool], {
    tool_choice: "any",
  });
  const response = await llmWithTools.invoke(state.messages);

  return { messages: [response] };
};

const topK = 5;

const generateQuerySystemPrompt = `
You are an agent designed to interact with a SQL database.
Given an input question, create a syntactically correct ${dialect}
query to run, then look at the results of the query and return the answer. Unless
the user specifies a specific number of examples they wish to obtain, always limit
your query to at most ${topK} results.

You can order the results by a relevant column to return the most interesting
examples in the database. Never query for all the columns from a specific table,
only ask for the relevant columns given the question.

DO NOT make any DML statements (INSERT, UPDATE, DELETE, DROP etc.) to the database.
`;

const generateQuery: GraphNode<typeof MessagesState> = async (state) => {
  const systemMessage = new SystemMessage(generateQuerySystemPrompt);
  // We do not force a tool call here, to allow the model to
  // respond naturally when it obtains the solution.
  const llmWithTools = model!.bindTools([queryTool]);
  const response = await llmWithTools.invoke([
    systemMessage,
    ...state.messages,
  ]);

  return { messages: [response] };
};

const checkQuerySystemPrompt = `
You are a SQL expert with a strong attention to detail.
Double check the ${dialect} query for common mistakes, including:
- Using NOT IN with NULL values
- Using UNION when UNION ALL should have been used
- Using BETWEEN for exclusive ranges
- Data type mismatch in predicates
- Properly quoting identifiers
- Using the correct number of arguments for functions
- Casting to the correct data type
- Using the proper columns for joins

If there are any of the above mistakes, rewrite the query. If there are no mistakes,
just reproduce the original query.

You will call the appropriate tool to execute the query after running this check.
`;

const checkQuery: GraphNode<typeof MessagesState> = async (state) => {
  const systemMessage = new SystemMessage(checkQuerySystemPrompt);

  // Generate an artificial user message to check
  const lastMessage = state.messages[state.messages.length - 1];
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    throw new Error("No tool calls found in the last message");
  }
  const toolCall = lastMessage.tool_calls[0];
  const userMessage = new HumanMessage(toolCall.args.query);
  const llmWithTools = model!.bindTools([queryTool], {
    tool_choice: "any",
  });
  const response = await llmWithTools.invoke([systemMessage, userMessage]);
  // Preserve the original message ID
  response.id = lastMessage.id;

  return { messages: [response] };
};
```

## 5. 实现代理现在，我们可以使用 [Graph API](/oss/javascript/langgraph/graph-api) 将这些步骤组装到工作流程中。我们在查询生成步骤定义一个[conditional edge](/oss/javascript/langgraph/graph-api#conditional-edges)，如果生成了查询，它将路由到查询检查器，或者如果不存在工具调用则结束，以便LLM已交付对查询的响应。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { ConditionalEdgeRouter } from "@langchain/langgraph";

const shouldContinue: ConditionalEdgeRouter<{ InputSchema: typeof MessagesState; Nodes: "check_query" }> = (state) => {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    return END;
  } else {
    return "check_query";
  }
};

const builder = new StateGraph(MessagesState)
  .addNode("list_tables", listTables)
  .addNode("call_get_schema", callGetSchema)
  .addNode("get_schema", getSchemaNode)
  .addNode("generate_query", generateQuery)
  .addNode("check_query", checkQuery)
  .addNode("run_query", runQueryNode)
  .addEdge(START, "list_tables")
  .addEdge("list_tables", "call_get_schema")
  .addEdge("call_get_schema", "get_schema")
  .addEdge("get_schema", "generate_query")
  .addConditionalEdges("generate_query", shouldContinue)
  .addEdge("check_query", "run_query")
  .addEdge("run_query", "generate_query");

const agent = builder.compile();
```

我们将应用程序可视化如下：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import * as fs from "node:fs/promises";

const drawableGraph = await agent.getGraphAsync();
const image = await drawableGraph.drawMermaidPng();
const imageBuffer = new Uint8Array(await image.arrayBuffer());

await fs.writeFile("graph.png", imageBuffer);
```

![SQL agent graph](https://mintcdn.com/langchain-5e9cc07a/aAi4RLdXQAh8fThS/oss/images/sql-agent-langgraph.png?fit=max\&auto=format\&n=aAi4RLdXQAh8fThS\&q=85\&s=1ddd4aae369fb8c143edaccb0a09c81f)

我们现在可以调用该图：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const question = "Which genre on average has the longest tracks?";

const stream = await agent.streamEvents(
  { messages: [{ role: "user", content: question }] },
  { version: "v3" },
);

for await (const message of stream.messages) {
  for await (const token of message.text) {
    process.stdout.write(token);
  }
}

const finalState = await stream.output;
```

```
================================ Human Message =================================

Which genre on average has the longest tracks?
================================== Ai Message ==================================

Available tables: Album, Artist, Customer, Employee, Genre, Invoice, InvoiceLine, MediaType, Playlist, PlaylistTrack, Track
================================== Ai Message ==================================
Tool Calls:
  sql_db_schema (call_yzje0tj7JK3TEzDx4QnRR3lL)
 Call ID: call_yzje0tj7JK3TEzDx4QnRR3lL
  Args:
    table_names: Genre, Track
================================= Tool Message =================================
Name: sql_db_schema


CREATE TABLE "Genre" (
	"GenreId" INTEGER NOT NULL,
	"Name" NVARCHAR(120),
	PRIMARY KEY ("GenreId")
)

/*
3 rows from Genre table:
GenreId	Name
1	Rock
2	Jazz
3	Metal
*/


CREATE TABLE "Track" (
	"TrackId" INTEGER NOT NULL,
	"Name" NVARCHAR(200) NOT NULL,
	"AlbumId" INTEGER,
	"MediaTypeId" INTEGER NOT NULL,
	"GenreId" INTEGER,
	"Composer" NVARCHAR(220),
	"Milliseconds" INTEGER NOT NULL,
	"Bytes" INTEGER,
	"UnitPrice" NUMERIC(10, 2) NOT NULL,
	PRIMARY KEY ("TrackId"),
	FOREIGN KEY("MediaTypeId") REFERENCES "MediaType" ("MediaTypeId"),
	FOREIGN KEY("GenreId") REFERENCES "Genre" ("GenreId"),
	FOREIGN KEY("AlbumId") REFERENCES "Album" ("AlbumId")
)

/*
3 rows from Track table:
TrackId	Name	AlbumId	MediaTypeId	GenreId	Composer	Milliseconds	Bytes	UnitPrice
1	For Those About To Rock (We Salute You)	1	1	1	Angus Young, Malcolm Young, Brian Johnson	343719	11170334	0.99
2	Balls to the Wall	2	2	1	U. Dirkschneider, W. Hoffmann, H. Frank, P. Baltes, S. Kaufmann, G. Hoffmann	342562	5510424	0.99
3	Fast As a Shark	3	2	1	F. Baltes, S. Kaufman, U. Dirkscneider & W. Hoffman	230619	3990994	0.99
*/
================================== Ai Message ==================================
Tool Calls:
  sql_db_query (call_cb9ApLfZLSq7CWg6jd0im90b)
 Call ID: call_cb9ApLfZLSq7CWg6jd0im90b
  Args:
    query: SELECT Genre.Name, AVG(Track.Milliseconds) AS AvgMilliseconds FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY Genre.GenreId ORDER BY AvgMilliseconds DESC LIMIT 5;
================================== Ai Message ==================================
Tool Calls:
  sql_db_query (call_DMVALfnQ4kJsuF3Yl6jxbeAU)
 Call ID: call_DMVALfnQ4kJsuF3Yl6jxbeAU
  Args:
    query: SELECT Genre.Name, AVG(Track.Milliseconds) AS AvgMilliseconds FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY Genre.GenreId ORDER BY AvgMilliseconds DESC LIMIT 5;
================================= Tool Message =================================
Name: sql_db_query

[('Sci Fi & Fantasy', 2911783.0384615385), ('Science Fiction', 2625549.076923077), ('Drama', 2575283.78125), ('TV Shows', 2145041.0215053763), ('Comedy', 1585263.705882353)]
================================== Ai Message ==================================

The genre with the longest tracks on average is "Sci Fi & Fantasy," with an average track length of approximately 2,911,783 milliseconds. Other genres with relatively long tracks include "Science Fiction," "Drama," "TV Shows," and "Comedy."
```

> [!提示]
>
> 上述运行请参见[LangSmith trace](https://smith.langchain.com/public/a6a96896-686a-4040-b9b5-28d701453d6f/r)。

## 6. 实施人机交互审核

在执行代理的 SQL 查询之前检查是否存在任何意外操作或效率低下，这可能是谨慎的做法。

在这里，我们利用 LangGraph 的 [human-in-the-loop](/oss/javascript/langgraph/interrupts) 功能在执行 SQL 查询之前暂停运行并等待人工审核。使用LangGraph的[persistence layer](/oss/javascript/langgraph/persistence)，我们可以无限期地暂停运行（或者至少只要持久层还活着）。

让我们将 `sql_db_query` 工具包装在接收人工输入的节点中。我们可以使用 [interrupt](/oss/javascript/langgraph/interrupts) 函数来实现这一点。下面，我们允许输入以批准工具调用、编辑其参数或提供用户反馈。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { RunnableConfig } from "@langchain/core/runnables";
import { interrupt } from "@langchain/langgraph";

const queryToolWithInterrupt = tool(
  async (input, config: RunnableConfig) => {
    const request = {
      action: queryTool.name,
      args: input,
      description: "Please review the tool call",
    };
    const response = interrupt([request]); // [!code highlight]
    // approve the tool call
    if (response.type === "accept") {
      const toolResponse = await queryTool.invoke(input, config);
      return toolResponse;
    }
    // update tool call args
    else if (response.type === "edit") {
      const editedInput = response.args.args;
      const toolResponse = await queryTool.invoke(editedInput, config);
      return toolResponse;
    }
    // respond to the LLM with user feedback
    else if (response.type === "response") {
      const userFeedback = response.args;
      return userFeedback;
    } else {
      throw new Error(`Unsupported interrupt response type: ${response.type}`);
    }
  },
  {
    name: queryTool.name,
    description: queryTool.description,
    schema: queryTool.schema,
  },
);
```

> [!注意]
>
> 上述实现遵循更广泛的 [human-in-the-loop](/oss/javascript/langgraph/interrupts) 指南中的 [tool interrupt example](/oss/javascript/langgraph/interrupts#interrupts-in-tools)。有关详细信息和替代方案，请参阅该指南。现在让我们重新组装我们的图表。我们将用人工审核取代程序检查。请注意，我们现在包含一个 [checkpointer](/oss/javascript/langgraph/persistence)；这是暂停和恢复运行所必需的。

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
import { Command, MemorySaver } from "@langchain/langgraph";

const shouldContinueWithHuman: ConditionalEdgeRouter<{ InputSchema: typeof MessagesState; Nodes: "run_query" }> = (state) => {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  if (!AIMessage.isInstance(lastMessage) || !lastMessage.tool_calls?.length) {
    return END;
  } else {
    return "run_query";
  }
};

const builderWithHuman = new StateGraph(MessagesState)
  .addNode("list_tables", listTables)
  .addNode("call_get_schema", callGetSchema)
  .addNode("get_schema", getSchemaNode)
  .addNode("generate_query", generateQuery)
  .addNode("run_query", runQueryNodeWithInterrupt)
  .addEdge(START, "list_tables")
  .addEdge("list_tables", "call_get_schema")
  .addEdge("call_get_schema", "get_schema")
  .addEdge("get_schema", "generate_query")
  .addConditionalEdges("generate_query", shouldContinueWithHuman)
  .addEdge("run_query", "generate_query");

const checkpointer = new MemorySaver(); // [!code highlight]
const agentWithHuman = builderWithHuman.compile({ checkpointer }); // [!code highlight]
```

我们可以像以前一样调用该图。这次，执行被中断：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const hitlQuestion = "Which genre on average has the longest tracks?";

const hitlStream = await agentWithHuman.streamEvents(
  { messages: [{ role: "user", content: hitlQuestion }] },
  { ...config, version: "v3" },
);

for await (const message of hitlStream.messages) {
  for await (const token of message.text) {
    process.stdout.write(token);
  }
}

// Check for interrupts
if (hitlStream.interrupted) {
  console.log("\nINTERRUPTED:");
  console.log(JSON.stringify(hitlStream.interrupts[0], null, 2));
}
```

```
...

INTERRUPTED:
{
  "action": "sql_db_query",
  "args": {
    "query": "SELECT Genre.Name, AVG(Track.Milliseconds) AS AvgLength FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY Genre.Name ORDER BY AvgLength DESC LIMIT 5;"
  },
  "description": "Please review the tool call"
}
```

我们可以使用[Command](/oss/javascript/langgraph/use-graph-api#combine-control-flow-and-state-updates-with-command)接受或编辑工具调用：

```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
const resumeStream = await agentWithHuman.streamEvents(
  new Command({ resume: { type: "accept" } }),
  // new Command({ resume: { type: "edit", args: { query: "..." } } }),
  { ...config, version: "v3" },
);

for await (const message of resumeStream.messages) {
  for await (const token of message.text) {
    process.stdout.write(token);
  }
}
```

```
================================== Ai Message ==================================
Tool Calls:
  sql_db_query (call_t4yXkD6shwdTPuelXEmY3sAY)
 Call ID: call_t4yXkD6shwdTPuelXEmY3sAY
  Args:
    query: SELECT Genre.Name, AVG(Track.Milliseconds) AS AvgLength FROM Track JOIN Genre ON Track.GenreId = Genre.GenreId GROUP BY Genre.Name ORDER BY AvgLength DESC LIMIT 5;
================================= Tool Message =================================
Name: sql_db_query

[('Sci Fi & Fantasy', 2911783.0384615385), ('Science Fiction', 2625549.076923077), ('Drama', 2575283.78125), ('TV Shows', 2145041.0215053763), ('Comedy', 1585263.705882353)]
================================== Ai Message ==================================

The genre with the longest average track length is "Sci Fi & Fantasy" with an average length of about 2,911,783 milliseconds. Other genres with long average track lengths include "Science Fiction," "Drama," "TV Shows," and "Comedy."
```

详情请参阅[human-in-the-loop guide](/oss/javascript/langgraph/interrupts)。

## 后续步骤

查看 [Evaluate a graph](/langsmith/evaluate-graph) 指南，以评估 LangGraph 应用程序，包括使用 LangSmith 的 SQL 代理。

***

[Connect these docs](/use-these-docs) 通过 MCP 发送给您选择的代理以获得实时解答。

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/sql-agent.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。