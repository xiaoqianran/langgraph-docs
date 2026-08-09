#!/usr/bin/env node
// LangGraph docs static site — EN + zh-CN (machine-translated), modal-docs page form
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import { createParadigm } from "./paradigm-page.mjs";
import { writeLlmsArtifacts } from "./generate-llms.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EN_PAGES = path.join(ROOT, "docs", "pages");
const ZH_PAGES = path.join(ROOT, "docs", "zh", "pages");
const DIST = path.join(ROOT, "dist");
const BASE = (process.env.PAGES_BASE || "").replace(/\/$/, "");
const UI = JSON.parse(fs.readFileSync(path.join(__dirname, "i18n", "ui.json"), "utf8"));

const CHEV_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>';

const OFFICIAL = "https://docs.langchain.com/langgraph";
const BRAND_MARK = "LG";
const PREFERRED = ["python", "javascript"];
const SYNC_NOTE_EN = "synced daily from LangGraph docs";
const SYNC_NOTE_ZH = "每日与 LangGraph 文档同步";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function asset(p, locale = "en") {
  const rel = String(p).replace(/^\//, "");
  const isShared = rel.startsWith("assets/") || rel.startsWith("meta/") || rel === "llms.txt" || rel === "llms-full.txt";
  const locPrefix = !isShared && locale === "zh" ? "zh/" : "";
  const full = locPrefix + rel;
  return BASE ? `${BASE}/${full}` : `/${full}`;
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
function pageHref(rel, locale) {
  return asset(relToHtml(rel), locale);
}

const P = createParadigm({ htmlEscape, asset, CHEV_SVG, relToHtml });

function loadPages(rootDir, stripPrefix = "langgraph-docs") {
  const files = walk(rootDir);
  const pages = [];
  for (const abs of files) {
    const rel = path.relative(rootDir, abs).replace(/\\/g, "/");
    let md = fs.readFileSync(abs, "utf8");
    if (isHtmlDoc(md)) continue;
    md = md.replace(new RegExp(`^<!-- ${stripPrefix}:[\\s\\S]*?-->\\n*`, "m"), "");
    md = md.replace(/^<!--[\s\S]*?machine-translated[\s\S]*?-->\n*/m, "");
    pages.push({ abs, rel, md, title: titleFromMd(md, humanize(path.basename(rel, ".md"))) });
  }
  return pages;
}

function buildNav(pages, locale) {
  let meta = null;
  const metaPath = path.join(ROOT, "docs", "meta-tree.json");
  if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

  const homeTitle = locale === "zh" ? "首页" : "Home";
  const tracks = [
    {
      id: "home",
      name: homeTitle,
      badge: "·",
      groups: [{ name: homeTitle, items: [{ title: homeTitle, href: asset("index.html", locale), rel: "index.md" }] }],
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
          items: sorted.map((it) => {
            const page = pages.find((p) => p.rel === it.rel);
            return {
              title: page?.title || it.title,
              href: asset(relToHtml(it.rel), locale),
              rel: it.rel,
            };
          }),
        });
      }
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
    const items = pages
      .filter((p) => p.rel !== "index.md")
      .map((p) => ({ title: p.title, href: asset(relToHtml(p.rel), locale), rel: p.rel }));
    tracks.push({
      id: "all",
      name: locale === "zh" ? "全部文档" : "All docs",
      badge: "▸",
      groups: [{ name: locale === "zh" ? "页面" : "Pages", items }],
      count: items.length,
    });
  }
  return tracks;
}

function enhanceCode(html, ui = {}) {
  const copy = htmlEscape(ui.copy || "Copy");
  return html
    .replace(
      /<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g,
      (_, lang, code) =>
        `<div class="code-block"><div class="code-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lang">${htmlEscape(lang || "text")}</span><button type="button" class="copy-btn" data-copy data-label-copy="${copy}" data-label-copied="${htmlEscape(ui.copied || "Copied")}">${copy}</button></div><pre><code class="language-${htmlEscape(lang)}">${code}</code></pre></div>`,
    )
    .replace(
      /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
      (_, code) =>
        `<div class="code-block"><div class="code-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lang">text</span><button type="button" class="copy-btn" data-copy data-label-copy="${copy}" data-label-copied="${htmlEscape(ui.copied || "Copied")}">${copy}</button></div><pre><code>${code}</code></pre></div>`,
    );
}

