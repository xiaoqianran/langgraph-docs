/**
 * Shared MDX → readable Markdown normalizer for *-docs mirrors.
 * Strips / rewrites Mintlify-style components so GFM `marked` can render cleanly.
 *
 * Usage:
 *   import { normalizeMdxMarkdown } from "./mdx-normalize.mjs";
 *   body = marked.parse(normalizeMdxMarkdown(page.md));
 */

/** Protect fenced code blocks from transforms. */
function protectFences(md) {
  const blocks = [];
  const out = String(md).replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, (m) => {
    const i = blocks.length;
    blocks.push(m);
    return `\u0000FENCE${i}\u0000`;
  });
  return { text: out, blocks };
}

function restoreFences(text, blocks) {
  return String(text).replace(/\u0000FENCE(\d+)\u0000/g, (_, i) => blocks[Number(i)] ?? "");
}

function stripAttrs(tagInner) {
  // "Callout variant=\"tip\"" → ""
  return "";
}

function extractAttr(openTag, name) {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^}]*)\\})`, "i");
  const m = openTag.match(re);
  if (!m) return "";
  return (m[1] ?? m[2] ?? m[3] ?? "").trim().replace(/^["']|["']$/g, "");
}

/** Self-closing junk: <Icon ... />, <br />, etc. */
function stripSelfClosingComponents(md) {
  return md
    .replace(/<Icon\b[^>]*\/?>/gi, "")
    .replace(/<Frame\b[^>]*\/?>/gi, "")
    .replace(/<img\b[^>]*\/?>/gi, (m) => {
      // keep real images
      if (/\bsrc\s*=/i.test(m)) return m;
      return "";
    })
    .replace(/<(Check|Close|ChevronRight|ChevronDown|ExternalLink|Copy|CopyLLMTxtMenu|GuideGithubLink|Asciinema|Sandbox)\b[^>]*\/?>/gi, "");
}

/**
 * Replace paired components with blockquote / sections.
 * Handles nested-ish content by non-greedy match; runs multiple passes.
 */
function rewritePairedCallouts(md) {
  const aliases = {
    tip: "Tip",
    note: "Note",
    info: "Note",
    warning: "Warning",
    caution: "Warning",
    danger: "Warning",
    error: "Warning",
    check: "Note",
    callout: "Note",
    accordion: "Note",
    step: "Step",
    steps: "Steps",
  };

  // <Tip>...</Tip>, <Note title="x">...</Note>, <Callout variant="tip">...
  const re =
    /<(Tip|Note|Warning|Info|Check|Caution|Danger|Error|Callout|Accordion|Step|Steps)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;

  let prev;
  let out = md;
  let guard = 0;
  do {
    prev = out;
    out = out.replace(re, (full, tag, attrs, body) => {
      const t = tag.toLowerCase();
      let label = aliases[t] || "Note";
      if (t === "callout") {
        const v = (extractAttr(attrs, "variant") || extractAttr(attrs, "type") || "note").toLowerCase();
        label = aliases[v] || "Note";
      }
      const title = extractAttr(attrs, "title") || extractAttr(attrs, "name") || "";
      const inner = String(body).trim();
      const head = title ? `**${label}: ${title}**` : `**${label}**`;
      // blockquote each line
      const quoted = `${head}\n\n${inner}`
        .split("\n")
        .map((line) => `> ${line}`.replace(/>\s+$/, ">"))
        .join("\n");
      return `\n\n${quoted}\n\n`;
    });
    guard++;
  } while (out !== prev && guard < 8);
  return out;
}

/** <CodeGroup>...</CodeGroup> → sequential fenced blocks (or keep inner fences). */
function rewriteCodeGroup(md) {
  return md.replace(/<CodeGroup\b[^>]*>([\s\S]*?)<\/CodeGroup\s*>/gi, (_, inner) => {
    // Clean Mintlify fence meta: ```python Title theme={...}
    let body = String(inner);
    body = body.replace(
      /```([^\n`]*)\n/g,
      (m, info) => {
        // keep first token as lang; drop theme={...} and titles with spaces → lang only
        const raw = info.trim();
        const lang = (raw.split(/\s+/)[0] || "").replace(/[^a-zA-Z0-9_+#-]/g, "") || "";
        return "```" + lang + "\n";
      },
    );
    // drop empty wrappers
    return `\n\n${body.trim()}\n\n`;
  });
}

/** <Tabs><Tab title="A">...</Tab></Tabs> → ### headings */
function rewriteTabs(md) {
  // First expand Tab children
  let out = md.replace(/<Tab\b([^>]*)>([\s\S]*?)<\/Tab\s*>/gi, (_, attrs, body) => {
    const title =
      extractAttr(attrs, "title") ||
      extractAttr(attrs, "value") ||
      extractAttr(attrs, "label") ||
      "Tab";
    return `\n\n### ${title}\n\n${String(body).trim()}\n\n`;
  });
  out = out.replace(/<\/?Tabs\b[^>]*>/gi, "\n\n");
  return out;
}

