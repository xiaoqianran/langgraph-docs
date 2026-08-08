# LangGraph Docs Mirror

Unofficial mirror of **LangGraph** documentation.

## Sources

- [docs.langchain.com](https://docs.langchain.com) via `llms-full.txt` (filtered for LangGraph)
- Extra guides (common-errors, human-in-the-loop, …)
- [reference.langchain.com](https://reference.langchain.com) LangGraph packages

## Sections

- Python guides
- JavaScript guides
- Migration / Releases
- API Reference (Python + JS)
- LangSmith platform (CLI, SDKs, tracing)

## Local

```bash
npm install --no-save marked@15
npm run fetch
PAGES_BASE=/langgraph-docs npm run build
node scripts/serve-pages.mjs
```
