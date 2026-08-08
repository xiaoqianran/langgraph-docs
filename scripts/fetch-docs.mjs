#!/usr/bin/env node
/**
 * Fetch LangGraph docs:
 *  1) docs.langchain.com/llms-full.txt → pages with "langgraph" in URL
 *  2) Extra known paths (common-errors, human-in-the-loop, …)
 *  3) reference.langchain.com packages (langgraph*, checkpoint, sdk, cli, …)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const PAGES = path.join(DOCS, "pages");
const TIMEOUT_MS = Math.max(30000, Number(process.env.FETCH_TIMEOUT_MS || 180000));
const UA =
  process.env.FETCH_UA ||
  "langgraph-docs-mirror/1.0 (+https://github.com/xiaoqianran/langgraph-docs)";
const CONCURRENCY = Math.max(1, Number(process.env.FETCH_CONCURRENCY || 6));

const LLMS_FULL = process.env.LC_LLMS_FULL || "https://docs.langchain.com/llms-full.txt";
const REF_LLMS = process.env.REF_LLMS || "https://reference.langchain.com/llms.txt";

const EXTRA_PATHS = [
  "oss/python/langgraph/common-errors",
  "oss/javascript/langgraph/common-errors",
  "oss/python/langgraph/human-in-the-loop",
  "oss/javascript/langgraph/human-in-the-loop",
  "oss/python/langgraph/use-time-travel",
  "oss/javascript/langgraph/use-time-travel",
  "langsmith/cli",
  "langsmith/agent-server",
  "langsmith/agent-server-overview",
  "langsmith/local-server",
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function sanitize(text) {
  let t = String(text);
  t = t.replace(/\bghp_[A-Za-z0-9]{20,}\b/g, "ghp_REDACTED");
  t = t.replace(/\bsk-[A-Za-z0-9]{20,}\b/g, "sk-REDACTED");
  t = t.replace(/\bls[vp]_[A-Za-z0-9]{10,}\b/g, "ls_REDACTED");
  return t;
}
function isHtml(text) {
  const t = String(text).trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}

async function fetchText(url, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
      },
      redirect: "follow",
    });
    if (res.status === 429 || res.status === 503) {
      if (attempt < 5) {
        const backoff = Math.min(30000, 1500 * 2 ** attempt);
        await sleep(backoff);
        return fetchText(url, attempt + 1);
      }
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return new TextDecoder("utf-8").decode(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

function urlToRel(url) {
  let u = String(url).trim();
  // reference.langchain.com → reference/...
  if (/reference\.langchain\.com/i.test(u)) {
    u = u.replace(/^https?:\/\/reference\.langchain\.com\/?/i, "reference/");
  } else {
    u = u.replace(/^https?:\/\/docs\.langchain\.com\/?/i, "");
  }
  u = u.replace(/\.md$/i, "");
  u = u.replace(/\/+$/, "");
  if (!u) return "index.md";
  return u + ".md";
}

function isLangGraphUrl(url) {
  const u = String(url).toLowerCase();
  return (
    u.includes("langgraph") ||
    u.includes("langgraphjs") ||
    /\/pregel\b/.test(u) ||
    u.includes("langgraph-cli") ||
    u.includes("langgraph-sdk") ||
    u.includes("langgraph-supervisor") ||
    u.includes("langgraph-swarm") ||
    u.includes("langgraph.checkpoint") ||
    u.includes("langgraph.store") ||
    u.includes("langgraph.prebuilt")
  );
}

function trackForRel(rel) {
  const r = rel.replace(/\.md$/, "");
  if (r.startsWith("oss/python/langgraph") || r.includes("oss/python/langgraph"))
    return { id: "python", name: "Python · Guides" };
  if (r.startsWith("oss/javascript/langgraph") || r.includes("oss/javascript/langgraph"))
    return { id: "javascript", name: "JavaScript · Guides" };
  if (r.startsWith("oss/python/migrate") || r.startsWith("oss/javascript/migrate"))
    return { id: "migrate", name: "Migration" };
  if (r.startsWith("oss/python/releases") || r.startsWith("oss/javascript/releases") || r.includes("changelog"))
    return { id: "releases", name: "Releases" };
  if (r.startsWith("oss/python/reference") || r.startsWith("oss/javascript/reference"))
    return { id: "docs-reference", name: "Docs · Reference" };
  if (r.startsWith("reference/python"))
    return { id: "api-python", name: "API · Python" };
  if (r.startsWith("reference/javascript"))
    return { id: "api-js", name: "API · JavaScript" };
  if (r.startsWith("langsmith"))
    return { id: "platform", name: "Platform · LangSmith" };
  return { id: "other", name: "Other" };
}

function groupForRel(rel) {
  const segs = rel.replace(/\.md$/, "").split("/");
  // e.g. oss/python/langgraph/frontend/overview → frontend
  if (segs.includes("langgraph")) {
    const i = segs.indexOf("langgraph");
    return segs[i + 1] || "guides";
  }
  if (segs[0] === "reference") return segs[1] || "api";
  if (segs[0] === "langsmith") return "langsmith";
  return segs[segs.length - 2] || "pages";
}

function stripBoilerplate(body) {
  return body.replace(
    /^>\s*##\s*Documentation Index[\s\S]*?further\.\s*/i,
    "",
  );
}

