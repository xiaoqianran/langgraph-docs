/**
 * Generate llmstxt.org-compatible artifacts:
 *   - llms.txt      (index of pages with absolute mirror URLs)
 *   - llms-full.txt (full markdown corpus for LLM ingestion)
 *
 * Used by all *-docs mirrors. Call writeLlmsArtifacts(...) at end of build.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {object} opts
 * @param {string} opts.dist - dist root
 * @param {Array<{rel:string,title:string,md:string}>} opts.pages
 * @param {string} [opts.base] - PAGES_BASE e.g. "/modal-docs"
 * @param {string} [opts.origin] - e.g. "https://xiaoqianran.github.io"
 * @param {string} opts.brand - site brand
 * @param {string} [opts.description]
 * @param {string} [opts.officialUrl]
 * @param {string} [opts.repo] - github repo name for note
 * @param {Array<{id:string,name:string,groups:Array<{name:string,items:Array<{title:string,rel:string,href?:string}>}>}>} [opts.nav]
 * @param {number} [opts.maxFullBytes] - soft cap for llms-full (default 80MB)
 */

function scrubSecrets(text) {
  let s = String(text || "");
  s = s.replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, "sk-[REDACTED]");
  s = s.replace(/\b(hf_[A-Za-z0-9]{16,})\b/g, "hf_[REDACTED]");
  s = s.replace(/\b(xai-[A-Za-z0-9]{16,})\b/g, "xai-[REDACTED]");
  s = s.replace(/\b(AIza[0-9A-Za-z\-_]{20,})\b/g, "[REDACTED_GOOGLE_KEY]");
  s = s.replace(/\b(Bearer\s+)[A-Za-z0-9._\-]{20,}/g, "$1[REDACTED]");
  s = s.replace(/(api[_-]?key[\"\s:=]+)([A-Za-z0-9_\-]{20,})/gi, "$1[REDACTED]");
  s = s.replace(/(apiKey[\"\s:=]+)([A-Za-z0-9_\-]{20,})/gi, "$1[REDACTED]");
  return s;
}

export function writeLlmsArtifacts(opts) {
  const {
    dist,
    pages,
    base = "",
    origin = "https://xiaoqianran.github.io",
    brand,
    description = "",
    officialUrl = "",
    repo = "",
    nav = null,
    maxFullBytes = 80 * 1024 * 1024,
  } = opts;

  if (!dist || !Array.isArray(pages)) {
    throw new Error("writeLlmsArtifacts: dist + pages required");
  }

  const baseClean = String(base || "").replace(/\/$/, "");
  const originClean = String(origin || "https://xiaoqianran.github.io").replace(/\/$/, "");
  const siteRoot = `${originClean}${baseClean}`;

  const sorted = [...pages]
    .filter((p) => p && p.rel && p.rel !== "index.md")
    .sort((a, b) => String(a.rel).localeCompare(String(b.rel)));

  const absForRel = (rel) => {
    const html = String(rel).replace(/\.md$/i, ".html").replace(/^\/+/, "");
    return `${siteRoot}/${html}`;
  };

  // ---------- llms.txt (index) ----------
  const lines = [];
  lines.push(`# ${brand}`);
  lines.push("");
  if (description) {
    lines.push(`> ${description.replace(/\s+/g, " ").trim()}`);
    lines.push("");
  }
  lines.push("Important notes:");
  lines.push("");
  lines.push(
    `- This is an unofficial documentation mirror for LLM / agent ingestion ([llmstxt.org](https://llmstxt.org/)).`,
  );
  if (officialUrl) {
    lines.push(`- Prefer the [official docs](${officialUrl}) as the source of truth.`);
  }
  lines.push(`- Mirror site: ${siteRoot}/`);
  lines.push(`- Full corpus: ${siteRoot}/llms-full.txt`);
  lines.push(`- Index JSON: ${siteRoot}/meta/list.json (if present)`);
  if (repo) {
    lines.push(`- Source repo: https://github.com/xiaoqianran/${repo}`);
  }
  lines.push(`- Pages in this index: ${sorted.length}`);
  lines.push("");

  // Prefer nav hierarchy when available
  const used = new Set();
  if (nav && nav.length) {
    for (const track of nav) {
      if (!track || track.id === "home") continue;
      const items = [];
      for (const g of track.groups || []) {
        for (const it of g.items || []) {
          if (!it?.rel || it.rel === "index.md") continue;
          if (used.has(it.rel)) continue;
          used.add(it.rel);
          items.push(it);
        }
      }
      if (!items.length) continue;
      lines.push(`## ${track.name}`);
      lines.push("");
      // subgroup if multiple named groups
      const groups = (track.groups || []).filter(
        (g) => (g.items || []).some((it) => it.rel && it.rel !== "index.md"),
      );
      const multi = groups.length > 1 && groups.some((g) => g.name && !/^(Pages|Articles|Home|All|Overview)$/i.test(g.name));
      if (multi) {
        for (const g of groups) {
          const gItems = (g.items || []).filter((it) => it.rel && it.rel !== "index.md" && used.has(it.rel) /* already marked */);
          // re-filter properly
          const list = (g.items || []).filter((it) => it.rel && it.rel !== "index.md");
          if (!list.length) continue;
          if (g.name && !/^(Pages|Articles|Home|All)$/i.test(g.name)) {
            lines.push(`### ${g.name}`);
            lines.push("");
          }
          for (const it of list) {
            lines.push(`- [${escapeMd(it.title || it.rel)}](${absForRel(it.rel)})`);
          }
          lines.push("");
        }
      } else {
        for (const it of items) {
          lines.push(`- [${escapeMd(it.title || it.rel)}](${absForRel(it.rel)})`);
        }
        lines.push("");
      }
    }
  }

  // Leftover pages not in nav
  const leftovers = sorted.filter((p) => !used.has(p.rel));
  if (leftovers.length) {
    lines.push(used.size ? "## Other pages" : "## Docs");
    lines.push("");
    for (const p of leftovers) {
      lines.push(`- [${escapeMd(p.title || p.rel)}](${absForRel(p.rel)})`);
    }
    lines.push("");
  }

  lines.push("## Optional");
  lines.push("");
  lines.push(`- [Full documentation corpus (llms-full.txt)](${siteRoot}/llms-full.txt)`);
  lines.push(`- [This index (llms.txt)](${siteRoot}/llms.txt)`);
  lines.push("");

  const llmsTxt = lines.join("\n");

  // ---------- llms-full.txt ----------
  const parts = [];
  parts.push(`# ${brand} — full documentation corpus`);
  parts.push("");
  parts.push(`> Generated for LLM ingestion. Mirror: ${siteRoot}/`);
  if (officialUrl) parts.push(`> Official: ${officialUrl}`);
  parts.push(`> Pages: ${sorted.length}`);
  parts.push("");
  parts.push("---");
  parts.push("");

  let fullBytes = Buffer.byteLength(parts.join("\n"), "utf8");
  let included = 0;
  let truncated = false;

  for (const p of sorted) {
    const title = p.title || p.rel;
    const source = absForRel(p.rel);
    const body = scrubSecrets(
      String(p.md || "")
        .replace(/^<!--[\s\S]*?-->\n*/m, "")
        .trim(),
    );
    if (!body) continue;

    const chunk = [
      `# ${title}`,
      `Source: ${source}`,
      "",
      body,
      "",
      "---",
      "",
    ].join("\n");

    const chunkBytes = Buffer.byteLength(chunk, "utf8");
    if (fullBytes + chunkBytes > maxFullBytes) {
      truncated = true;
      parts.push("");
      parts.push(
        `> [truncated] Remaining pages omitted to stay under ${Math.round(maxFullBytes / 1024 / 1024)}MB cap. See llms.txt for the full index.`,
      );
      parts.push("");
      break;
    }
    parts.push(chunk);
    fullBytes += chunkBytes;
    included += 1;
  }

  const llmsFull = parts.join("\n");

  // Write to dist root + dist/meta (and optional docs/ for local cache)
  const metaDir = path.join(dist, "meta");
  fs.mkdirSync(metaDir, { recursive: true });
  fs.mkdirSync(dist, { recursive: true });

  const targets = [
    path.join(dist, "llms.txt"),
    path.join(dist, "llms-full.txt"),
    path.join(metaDir, "llms.txt"),
    path.join(metaDir, "llms-full.txt"),
  ];
  fs.writeFileSync(path.join(dist, "llms.txt"), llmsTxt);
  fs.writeFileSync(path.join(dist, "llms-full.txt"), llmsFull);
  fs.writeFileSync(path.join(metaDir, "llms.txt"), llmsTxt);
  fs.writeFileSync(path.join(metaDir, "llms-full.txt"), llmsFull);

  // machine-readable index
  const indexJson = {
    brand,
    site: siteRoot,
    officialUrl: officialUrl || null,
    generatedAt: new Date().toISOString(),
    pageCount: sorted.length,
    fullIncluded: included,
    fullTruncated: truncated,
    files: {
      llmsTxt: `${siteRoot}/llms.txt`,
      llmsFull: `${siteRoot}/llms-full.txt`,
      metaLlmsTxt: `${siteRoot}/meta/llms.txt`,
      metaLlmsFull: `${siteRoot}/meta/llms-full.txt`,
    },
    pages: sorted.map((p) => ({
      title: p.title,
      rel: p.rel,
      url: absForRel(p.rel),
    })),
  };
  fs.writeFileSync(path.join(metaDir, "llms-index.json"), JSON.stringify(indexJson, null, 2));

  return {
    pageCount: sorted.length,
    fullIncluded: included,
    fullBytes: Buffer.byteLength(llmsFull, "utf8"),
    fullTruncated: truncated,
    targets,
  };
}

function escapeMd(s) {
  return String(s || "").replace(/[\[\]]/g, "");
}

export default writeLlmsArtifacts;
