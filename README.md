# LangGraph Docs Mirror

Unofficial mirror of **LangGraph** guides and API reference — **EN + 简体中文**.

- Live: https://xiaoqianran.github.io/langgraph-docs/
- Chinese: https://xiaoqianran.github.io/langgraph-docs/zh/
- Official: https://docs.langchain.com/langgraph

Chinese pages are **machine-translated** (hash-cached under `docs/zh/`) from the English source.

## Local

```bash
npm install --no-save marked@15
npm run fetch
npm run translate          # zh-CN cache (optional; hash-skip)
PAGES_BASE=/langgraph-docs npm run build
node scripts/serve-pages.mjs
```

## GitHub Actions

Daily fetch → zh-CN translate → build dual-locale site → GitHub Pages.
