#!/usr/bin/env node
// LangGraph docs static site (EN) — modal-docs page form
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { createParadigm } from "./paradigm-page.mjs";
import { writeLlmsArtifacts } from "./generate-llms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGES = path.join(ROOT, "docs", "pages");
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.PAGES_BASE || "").replace(/\/$/, "");
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", "ui.json"), "utf8")).en;

const CHEV_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

const OFFICIAL = "https://docs.langchain.com/langgraph";
const BRAND_MARK = "LG";
const PREFERRED = ["python","javascript"];
const SYNC_NOTE = "synced daily from LangGraph docs";

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

const P = createParadigm({ htmlEscape, asset, CHEV_SVG, relToHtml });

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


function renderNavHtml(tracks, activeRel) {
  return P.renderNavHtmlFull(tracks, activeRel, PREFERRED);
}
function renderChipsHtml(tracks, activeRel) {
  return P.renderChipsHtmlFull(tracks, activeRel, 12);
}

function layout({ title, bodyHtml, navHtml, chipsHtml, tocHtml, rel, ui, crumbHtml, pagerHtml }) {
  const desc = htmlEscape(ui.homeLead || title || "");
  return `<!DOCTYPE html>
<html lang="en" data-locale="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${desc}" />
  <meta name="color-scheme" content="dark" />
  <meta name="theme-color" content="#08090c" />
  <title>${htmlEscape(title)} · ${htmlEscape(ui.brand || "Docs")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;600;700&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/github-dark.min.css" />
  <link rel="stylesheet" href="${asset("assets/site.css")}" />
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
  <header class="topbar">
    <div class="topbar-inner">
      <button type="button" class="menu-btn" id="menuBtn" aria-label="${htmlEscape(ui.menu || "Menu")}">${htmlEscape(ui.menu || "Menu")}</button>
      <a class="brand" href="${asset("index.html")}">
        <span class="brand-mark">${BRAND_MARK}</span>
        <span class="brand-text">${htmlEscape(ui.brand || "Docs")}</span>
        <span class="brand-v">${htmlEscape(ui.brandSub || "mirror")}</span>
      </a>
      <nav class="chips" id="trackChips" aria-label="Tracks">${chipsHtml || ""}</nav>
      <a class="top-link" href="${OFFICIAL}" rel="noopener" target="_blank">${htmlEscape(ui.official || "Official ↗")}</a>
    </div>
  </header>
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-head">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input class="search" id="search" type="search" placeholder="${htmlEscape(ui.searchPlaceholder || "Search…")}" autocomplete="off" />
          <span class="search-kbd" aria-hidden="true">/</span>
        </div>
        <p class="side-label">${htmlEscape(ui.learningPath || "Browse docs")}</p>
      </div>
      <nav class="nav" id="nav" data-active-rel="${htmlEscape(rel || "")}" aria-label="Docs">${navHtml}</nav>
      <div class="side-foot">${htmlEscape(ui.footer || "")}</div>
    </aside>
    <button type="button" class="backdrop" id="backdrop" aria-label="Close menu"></button>
    <div class="main" id="main">
      <div class="crumb">${crumbHtml || ""}</div>
      <div class="content-wrap">
        <article class="content prose">${bodyHtml}</article>
        ${tocHtml || ""}
      </div>
      ${pagerHtml || ""}
      <footer class="page-foot">${htmlEscape(ui.footer || "")}</footer>
    </div>
  </div>
  ${P.kbdHelpHtml()}
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
  <script src="${asset("assets/site.js")}"></script>
</body>
</html>`;
}

function copyAssets() {
  const out = path.join(DIST, "assets");
  ensureDir(out);
  for (const f of ["site.css", "site.js"]) {
    fs.copyFileSync(path.join(__dirname, "site-assets", f), path.join(out, f));
  }
  fs.copyFileSync(path.join(__dirname, "i18n", "ui.json"), path.join(out, "ui.json"));
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

  const ui = P.enrichUi(
    {
      ...UI,
      homeH1: "Build agents with LangGraph",
      homeLead: "A polished mirror of LangGraph guides and API reference — multi-path navigation in the modal-docs chrome.",
    },
    "en",
    SYNC_NOTE,
  );

  const flat = P.flattenNav(nav);
  const homeHref = asset("index.html");
  marked.setOptions({ gfm: true, breaks: false });
  let n = 0;
  for (const page of pages) {
    const isHome = page.rel === "index.md";
    const title = isHome ? "Home" : page.title;
    const navHtml = renderNavHtml(nav, page.rel);
    const chipsHtml = renderChipsHtml(nav, page.rel);
    let body;
    let toc = "";
    if (isHome) {
      body = P.renderHomeBody(nav, ui, {
        pageCount: pages.length,
        localeCount: 1,
        officialUrl: OFFICIAL,
        syncNote: SYNC_NOTE,
        llmsHref: asset("llms.txt"),
        llmsFullHref: asset("llms-full.txt"),
      });
    } else {
      body = marked.parse(page.md);
      body = P.addHeadingIds(body);
      body = enhanceCode(body);
      body = postProcessHtml(body, page.rel);
      toc = tocFromHtml(body);
    }
    const meta = P.findActiveMeta(nav, page.rel);
    meta.title = title;
    const crumbHtml = P.renderCrumb(ui, meta, isHome, homeHref);
    const pagerHtml = isHome ? "" : P.renderPager(flat, page.rel, ui);
    const html = layout({
      title,
      bodyHtml: body,
      navHtml,
      chipsHtml,
      tocHtml: toc,
      rel: page.rel,
      ui,
      crumbHtml,
      pagerHtml,
    });
    const outFile = path.join(DIST, relToHtml(page.rel));
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, html);
    n++;
  }

  // --- llmstxt.org artifacts (llms.txt + llms-full.txt) ---
  try {
    const llmsPages = (typeof enPages !== "undefined" ? enPages : typeof pages !== "undefined" ? pages : [])
      .filter((p) => p && p.rel && p.md)
      .map((p) => ({ rel: p.rel, title: p.title, md: p.md }));
    const llmsNav = (typeof enNav !== "undefined" ? enNav : typeof nav !== "undefined" ? nav : typeof navTracks !== "undefined" ? navTracks : null);
    const llmsResult = writeLlmsArtifacts({
      dist: DIST,
      pages: llmsPages,
      base: BASE,
      origin: process.env.SITE_ORIGIN || "https://xiaoqianran.github.io",
      brand: 'LangGraph Docs',
      description: 'Unofficial mirror of LangGraph guides and API reference.',
      officialUrl: 'https://docs.langchain.com/langgraph',
      repo: 'langgraph-docs',
      nav: llmsNav,
    });
    console.log(
      `[llms] llms.txt + llms-full.txt — ${llmsResult.pageCount} pages, full=${Math.round(llmsResult.fullBytes / 1024)}KB` +
        (llmsResult.fullTruncated ? " (truncated)" : ""),
    );
  } catch (err) {
    console.warn("[llms] failed:", err?.message || err);
  }

  console.log(`Built ${n} pages, ${nav.length} tracks → ${DIST} (BASE=${BASE || "/"})`);
}

main();