function splitFull(text) {
  const parts = text.split(/(?=^# .+\nSource: https?:\/\/)/m);
  const pages = [];
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^# (.+)\nSource: (https?:\/\/\S+)\n+([\s\S]*)$/);
    if (!m) continue;
    const title = m[1].trim();
    const url = m[2].trim().replace(/[)#\s]+$/, "");
    if (!isLangGraphUrl(url) && !isLangGraphUrl(title)) continue;
    let body = stripBoilerplate(m[3].trim());
    if (!body.startsWith("#")) body = `# ${title}\n\n` + body;
    pages.push({ title, url, body, rel: urlToRel(url), source: "llms-full" });
  }
  return pages;
}

function parseRefLlms(text) {
  const links = [];
  const re = /\[([^\]]+)\]\((https?:\/\/reference\.langchain\.com\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const title = m[1].trim();
    const url = m[2].trim();
    if (!isLangGraphUrl(url) && !isLangGraphUrl(title)) continue;
    if (url.includes("img.shields.io") || url.includes("github.com")) continue;
    links.push({ title, url });
  }
  return links;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

async function main() {
  ensureDir(DOCS);
  fs.rmSync(PAGES, { recursive: true, force: true });
  ensureDir(PAGES);

  console.log("Downloading llms-full.txt …");
  const full = await fetchText(LLMS_FULL);
  if (isHtml(full)) throw new Error("llms-full returned HTML");
  // do not keep full dump on disk long-term
  fs.writeFileSync(path.join(DOCS, "llms-full.txt"), full);
  const fromFull = splitFull(full);
  console.log(`llms-full langgraph pages: ${fromFull.length}`);

  const byRel = new Map();
  for (const p of fromFull) {
    const prev = byRel.get(p.rel);
    if (!prev || p.body.length > prev.body.length) byRel.set(p.rel, p);
  }

  // Extra guide paths
  console.log("Fetching extra guide paths …");
  await mapPool(EXTRA_PATHS, CONCURRENCY, async (p) => {
    const url = `https://docs.langchain.com/${p}.md`;
    try {
      let body = await fetchText(url);
      if (isHtml(body) || body.trim().length < 40) return;
      body = stripBoilerplate(body.trim());
      const titleMatch = body.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(p);
      if (!body.startsWith("#")) body = `# ${title}\n\n` + body;
      const rel = p + ".md";
      const prev = byRel.get(rel);
      if (!prev || body.length > prev.body.length) {
        byRel.set(rel, { title, url: `https://docs.langchain.com/${p}`, body, rel, source: "extra" });
      }
    } catch (e) {
      // skip missing
    }
  });

  // API reference packages
  console.log("Downloading reference llms.txt …");
  let refLinks = [];
  try {
    const refTxt = await fetchText(REF_LLMS);
    fs.writeFileSync(path.join(DOCS, "reference-llms.txt"), refTxt);
    refLinks = parseRefLlms(refTxt);
    console.log(`reference langgraph packages: ${refLinks.length}`);
  } catch (e) {
    console.warn("reference llms skip", e.message);
  }

  await mapPool(refLinks, CONCURRENCY, async (link) => {
    try {
      let body = await fetchText(link.url.endsWith(".md") ? link.url : link.url + ".md");
      // also try without .md
      if (isHtml(body) || body.trim().length < 40) {
        body = await fetchText(link.url.replace(/\.md$/, ""));
      }
      if (isHtml(body) || body.trim().length < 40) return;
      body = body.trim();
      const titleMatch = body.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1].trim() : link.title;
      if (!body.startsWith("#")) body = `# ${title}\n\n` + body;
      const rel = urlToRel(link.url);
      const prev = byRel.get(rel);
      if (!prev || body.length > prev.body.length) {
        byRel.set(rel, { title, url: link.url, body, rel, source: "reference" });
      }
    } catch {
      /* skip */
    }
  });

  // Write pages
  let ok = 0;
  const written = [];
  for (const p of byRel.values()) {
    if (p.body.trim().length < 20) continue;
    const out = path.join(PAGES, p.rel);
    ensureDir(path.dirname(out));
    const header = `<!-- langgraph-docs: ${p.title} | ${p.url} -->\n\n`;
    fs.writeFileSync(out, sanitize(header + p.body));
    const track = trackForRel(p.rel);
    written.push({
      rel: p.rel,
      title: p.title,
      url: p.url,
      track: track.id,
      trackName: track.name,
      group: groupForRel(p.rel),
      source: p.source,
      bytes: Buffer.byteLength(p.body),
    });
    ok++;
  }

  // index
  const byTrack = new Map();
  for (const w of written) {
    if (!byTrack.has(w.track)) byTrack.set(w.track, { name: w.trackName, n: 0 });
    byTrack.get(w.track).n++;
  }
  const indexMd = [
    `# LangGraph documentation mirror`,
    ``,
    `Unofficial mirror of **LangGraph** docs from [docs.langchain.com](https://docs.langchain.com) + [reference.langchain.com](https://reference.langchain.com).`,
    ``,
    `- Pages: ${ok}`,
    `- Sources: llms-full (filtered) + extra guides + API reference packages`,
    ``,
    `## Sections`,
    ``,
    ...[...byTrack.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([id, v]) => `- **${v.name}** (\`${id}\`): ${v.n} pages`),
    ``,
    `## Official`,
    ``,
    `- [LangGraph overview (Python)](https://docs.langchain.com/oss/python/langgraph/overview)`,
    `- [LangGraph overview (JS)](https://docs.langchain.com/oss/javascript/langgraph/overview)`,
    `- [API reference](https://reference.langchain.com/python/langgraph)`,
    ``,
  ].join("\n");
  fs.writeFileSync(path.join(PAGES, "index.md"), indexMd);

  const list = {
    fetchedAt: new Date().toISOString(),
    method: "langgraph-filter+reference",
    ok,
    failed: 0,
    tracks: Object.fromEntries(
      [...byTrack.entries()].map(([id, v]) => [id, { name: v.name, count: v.n }]),
    ),
    pages: written,
  };
  fs.writeFileSync(path.join(DOCS, "list.json"), JSON.stringify(list, null, 2));
  fs.writeFileSync(
    path.join(DOCS, "llms.txt"),
    [
      "# LangGraph Docs",
      "",
      `Mirror of LangGraph documentation (${ok} pages).`,
      "",
      ...written.map((w) => `- [${w.title}](https://docs.langchain.com/${w.rel.replace(/\.md$/, "")})`),
      "",
    ].join("\n"),
  );

  // meta tree
  const tree = {};
  for (const w of written) {
    if (!tree[w.track]) tree[w.track] = { id: w.track, name: w.trackName, groups: {} };
    if (!tree[w.track].groups[w.group]) tree[w.track].groups[w.group] = [];
    tree[w.track].groups[w.group].push({ title: w.title, rel: w.rel });
  }
  fs.writeFileSync(path.join(DOCS, "meta-tree.json"), JSON.stringify(tree, null, 2));

  // drop large full dump after processing to keep repo lean
  try {
    fs.unlinkSync(path.join(DOCS, "llms-full.txt"));
  } catch {}

  console.log(`Done: wrote ${ok} pages`);
  console.log("tracks", list.tracks);
  if (ok < 40) {
    console.error("Too few pages");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
