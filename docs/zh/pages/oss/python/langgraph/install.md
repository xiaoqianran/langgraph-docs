<!-- langgraph-docs: machine-translated zh-CN from English source -->

<!-- langgraph-docs: Install LangGraph | https://docs.langchain.com/oss/python/langgraph/install -->

# 安装LangGraph

要安装基本 LangGraph 包：

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langgraph
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langgraph
  ```
</CodeGroup>

要使用LangGraph，您通常需要访问法学硕士并定义工具。
您可以按照您认为合适的方式执行此操作。

实现此目的的一种方法（我们将在文档中使用）是使用 [LangChain](/oss/python/langchain/overview)。

安装LangChain：

<CodeGroup>
  ```bash pip theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  pip install -U langchain
  # Requires Python 3.10+
  ```

  ```bash uv theme={"theme":{"light":"catppuccin-latte","dark":"catppuccin-mocha"}}
  uv add langchain
  # Requires Python 3.10+
  ```
</CodeGroup>

要使用特定的 LLM 提供程序包，您需要单独安装它们。

请参阅 [integrations](/oss/python/integrations/providers/overview) 页面以获取特定于提供商的安装说明。

***

<div>
  <Callout icon="terminal-2">
    通过 MCP 向 Claude、VSCode 等发送[Connect these docs](/use-these-docs) 以获得实时答案。
  </Callout>

  <Callout icon="edit">
    [Edit this page on GitHub](https://github.com/langchain-ai/docs/edit/main/src/oss/langgraph/install.mdx) 或 [file an issue](https://github.com/langchain-ai/docs/issues/new/choose)。
  </Callout>
</div>