#!/usr/bin/env node
/**
 * Body quality gate for *-docs mirrors.
 * Scans docs/pages (and optional zh) for empty pages + MDX residue after normalize.
 *
 * Env:
 *   QUALITY_PAGES   comma paths relative to repo root (default: docs/pages)
 *   QUALITY_STRICT  if "1", exit 1 when thresholds exceeded
 *   QUALITY_MAX_KNOWN  max known-component tags AFTER normalize (default 100)
 *   QUALITY_MAX_EMPTY   max empty/tiny pages (default 20)
 *   QUALITY_OUT     write JSON report path (default docs/quality-report.json)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeMdxMarkdown, countMdxResidue } from "./mdx-normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PAGE_ROOTS = (process.env.QUALITY_PAGES || "docs/pages")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const STRICT = process.env.QUALITY_STRICT === "1";
const MAX_KNOWN = Number(process.env.QUALITY_MAX_KNOWN || 100);
const MAX_EMPTY = Number(process.env.QUALITY_MAX_EMPTY || 20);
const OUT = path.resolve(ROOT, process.env.QUALITY_OUT || "docs/quality-report.json");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function isHtmlDoc(text) {
  const t = String(text).trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}

/** Count known MDX tags only outside fenced code. */
function residueOutsideFences(md) {
  const stripped = String(md).replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  return countMdxResidue(stripped);
}

const pages = [];
for (const relRoot of PAGE_ROOTS) {
  const absRoot = path.join(ROOT, relRoot);
  for (const abs of walk(absRoot)) {
    const raw = fs.readFileSync(abs, "utf8");
    if (isHtmlDoc(raw)) continue;
    const rel = path.relative(ROOT, abs).split(path.sep).join("/");
    const before = countMdxResidue(raw);
    const norm = normalizeMdxMarkdown(raw);
    const after = residueOutsideFences(norm);
    const tiny = norm.trim().length < 80;
    pages.push({
      rel,
      bytes: raw.length,
      tiny,
      beforeKnown: before.knownComponents,
      afterKnown: after.knownComponents,
      afterPascal: after.pairedPascal,
    });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  pageRoots: PAGE_ROOTS,
  pages: pages.length,
  tinyOrEmpty: pages.filter((p) => p.tiny).length,
  rawKnownComponents: pages.reduce((n, p) => n + p.beforeKnown, 0),
  normalizedKnownOutsideFences: pages.reduce((n, p) => n + p.afterKnown, 0),
  worstAfter: pages
    .filter((p) => p.afterKnown > 0)
    .sort((a, b) => b.afterKnown - a.afterKnown)
    .slice(0, 15)
    .map((p) => ({ rel: p.rel, afterKnown: p.afterKnown })),
  thresholds: { MAX_KNOWN, MAX_EMPTY, STRICT },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));

console.log(
  `[quality] pages=${summary.pages} tiny=${summary.tinyOrEmpty} rawKnown=${summary.rawKnownComponents} afterKnown=${summary.normalizedKnownOutsideFences} -> ${path.relative(ROOT, OUT)}`,
);
if (summary.worstAfter.length) {
  console.log("[quality] top residue pages:");
  for (const w of summary.worstAfter.slice(0, 5)) {
    console.log(`  - ${w.rel}: ${w.afterKnown}`);
  }
}

const fail =
  STRICT &&
  (summary.normalizedKnownOutsideFences > MAX_KNOWN || summary.tinyOrEmpty > MAX_EMPTY);
if (fail) {
  console.error(
    `[quality] FAIL: afterKnown=${summary.normalizedKnownOutsideFences} (max ${MAX_KNOWN}), tiny=${summary.tinyOrEmpty} (max ${MAX_EMPTY})`,
  );
  process.exit(1);
}
process.exit(0);
