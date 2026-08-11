/**
 * Shared marked renderer for *-docs mirrors (modal-grade code bars + heading anchors).
 */
import { marked } from "marked";

export function htmlEscape(s) {
  return String(s)
    .replaceAll("\u0026", "\u0026amp;")
    .replaceAll("\u003c", "\u0026lt;")
    .replaceAll("\u003e", "\u0026gt;")
    .replaceAll("\u0022", "\u0026quot;");
}

export function createSlugger() {
  const slugCount = new Map();
  return function slugify(text) {
    const base = String(text)
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section";
    const n = slugCount.get(base) || 0;
    slugCount.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

/**
 * @param {Record<string, string>} ui - expects copy / copied labels
 * @param {{ htmlEscape?: (s: string) => string }} [opts]
 */
export function makeRenderer(ui = {}, opts = {}) {
  const esc = opts.htmlEscape || htmlEscape;
  const slugify = createSlugger();
  const renderer = new marked.Renderer();

  renderer.heading = function (text, level) {
    if (typeof text === "object" && text !== null) {
      level = text.depth;
      text = this.parser.parseInline(text.tokens);
    }
    const id = slugify(String(text).replace(/<[^>]+>/g, ""));
    return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${text}</h${level}>\n`;
  };

  renderer.code = function (code, infostring) {
    let lang = "";
    let text = code;
    if (typeof code === "object" && code !== null) {
      lang = (code.lang || "").trim();
      text = code.text;
    } else {
      lang = (infostring || "").trim();
    }
    lang = (lang.split(/\s+/)[0] || "").toLowerCase();
    const aliases = {
      js: "javascript",
      ts: "typescript",
      sh: "bash",
      shell: "bash",
      yml: "yaml",
      console: "bash",
      py: "python",
    };
    if (aliases[lang]) lang = aliases[lang];
    const cls = lang ? `language-${lang}` : "";
    const label = lang || "text";
    const escaped = String(text)
      .replaceAll("\u0026", "\u0026amp;")
      .replaceAll("\u003c", "\u0026lt;")
      .replaceAll("\u003e", "\u0026gt;");
    const copy = esc(ui.copy || "Copy");
    const copied = esc(ui.copied || "Copied");
    return `<div class="code-block" data-lang="${label}">
  <div class="code-bar">
    <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span class="lang">${label}</span>
    <button type="button" class="copy-btn" data-copy data-label-copy="${copy}" data-label-copied="${copied}">${copy}</button>
  </div>
  <pre><code class="${cls}">${escaped}</code></pre>
</div>\n`;
  };

  return renderer;
}

/** TOC from markdown source (h2/h3), after normalizeMdxMarkdown. */
export function extractToc(md) {
  const toc = [];
  const slugify = createSlugger();
  for (const line of String(md).split("\n")) {
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const text = m[2].replace(/[`*_]/g, "").replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const id = slugify(text);
    toc.push({ level, text, id });
  }
  return toc;
}

export function tocHtml(toc, ui = {}, opts = {}) {
  const esc = opts.htmlEscape || htmlEscape;
  if (!toc || !toc.length) return "";
  const title = esc(ui.onThisPage || "On this page");
  let html = `<nav class="toc" aria-label="${title}"><div class="toc-title">${title}</div><ul>`;
  for (const t of toc) {
    html += `<li class="l${t.level}"><a href="#${esc(t.id)}">${esc(t.text)}</a></li>`;
  }
  return html + `</ul></nav>`;
}

/** Configure global marked (prefer renderMarkdown per page). */
export function configureMarked(ui = {}) {
  marked.setOptions({ gfm: true, breaks: false });
  marked.use({ renderer: makeRenderer(ui), gfm: true });
  return marked;
}

/**
 * Render one page with a fresh slugger so TOC anchors match heading ids.
 * @param {string} md normalized markdown
 * @param {Record<string, string>} ui
 */
export function renderMarkdown(md, ui = {}) {
  const renderer = makeRenderer(ui);
  return marked.parse(String(md ?? ""), {
    renderer,
    gfm: true,
    breaks: false,
    async: false,
  });
}

export default { makeRenderer, extractToc, tocHtml, configureMarked, renderMarkdown, htmlEscape };