function tocFromHtml(html, ui = {}) {
  const items = [];
  const re = /<h([23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  let m;
  while ((m = re.exec(html))) {
    const text = m[3].replace(/<[^>]+>/g, "").trim();
    if (text) items.push({ level: Number(m[1]), id: m[2], text });
  }
  if (items.length < 1) return "";
  const title = htmlEscape(ui.onThisPage || "On this page");
  return `<nav class="toc" aria-label="${title}"><div class="toc-title">${title}</div><ul>${items
    .map((it) => `<li class="l${it.level}"><a href="#${htmlEscape(it.id)}">${htmlEscape(it.text)}</a></li>`)
    .join("")}</ul></nav>`;
}

function postProcessHtml(html, fromRel, locale) {
  return html.replace(/href="([^"]+)"/g, (full, href) => {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) return full;
    if (/^https?:\/\/docs\.langchain\.com\//i.test(href)) {
      let p = href.replace(/^https?:\/\/docs\.langchain\.com\//i, "").replace(/\.md$/i, "");
      p = p.split("#")[0].replace(/\/+$/, "");
      const hash = href.includes("#") ? "#" + href.split("#").slice(1).join("#") : "";
      if (!p) return `href="${asset("index.html", locale)}${hash}"`;
      return `href="${asset(p + ".html", locale)}${hash}"`;
    }
    if (/^https?:\/\//i.test(href)) return full;
    if (href.endsWith(".md") || href.includes(".md#")) {
      let target = href;
      let hash = "";
      const hi = target.indexOf("#");
      if (hi >= 0) {
        hash = target.slice(hi);
        target = target.slice(0, hi);
      }
      const dir = path.posix.dirname(fromRel.replace(/\\/g, "/"));
      let rel = target.replace(/^\.\//, "");
      if (!rel.startsWith("/")) {
        rel = path.posix.normalize(path.posix.join(dir === "." ? "" : dir, rel));
      }
      rel = rel.replace(/^\/+/, "");
      if (rel.endsWith(".md")) rel = rel.slice(0, -3) + ".html";
      return `href="${asset(rel, locale)}${hash}"`;
    }
    if (
      href.startsWith("/oss/") ||
      href.startsWith("/langsmith/") ||
      href.startsWith("/api-reference/") ||
      href.startsWith("/reference/")
    ) {
      let p = href.replace(/^\//, "").replace(/\.md$/i, "").replace(/\/+$/, "");
      return `href="${asset(p + ".html", locale)}"`;
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

function layout({ locale, title, bodyHtml, navHtml, chipsHtml, tocHtml, rel, ui, mtBanner, crumbHtml, pagerHtml }) {
  const enHref = asset(relToHtml(rel || "index.md"), "en");
  const zhHref = asset(relToHtml(rel || "index.md"), "zh");
  const activeEn = locale === "en" ? " active" : "";
  const activeZh = locale === "zh" ? " active" : "";
  const langAttr = locale === "zh" ? "zh-CN" : "en";
  const desc = htmlEscape(ui.homeLead || title || "");
  return `<!DOCTYPE html>
<html lang="${langAttr}" data-locale="${locale}">
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
  <link rel="alternate" hreflang="en" href="${enHref}" />
  <link rel="alternate" hreflang="zh-CN" href="${zhHref}" />
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="progress" aria-hidden="true"></div>
  <header class="topbar">
    <div class="topbar-inner">
      <button type="button" class="menu-btn" id="menuBtn" aria-label="${htmlEscape(ui.menu || "Menu")}">${htmlEscape(ui.menu || "Menu")}</button>
      <a class="brand" href="${asset("index.html", locale)}">
        <span class="brand-mark">${BRAND_MARK}</span>
        <span class="brand-text">${htmlEscape(ui.brand || "Docs")}</span>
        <span class="brand-v">${htmlEscape(ui.brandSub || "mirror")}</span>
      </a>
      <nav class="chips" id="trackChips" aria-label="Tracks">${chipsHtml || ""}</nav>
      <div class="lang-switch" role="group" aria-label="${htmlEscape(ui.langLabel || "Language")}">
        <a class="lang-btn${activeEn}" href="${enHref}" data-lang-set="en" hreflang="en">${htmlEscape(ui.langEn || "EN")}</a>
        <a class="lang-btn${activeZh}" href="${zhHref}" data-lang-set="zh" hreflang="zh-CN">${htmlEscape(ui.langZh || "中文")}</a>
      </div>
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
      ${mtBanner || ""}
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
  for (const f of ["llms.txt", "list.json", "meta-tree.json", "reference-llms.txt"]) {
    const src = path.join(ROOT, "docs", f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST, "meta", f));
  }
}

function buildLocale(locale, pages, navTracks) {
  const sync = locale === "zh" ? SYNC_NOTE_ZH : SYNC_NOTE_EN;
  const baseUi = UI[locale] || UI.en;
  const ui = P.enrichUi(
    {
      ...baseUi,
      homeH1: baseUi.homeH1,
      homeLead: baseUi.homeLead,
    },
    locale,
    sync,
  );
  const outRoot = locale === "zh" ? path.join(DIST, "zh") : DIST;
  ensureDir(outRoot);
  const flat = P.flattenNav(navTracks);
  const homeHref = asset("index.html", locale);
  marked.setOptions({ gfm: true, breaks: false });
  let n = 0;
  for (const page of pages) {
    const isHome = page.rel === "index.md";
    const title = isHome ? ui.homeTitle || (locale === "zh" ? "首页" : "Home") : page.title;
    const navHtml = renderNavHtml(navTracks, page.rel);
    const chipsHtml = renderChipsHtml(navTracks, page.rel);
    let body;
    let toc = "";
    if (isHome) {
      body = P.renderHomeBody(navTracks, ui, {
        pageCount: pages.length,
        localeCount: 2,
        officialUrl: OFFICIAL,
        syncNote: sync,
        llmsHref: asset("llms.txt"),
        llmsFullHref: asset("llms-full.txt"),
      });
    } else {
      body = marked.parse(page.md);
      body = P.addHeadingIds(body);
      body = enhanceCode(body, ui);
      body = postProcessHtml(body, page.rel, locale);
      toc = tocFromHtml(body, ui);
    }
    const meta = P.findActiveMeta(navTracks, page.rel);
    meta.title = title;
    const crumbHtml = P.renderCrumb(ui, meta, isHome, homeHref);
    const pagerHtml = isHome ? "" : P.renderPager(flat, page.rel, ui);
    const mtBanner =
      locale === "zh" && !isHome && ui.mtBanner
        ? `<div class="mt-banner">${htmlEscape(ui.mtBanner)} <a href="${asset(relToHtml(page.rel), "en")}">${htmlEscape(ui.mtViewEn || "View English")}</a></div>`
        : "";
    const html = layout({
      locale,
      title,
      bodyHtml: body,
      navHtml,
      chipsHtml,
      tocHtml: toc,
      rel: page.rel,
      ui,
      mtBanner,
      crumbHtml,
      pagerHtml,
    });
    const outFile = path.join(outRoot, relToHtml(page.rel));
    ensureDir(path.dirname(outFile));
    fs.writeFileSync(outFile, html);
    n++;
  }
  return n;
}

function main() {
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
  copyAssets();

  const enPages = loadPages(EN_PAGES, "langgraph-docs");
  if (!enPages.length) {
    console.error("No EN pages");
    process.exit(1);
  }
  const zhPages = enPages.map((p) => {
    const zhAbs = path.join(ZH_PAGES, p.rel);
    if (fs.existsSync(zhAbs)) {
      let md = fs.readFileSync(zhAbs, "utf8");
      md = md.replace(/^<!--[\s\S]*?-->\n*/m, "");
      if (!isHtmlDoc(md) && md.trim().length > 20) {
        return { ...p, md, title: titleFromMd(md, p.title) };
      }
    }
    return { ...p };
  });

  const enNav = buildNav(enPages, "en");
  const zhNav = buildNav(zhPages, "zh");
  fs.writeFileSync(path.join(DIST, "assets", "nav.json"), JSON.stringify(enNav, null, 2));
  fs.writeFileSync(path.join(DIST, "assets", "nav.zh.json"), JSON.stringify(zhNav, null, 2));

  const nEn = buildLocale("en", enPages, enNav);
  const nZh = buildLocale("zh", zhPages, zhNav);
  console.log(`[en] ${nEn} pages — tracks ${enNav.length}`);
  console.log(`[zh] ${nZh} pages`);

  try {
    const llmsPages = enPages
      .filter((p) => p && p.rel && p.md)
      .map((p) => ({ rel: p.rel, title: p.title, md: p.md }));
    const llmsResult = writeLlmsArtifacts({
      dist: DIST,
      pages: llmsPages,
      base: BASE,
      origin: process.env.SITE_ORIGIN || "https://xiaoqianran.github.io",
      brand: "LangGraph Docs",
      description: "Unofficial mirror of LangGraph guides and API reference (EN + zh-CN).",
      officialUrl: "https://docs.langchain.com/langgraph",
      repo: "langgraph-docs",
      nav: enNav,
    });
    console.log(
      `[llms] llms.txt + llms-full.txt — ${llmsResult.pageCount} pages, full=${Math.round(llmsResult.fullBytes / 1024)}KB` +
        (llmsResult.fullTruncated ? " (truncated)" : ""),
    );
  } catch (err) {
    console.warn("[llms] failed:", err?.message || err);
  }

  console.log(`Built locales en+zh -> ${DIST} (BASE=${BASE || "/"})`);
}

main();
