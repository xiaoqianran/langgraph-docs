<!-- langgraph-docs: Deployment | https://docs.langchain.com/oss/javascript/langgraph/deploy -->

# Deployment

Deploy LangGraph agents to production with LangSmith Cloud or JavaScript frameworks and hosting platforms.

When you are ready to deploy your LangGraph agent to production, choose a hosting model that fits your stack. **[LangSmith Cloud](/langsmith/deploy-to-cloud)** provides fully managed infrastructure for stateful, long-running agents with persistent state and background execution.

You can also deploy on **JavaScript frameworks and platforms** such as Next.js, SvelteKit, Nuxt, Cloudflare Workers, and Deno Deploy using the same [Agent Streaming Protocol](https://github.com/langchain-ai/agent-protocol/tree/main/streaming).

Frameworks and platforms

[View all guides](/langsmith/deploy-frameworks-and-platforms)

![](https://mintcdn.com/langchain-5e9cc07a/ZPKed1feKJ8F6LVo/images/providers/light/langchain.svg?fit=max\&auto=format\&n=ZPKed1feKJ8F6LVo\&q=85\&s=b910ed9cd0b6b8adb4b6da400882e92c)

LangSmith

[Open](/langsmith/deploy-vite-langsmith)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/nextjs.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=4f3336e9534db50f25f87173a41322d5)

Next.js

[Open](/langsmith/deploy-nextjs)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/svelte.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=07e7e35c40e4522f739feea9ef3e33b7)

SvelteKit

[Open](/langsmith/deploy-sveltekit)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/nuxt.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=5d965ed1f93f51ac604e66b935a65368)

Nuxt

[Open](/langsmith/deploy-nuxt)

![](https://mintcdn.com/langchain-5e9cc07a/h9vvRKKSgCSjvd_Y/images/providers/light/cloudflare.svg?fit=max\&auto=format\&n=h9vvRKKSgCSjvd_Y\&q=85\&s=ae129fcbfc78ccaece42b1c4d3699311)

Cloudflare

[Open](/langsmith/deploy-cloudflare-workers)

![](https://mintcdn.com/langchain-5e9cc07a/Tz8fh3A43FeUPf69/images/providers/light/deno.svg?fit=max\&auto=format\&n=Tz8fh3A43FeUPf69\&q=85\&s=8d213b0000104542fcaa7ab160595224)

Deno

[Open](/langsmith/deploy-deno)

> [!TIP]
>
> LangSmith offers multiple deployment options beyond Cloud, including [hybrid](/langsmith/hybrid), [standalone servers](/langsmith/deploy-standalone-server), and [self-hosted with control plane](/langsmith/deploy-with-control-plane). For more information, see the [LangSmith Deployment overview](/langsmith/deployment).

## LangSmith Cloud

This section walks through deploying your agent to LangSmith Cloud from a GitHub repository. LangSmith handles infrastructure, scaling, and operational concerns.

### Prerequisites

Before you begin, ensure you have the following:

* A [GitHub account](https://github.com/)
* A [LangSmith account](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy) (free to sign up)

### Deploy your agent

#### 1. Create a repository on GitHub

Your application's code must reside in a GitHub repository to be deployed on LangSmith. Both public and private repositories are supported. For this quickstart, first make sure your app is LangGraph-compatible by following the [local server setup guide](/oss/javascript/langgraph/studio#set-up-local-agent-server). Then, push your code to the repository.

#### 2. Deploy to LangSmith

**1. Navigate to LangSmith Deployment**

Log in to [LangSmith](https://smith.langchain.com?utm_source=docs\&utm_medium=cta\&utm_campaign=langsmith-signup\&utm_content=oss-langgraph-deploy). In the left sidebar, select **Deployments**.

**2. Create new deployment**

Click the **+ New Deployment** button. A pane will open where you can fill in the required fields.

**3. Link repository**

If you are a first time user or adding a private repository that has not been previously connected, click the **Add new account** button and follow the instructions to connect your GitHub account.

**4. Deploy repository**

Select your application's repository. Click **Submit** to deploy. This may take about 15 minutes to complete. You can check the status in the **Deployment details** view.

#### 3. Test your application in Studio

Once your application is deployed:

1. Select the deployment you just created to view more details.
2. Click the **Studio** button in the top right corner. Studio will open to display your graph.

#### 4. Get the API URL for your deployment

1. In the **Deployment details** view in LangGraph, click the **API URL** to copy it to your clipboard.
2. Click the `URL` to copy it to the clipboard.

#### 5. Test the API

You can now test the API:

> [tab] TypeScript
>
> 1. Install LangGraph SDK:
>
> ```shell theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> npm install @langchain/langgraph-sdk
> ```
>
> 2. Send a message to the agent:
>
> ```ts theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> import { Client } from "@langchain/langgraph-sdk";
>
> const client = new Client({ apiUrl: "your-deployment-url", apiKey: "your-langsmith-api-key" });
>
> const streamResponse = client.runs.stream(
>   null,    // Threadless run
>   "agent", // Name of agent. Defined in langgraph.json.
>   {
>     input: {
>       "messages": [
>         { "role": "user", "content": "What is LangGraph?"}
>       ]
>     },
>     streamMode: "messages",
>   }
> );
>
> for await (const chunk of streamResponse) {
>   console.log(`Receiving new event of type: ${chunk.event}...`);
>   console.log(JSON.stringify(chunk.data));
>   console.log("\n\n");
> }
> ```

> [tab] Rest API
>
> ```bash theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
> curl -s --request POST \
>     --url <DEPLOYMENT_URL>/runs/stream \
>     --header 'Content-Type: application/json' \
>     --header "X-Api-Key: <LANGSMITH API KEY> \
>     --data "{
>         \"assistant_id\": \"agent\", `# Name of agent. Defined in langgraph.json.`
>         \"input\": {
>             \"messages\": [
>                 {
>                     \"role\": \"human\",
>                     \"content\": \"What is LangGraph?\"
>                 }
>             ]
>         },
>         \"stream_mode\": \"updates\"
>     }"
> ```

***

[Connect these docs](/use-these-docs) to your agent of choice via MCP for real-time answers.

[Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/deploy.mdx) or [file an issue](https://github.com/langchain-ai/docs/issues/new/choose).