/** <Card title="x" href="y">...</Card> and <Cards> */
function rewriteCards(md) {
  let out = md.replace(/<Card\b([^>]*)>([\s\S]*?)<\/Card\s*>/gi, (_, attrs, body) => {
    const title = extractAttr(attrs, "title") || extractAttr(attrs, "title") || "";
    const href = extractAttr(attrs, "href") || extractAttr(attrs, "url") || "";
    const head = title ? (href ? `**[${title}](${href})**` : `**${title}**`) : href ? `**[Link](${href})**` : "";
    const inner = String(body).trim();
    return `\n\n${head}\n\n${inner}\n\n`;
  });
  out = out.replace(/<\/?Cards\b[^>]*>/gi, "\n\n");
  out = out.replace(/<\/?CardGroup\b[^>]*>/gi, "\n\n");
  return out;
}

/** <AccordionGroup> / bare remaining paired unknown PascalCase → unwrap */
function unwrapUnknownComponents(md) {
  // paired tags like <Something ...>...</Something>
  let out = md;
  let prev;
  let guard = 0;
  const re = /<([A-Z][A-Za-z0-9]*)\b[^>]*>([\s\S]*?)<\/\1\s*>/g;
  do {
    prev = out;
    out = out.replace(re, (_, _tag, body) => `\n\n${String(body).trim()}\n\n`);
    guard++;
  } while (out !== prev && guard < 10);

  // self-closing PascalCase
  out = out.replace(/<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g, "");
  // orphan open/close tags PascalCase
  out = out.replace(/<\/?[A-Z][A-Za-z0-9]*\b[^>]*>/g, "");
  return out;
}

/** Clean fence info strings globally (theme={...}). */
function cleanFenceInfo(md) {
  return md.replace(/```([^\n`]*)\n/g, (m, info) => {
    if (!info || !info.trim()) return "```\n";
    // if contains theme= or { it's mintlify meta
    if (/theme\s*=|\{/.test(info)) {
      const lang = (info.trim().split(/\s+/)[0] || "").replace(/[^a-zA-Z0-9_+#-]/g, "");
      return "```" + lang + "\n";
    }
    // "python OpenAI" → python
    const parts = info.trim().split(/\s+/);
    if (parts.length > 1 && /^[a-zA-Z0-9_+#-]+$/.test(parts[0])) {
      return "```" + parts[0] + "\n";
    }
    return m;
  });
}

/** Collapse excess blank lines; trim trailing spaces. */
function tidyWhitespace(md) {
  return md
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^(#{1,6})[ \t]{2,}/gm, "$1 ")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/^\uFEFF/, "")
    .trim() + "\n";
}

/** Remove leading HTML comment banners like <!-- langchain-docs: ... --> */
function stripMirrorBanners(md) {
  return md.replace(/^<!--\s*[\w-]+-docs:[\s\S]*?-->\s*/i, "");
}

/**
 * Normalize MDX-ish markdown for GFM rendering.
 * @param {string} md
 * @returns {string}
 */
export function normalizeMdxMarkdown(md) {
  if (!md) return "";
  let text = String(md);
  text = stripMirrorBanners(text);

  // Protect fences first for most transforms, but CodeGroup needs to see fences inside.
  // Order: CodeGroup before protect; callouts can work with protect.
  text = rewriteCodeGroup(text);
  text = cleanFenceInfo(text);

  const { text: protectedText, blocks } = protectFences(text);
  text = protectedText;

  text = stripSelfClosingComponents(text);
  text = rewriteTabs(text);
  text = rewriteCards(text);
  text = rewritePairedCallouts(text);
  text = unwrapUnknownComponents(text);

  // residual lowercase html components used as callouts
  text = text.replace(/<\/?(div|span)\b[^>]*>/gi, "");

  text = restoreFences(text, blocks);
  text = cleanFenceInfo(text); // again for restored / rewritten
  text = tidyWhitespace(text);
  return text;
}

/** Count residual MDX-like tags (for CI quality reports). */
export function countMdxResidue(md) {
  const text = String(md || "");
  const paired = (text.match(/<\/?[A-Z][A-Za-z0-9]*\b/g) || []).length;
  const callouts = (text.match(/<\/?(?:Tip|Note|Warning|Callout|CodeGroup|Tabs|Tab|Card)\b/gi) || [])
    .length;
  return { pairedPascal: paired, knownComponents: callouts, total: paired + callouts };
}

export default normalizeMdxMarkdown;
