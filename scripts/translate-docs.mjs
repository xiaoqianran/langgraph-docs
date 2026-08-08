#!/usr/bin/env node
/**
 * Build zh-CN machine translations for Hugging Face docs (English source of truth).
 *
 * - Keep EN under docs/pages
 * - Writes cached ZH under docs/zh/pages with content-hash skip
 * - Protects fenced code / inline code / links / HTML tags from translation
 * - Uses public Google gtx endpoint (best-effort; retries + backoff)
 *
 * Env:
 *   TRANSLATE_CONCURRENCY (default 2)
 *   TRANSLATE_LIMIT       (optional max files; for smoke tests)
 *   TRANSLATE_FORCE=1     retranslate all
 *   TRANSLATE_CHUNK       max chunk size (default 1200)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const EN_ROOT = path.join(ROOT, "docs", "pages");
const ZH_ROOT = path.join(ROOT, "docs", "zh", "pages");
const MANIFEST = path.join(ROOT, "docs", "zh", "manifest.json");
const CONCURRENCY = Math.max(1, Number(process.env.TRANSLATE_CONCURRENCY || 2));
const LIMIT = process.env.TRANSLATE_LIMIT ? Number(process.env.TRANSLATE_LIMIT) : Infinity;
const FORCE = process.env.TRANSLATE_FORCE === "1";
const CHUNK_MAX = Math.max(400, Number(process.env.TRANSLATE_CHUNK || 1200));

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.isFile() && ent.name.endsWith(".md")) acc.push(p);
  }
  return acc;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sha1(s) {
  return crypto.createHash("sha1").update(s).digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isHtmlDoc(text) {
  const t = String(text).trimStart().slice(0, 200).toLowerCase();
  return t.startsWith("<!doctype") || t.startsWith("<html") || t.startsWith("<head");
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST)) return { files: {} };
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  } catch {
    return { files: {} };
  }
}

/** Protect code fences, inline code, links, HTML tags with placeholders */
function protect(md) {
  const slots = [];
  const put = (s) => {
    const i = slots.length;
    slots.push(s);
    return `⟦T${i}⟧`;
  };
  let t = md;
  t = t.replace(/```[\s\S]*?```/g, put);
  t = t.replace(/`[^`\n]+`/g, put);
  t = t.replace(/!\[[^\]]*\]\([^)]+\)/g, put);
  t = t.replace(/\[[^\]]*\]\([^)]+\)/g, put);
  t = t.replace(/<[^>]+>/g, put);
  return { text: t, slots };
}

function restore(text, slots) {
  return text.replace(/⟦T(\d+)⟧/g, (_, n) => slots[Number(n)] ?? "");
}

function chunkText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const parts = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = maxLen;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) parts.push(rest);
  return parts;
}

async function translateChunk(text, { sl = "en", tl = "zh-CN" } = {}) {
  if (!text.trim()) return text;
  if (text.length > 1500) {
    const mid = Math.floor(text.length / 2);
    let cut = text.lastIndexOf("\n", mid);
    if (cut < mid * 0.3) cut = mid;
    const a = text.slice(0, cut);
    const b = text.slice(cut);
    return (
      (await translateChunk(a, { sl, tl })) +
      (await translateChunk(b, { sl, tl }))
    );
  }
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
    encodeURIComponent(sl) +
    "&tl=" +
    encodeURIComponent(tl) +
    "&dt=t&q=" +
    encodeURIComponent(text);
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; huggingface-docs-mirror/1.0; +https://github.com/xiaoqianran/huggingface-docs)",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const out = (data[0] || []).map((x) => x[0]).join("");
      if (!out) throw new Error("empty translation");
      return out;
    } catch (e) {
      lastErr = e;
      await sleep(400 * (attempt + 1) + Math.random() * 200);
    }
  }
  throw lastErr || new Error("translate failed");
}

async function translateMarkdown(md) {
  const { text, slots } = protect(md);
  const chunks = chunkText(text, CHUNK_MAX);
  const out = [];
  for (const c of chunks) {
    out.push(await translateChunk(c));
  }
  return restore(out.join(""), slots);
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
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  ensureDir(ZH_ROOT);
  const files = walk(EN_ROOT).sort();
  const limited = files.slice(0, LIMIT);
  const manifest = loadManifest();
  if (!manifest.files) manifest.files = {};

  let translated = 0;
  let skipped = 0;
  let failed = 0;

  await mapPool(limited, CONCURRENCY, async (abs) => {
    const rel = path.relative(EN_ROOT, abs).replace(/\\/g, "/");
    const en = fs.readFileSync(abs, "utf8");
    if (isHtmlDoc(en)) {
      console.warn(`skip HTML (not markdown): ${rel}`);
      return;
    }
    const hash = sha1(en);
    const zhAbs = path.join(ZH_ROOT, rel);
    const prev = manifest.files[rel];
    if (
      !FORCE &&
      prev?.hash === hash &&
      fs.existsSync(zhAbs) &&
      fs.statSync(zhAbs).size > 20
    ) {
      skipped++;
      return;
    }
    try {
      const zh = await translateMarkdown(en);
      ensureDir(path.dirname(zhAbs));
      const header =
        "<!-- huggingface-docs: machine-translated zh-CN from English source -->\n\n";
      fs.writeFileSync(zhAbs, header + zh);
      manifest.files[rel] = {
        hash,
        translatedAt: new Date().toISOString(),
      };
      translated++;
      console.log(`zh  ${rel}`);
    } catch (e) {
      failed++;
      console.warn(`fail ${rel}: ${e.message}`);
      // keep previous zh if any; else write EN fallback
      if (!fs.existsSync(zhAbs)) {
        ensureDir(path.dirname(zhAbs));
        fs.writeFileSync(
          zhAbs,
          "<!-- huggingface-docs: translation failed; English fallback -->\n\n" + en,
        );
        manifest.files[rel] = {
          hash,
          translatedAt: new Date().toISOString(),
          failed: true,
        };
      }
    }
  });

  manifest.updatedAt = new Date().toISOString();
  manifest.stats = { translated, skipped, failed, total: limited.length };
  ensureDir(path.dirname(MANIFEST));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(
    `done translated=${translated} skipped=${skipped} failed=${failed} manifest=${MANIFEST}`,
  );
  if (translated + skipped === 0 && failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
