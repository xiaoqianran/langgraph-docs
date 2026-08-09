#!/usr/bin/env node
// LangGraph docs static site (EN; official English only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGES = path.join(ROOT, "docs", "pages");
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.PAGES_BASE || "").replace(/\/$/, "");
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", "ui.json"), "utf8")).en;

const CHEV_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function asset(p) {
  const rel = String(p).replace(/^\//, "");
  return BASE ? `${BASE}/${rel}` : `/${rel}`;
}
function htmlEscape(s) {
  return String(s)
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}
function isHtmlDoc(text) {
  const t = String(text).trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}
function titleFromMd(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[`*]/g, "").trim() : fallback;
}
function humanize(slug) {
  return slug.replace(/\.md$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function relToHtml(rel) {
  return rel.replace(/\.md$/, ".html");
}

function loadPages() {
  const files = walk(PAGES);
  const pages = [];
  for (const abs of files) {
    const rel = path.relative(PAGES, abs).replace(/\\/g, "/");
    let md = fs.readFileSync(abs, "utf8");
    if (isHtmlDoc(md)) continue;
    md = md.replace(/^<!-- langgraph-docs:[\s\S]*?-->\n*/m, "");
    pages.push({ abs, rel, md, title: titleFromMd(md, humanize(path.basename(rel, ".md"))) });
  }
  return pages;
}

function buildNav(pages) {
  let meta = null;
  const metaPath = path.join(ROOT, "docs", "meta-tree.json");
  if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  const tracks = [
    {
      id: "home",
      name: "Home",
      badge: "·",
      groups: [{ name: "Home", items: [{ title: "Home", href: asset("index.html"), rel: "index.md" }] }],
      count: 1,
    },
  ];

  if (meta) {
    const ordered = Object.values(meta).sort((a, b) => {
      const ca = Object.values(a.groups).reduce((n, g) => n + g.length, 0);
      const cb = Object.values(b.groups).reduce((n, g) => n + g.length, 0);
      return cb - ca;
    });
    for (const t of ordered) {
      const groups = [];
      for (const [gname, items] of Object.entries(t.groups)) {
        const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
        groups.push({
          name: humanize(gname),
          items: sorted.map((it) => ({
            title: it.title,
            href: asset(relToHtml(it.rel)),
            rel: it.rel,
          })),
        });
      }
      // merge tiny groups if too many
      let finalGroups = groups;
      if (groups.length > 20) {
        const flat = groups.flatMap((g) => g.items);
        finalGroups = [{ name: t.name, items: flat.sort((a, b) => a.title.localeCompare(b.title)) }];
      }
      const count = finalGroups.reduce((n, g) => n + g.items.length, 0);
      if (!count) continue;
      tracks.push({ id: t.id, name: t.name, badge: "▸", groups: finalGroups, count });
    }
  } else {
    // fallback flat
    const items = pages
      .filter((p) => p.rel !== "index.md")
      .map((p) => ({ title: p.title, href: asset(relToHtml(p.rel)), rel: p.rel }));
    tracks.push({ id: "all", name: "All docs", badge: "▸", groups: [{ name: "Pages", items }], count: items.length });
  }
  return tracks;
}

function renderNavHtml(tracks, activeRel) {
  const parts = [];
  let activeTop = "home";
  for (const t of tracks) {
    if (t.groups.some((g) => g.items.some((it) => it.rel === activeRel))) {
      activeTop = t.id;
      break;
    }
  }
  for (const track of tracks) {
    const trackActive = track.id === activeTop;
    const open = trackActive || track.id === "home" ? "1" : "0";
    parts.push(
      `<div class="track" data-track="${htmlEscape(track.id)}" data-open="${open}" data-active="${trackActive ? "1" : "0"}" data-hydrated="0">`,
    );
    parts.push(
      `<button type="button" class="track-btn" data-track-toggle="${htmlEscape(track.id)}" aria-expanded="${open === "1"}" data-needs-items="1"><span class="chev">${CHEV_SVG}</span><span class="track-label">${htmlEscape(track.name)}</span><span class="track-count">${track.count}</span></button>`,
    );
    parts.push(
      `<div class="track-panel"><div class="track-panel-inner"><div class="track-body"><div class="muted" style="padding:0.45rem 0.5rem;font-size:0.78rem">Loading…</div></div></div></div></div>`,
    );
  }
  return parts.join("\n");
}

function enhanceCode(html) {
  return html
    .replace(
      /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
      (_, lang, code) =>
        `<div class="code-block"><div class="code-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lang">${htmlEscape(lang || "text")}</span><button type="button" class="copy-btn" data-copy>Copy</button></div><pre><code class="language-${htmlEscape(lang)}">${code}</code></pre></div>`,
    )
    .replace(
      /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
      (_, code) =>
        `<div class="code-block"><div class="code-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lang">text</span><button type="button" class="copy-btn" data-copy>Copy</button></div><pre><code>${code}</code></pre></div>`,
    );
}

function tocFromHtml(html) {
  const items = [];
  const re = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]+>/g, "").trim();
    if (text) items.push({ level: Number(m[1]), id: m[2], text });
  }
  if (items.length < 2) return "";
  return `<nav class="toc"><div class="toc-title">On this page</div><ul>${items
    .map((it) => `<li class="l${it.level}"><a href="#${htmlEscape(it.id)}">${htmlEscape(it.text)}</a></li>`)
    .join("")}</ul></nav>`;
}

function postProcessHtml(html, fromRel) {
  return html.replace(/href="([^"]+)"/g, (full, href) => {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) return full;
    if (/^https?:\/\/docs\.langchain\.com\//i.test(href)) {
      let p = href.replace(/^https?:\/\/docs\.langchain\.com\//i, "").replace(/\.md$/i, "");
      p = p.split("#")[0].replace(/\/+$/, "");
      const hash = href.includes("#") ? "#" + href.split("#").slice(1).join("#") : "";
      if (!p) return `href="${asset("index.html")}${hash}"`;
      return `href="${asset(p + ".html")}${hash}"`;
    }
    if (/^https?:\/\//i.test(href)) return full;
    // relative .md
    if (href.endsWith(".md") || href.includes(".md#")) {
      let target = href;
      let hash = "";
      const hi = target.indexOf("#");
      if (hi >= 0) {
        hash = target.slice(hi);
        target = target.slice(0, hi);
      }
      target = target.replace(/\.md$/i, ".md");
      const dir = path.posix.dirname(fromRel.replace(/\\/g, "/"));
      let rel = target.replace(/^\.\//, "");
      if (!rel.startsWith("/")) {
        rel = path.posix.normalize(path.posix.join(dir === "." ? "" : dir, rel));
      }
      rel = rel.replace(/^\/+/, "");
      if (rel.endsWith(".md")) rel = rel.slice(0, -3) + ".html";
      return `href="${asset(rel)}${hash}"`;
    }
    // root-relative docs paths like /oss/python/...
    if (href.startsWith("/oss/") || href.startsWith("/langsmith/") || href.startsWith("/api-reference/") || href.startsWith("/reference/")) {
      let p = href.replace(/^\//, "").replace(/\.md$/i, "").replace(/\/+$/, "");
      const hash = "";
      return `href="${asset(p + ".html")}"`;
    }
    return full;
  });
}

function layout({ title, bodyHtml, navHtml, tocHtml, rel }) {
  return `<!DOCTYPE html>
<html lang="en" data-locale="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#08090c" />
  <title>${htmlEscape(title)} · ${htmlEscape(UI.brand)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" />
  <link rel="stylesheet" href="${asset("assets/site.css")}" />
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
  <header class="topbar">
    <div class="topbar-inner">
      <button type="button" class="menu-btn" id="menuBtn" aria-label="${htmlEscape(UI.menu)}">${htmlEscape(UI.menu)}</button>
      <a class="brand" href="${asset("index.html")}">
        <span class="brand-mark">LG</span>
        <span class="brand-text">${htmlEscape(UI.brand)}</span>
        <span class="brand-v">${htmlEscape(UI.brandSub)}</span>
      </a>
      <nav class="chips" id="trackChips" aria-label="Tracks"></nav>
      <a class="top-link" href="https://docs.langchain.com/oss/python/langgraph/overview" rel="noopener" target="_blank">${htmlEscape(UI.official)}</a>
    </div>
  </header>
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-head">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>
          <input class="search" id="search" type="search" placeholder="${htmlEscape(UI.searchPlaceholder)}" autocomplete="off" />
          <span class="search-kbd" aria-hidden="true">/</span>
        </div>
        <div class="side-label">${htmlEscape(UI.learningPath)}</div>
      </div>
      <nav class="nav" id="nav" data-active-rel="${htmlEscape(rel)}">${navHtml}</nav>
      <div class="side-foot">${htmlEscape(UI.footer)}</div>
    </aside>
    <button type="button" class="backdrop" id="backdrop" aria-label="Close menu"></button>
    <main class="main" id="main">
      <div class="content-wrap">
        <article class="content prose">
          ${bodyHtml}
          <p class="page-foot">${htmlEscape(UI.footer)}</p>
        </article>
        ${tocHtml}
      </div>
    </main>
  </div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script src="${asset("assets/site.js")}"></script>
  <script>document.querySelectorAll("pre code").forEach((el)=>window.hljs&&hljs.highlightElement(el));</script>
  <button type="button" class="to-top" id="toTop" aria-label="Back to top">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg>
  </button>

  <div class="kbd-help" id="kbdHelp" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
  <div class="kbd-panel">
    <h3>Keyboard shortcuts</h3>
    <div class="kbd-row"><span>Focus search</span><kbd>/ · ⌘K</kbd></div>
    <div class="kbd-row"><span>Close / clear</span><kbd>Esc</kbd></div>
    <div class="kbd-row"><span>This help</span><kbd>?</kbd></div>
    <div style="margin-top:0.9rem;text-align:right">
      <button type="button" class="btn ghost" id="kbdHelpClose" style="margin:0;min-height:2.1rem;padding:0.4rem 0.85rem">Close</button>
    </div>
  </div>
</div>
</body>
</html>`;
}

function copyAssets() {
  const out = path.join(DIST, "assets");
  ensureDir(out);
  for (const f of ["site.css", "site.js"]) {
    fs.copyFileSync(path.join(__dirname, "site-assets", f), path.join(out, f));
  }
  ensureDir(path.join(DIST, "meta"));
  for (const f of ["llms.txt", "list.json", "meta-tree.json"]) {
    const src = path.join(ROOT, "docs", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, "meta", f));
  }
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
  copyAssets();

  const pages = loadPages();
  if (!pages.length) {
    console.error("No pages");
    process.exit(1);
  }
  const nav = buildNav(pages);
  fs.writeFileSync(path.join(DIST, "assets", "nav.json"), JSON.stringify(nav, null, 2));

  marked.setOptions({ gfm: true, breaks: false });
  let n = 0;
  for (const page of pages) {
    let body = marked.parse(page.md);
    body = enhanceCode(body);
    body = postProcessHtml(body, page.rel);
    const toc = tocFromHtml(body);
    const html = layout({
      title: page.title,
      bodyHtml: body,
      navHtml: renderNavHtml(nav, page.rel),
      tocHtml: toc,
      rel: page.rel,
    });
    const outFile = path.join(DIST, relToHtml(page.rel));
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, html);
    n++;
  }
  console.log(`Built ${n} pages, ${nav.length} tracks → ${DIST} (BASE=${BASE || "/"})`);
}

main();
