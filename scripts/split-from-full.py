#!/usr/bin/env python3
"""Split docs/llms/*.full.txt into docs/pages using TOC titles from *.txt"""
from pathlib import Path
import re, json, shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
LLMS = DOCS / "llms"
PAGES = DOCS / "pages"

TRACK_LABEL = {
    "hub": "Hub", "huggingface_hub": "Hub Client", "cli": "CLI",
    "transformers": "Transformers", "datasets": "Datasets", "diffusers": "Diffusers",
    "tokenizers": "Tokenizers", "transformers.js": "Transformers.js", "peft": "PEFT",
    "accelerate": "Accelerate", "trl": "TRL", "optimum": "Optimum",
    "bitsandbytes": "BitsAndBytes", "safetensors": "Safetensors", "timm": "timm",
    "smolagents": "Smolagents", "inference-providers": "Inference Providers",
    "inference-endpoints": "Inference Endpoints",
    "text-generation-inference": "TGI", "text-embeddings-inference": "TEI",
    "dataset-viewer": "Dataset Viewer", "autotrain": "AutoTrain",
    "lerobot": "LeRobot", "kernels": "Kernels", "xet": "Xet",
}

def sanitize(t: str) -> str:
    t = re.sub(r"\bghp_[A-Za-z0-9]{20,}\b", "ghp_REDACTED", t)
    t = re.sub(r"\bhf_[A-Za-z0-9]{20,}\b", "hf_REDACTED", t)
    return t

def canonicalize_url(url: str) -> str:
    u = url.split("#")[0].rstrip("/")
    u = re.sub(r"(https://huggingface\.co/docs/[^/]+)/v\d+(?:\.\d+)*(?:\.[\w-]+)?/", r"\1/", u)
    u = re.sub(r"(https://huggingface\.co/docs/[^/]+)/main/en/", r"\1/", u)
    u = re.sub(r"(https://huggingface\.co/docs/[^/]+)/main/", r"\1/", u)
    u = re.sub(r"(https://huggingface\.co/docs/[^/]+)/en/", r"\1/", u)
    return u

def url_to_rel(url: str) -> str:
    u = canonicalize_url(url).replace("https://huggingface.co/docs/", "")
    if u.endswith(".md"):
        u = u[:-3]
    u = u.strip("/") or "index"
    return u + ".md"

def parse_toc(text: str):
    return [
        (m.group(1).strip(), m.group(2).rstrip(".,;"))
        for m in re.finditer(
            r"^- \[(.+?)\]\((https://huggingface\.co/docs/[^)\s]+)\)", text, re.M
        )
    ]

def strip_md_title(title: str) -> str:
    t = title.strip()
    t = re.sub(r"^\*\*(.+)\*\*$", r"\1", t)
    t = re.sub(r"^`(.+)`$", r"\1", t)
    return t.strip()

def find_all_h1(text: str):
    return [(m.start(), m.group(1).strip()) for m in re.finditer(r"(?m)^# (.+)$", text)]

def split_full(full_text, toc):
    h1s = find_all_h1(full_text)
    used = set()
    positions = []
    for title, url in toc:
        plain = strip_md_title(title)
        pos = -1
        for i, (hp, ht) in enumerate(h1s):
            if i in used:
                continue
            if ht == plain or ht == title:
                pos = hp
                used.add(i)
                break
        if pos < 0:
            for i, (hp, ht) in enumerate(h1s):
                if i in used:
                    continue
                if plain and plain in ht:
                    pos = hp
                    used.add(i)
                    break
        positions.append((pos, title, url))
    found = [(p, t, u) for p, t, u in positions if p >= 0]
    found.sort(key=lambda x: x[0])
    seen, uniq = set(), []
    for p, t, u in found:
        if p in seen:
            continue
        seen.add(p)
        uniq.append((p, t, u))
    pages = []
    for i, (pos, title, url) in enumerate(uniq):
        end = uniq[i + 1][0] if i + 1 < len(uniq) else len(full_text)
        body = full_text[pos:end].strip() + "\n"
        if len(body) >= 30:
            pages.append((title, url, body))
    return pages, len(toc), len(uniq)

def main():
    if not LLMS.exists():
        raise SystemExit("missing docs/llms — run fetch first")
    if PAGES.exists():
        shutil.rmtree(PAGES)
    PAGES.mkdir(parents=True)

    stats, all_pages, urls_all = [], [], []
    for txt in sorted(LLMS.glob("*.txt")):
        if txt.name.endswith(".full.txt"):
            continue
        pkg = txt.name[:-4]
        full_path = LLMS / f"{pkg}.full.txt"
        if not full_path.exists():
            print("skip no full", pkg)
            continue
        toc_text = txt.read_text(encoding="utf-8", errors="ignore")
        full_text = full_path.read_text(encoding="utf-8", errors="ignore")
        toc = parse_toc(toc_text) or parse_toc(full_text)

        (PAGES / pkg).mkdir(parents=True, exist_ok=True)
        full_rel = f"{pkg}/_full.md"
        header = (
            f"# {TRACK_LABEL.get(pkg, pkg)} — full docs dump\n\n"
            f"> From official `llms-full.txt` ({len(full_text):,} bytes).\n\n"
        )
        (PAGES / full_rel).write_text(sanitize(header + full_text), encoding="utf-8")
        all_pages.append(
            {
                "rel": full_rel,
                "bytes": (PAGES / full_rel).stat().st_size,
                "source": "llms-full",
                "url": f"https://huggingface.co/docs/{pkg}/llms-full.txt",
                "track": TRACK_LABEL.get(pkg, pkg),
                "package": pkg,
            }
        )

        if pkg == "cli" and not toc:
            rel = "cli/index.md"
            (PAGES / rel).write_text(sanitize(full_text), encoding="utf-8")
            all_pages.append(
                {
                    "rel": rel,
                    "bytes": (PAGES / rel).stat().st_size,
                    "source": "llms-full",
                    "url": "https://huggingface.co/docs/cli",
                    "track": "CLI",
                    "package": "cli",
                    "title": "CLI",
                }
            )
            stats.append({"pkg": pkg, "toc": 0, "found": 1, "written": 1, "full_bytes": len(full_text)})
            print(f"{pkg:28} special index full={len(full_text)//1024}KB")
            continue

        pages, n_toc, n_found = split_full(full_text, toc)
        written = 0
        for title, url, body in pages:
            rel = url_to_rel(url)
            if not rel.startswith(pkg + "/"):
                rel = f"{pkg}/{rel}"
            out = PAGES / rel
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(sanitize(body), encoding="utf-8")
            # alias: HF sometimes uses quicktour.md for Quickstart
            if rel.endswith("/quicktour.md"):
                alias = out.with_name("quickstart.md")
                if not alias.exists():
                    alias.write_text(sanitize(body), encoding="utf-8")
            written += 1
            all_pages.append(
                {
                    "rel": rel,
                    "bytes": out.stat().st_size,
                    "source": "llms-full-split",
                    "url": url,
                    "track": TRACK_LABEL.get(pkg, pkg),
                    "package": pkg,
                    "title": strip_md_title(title),
                }
            )
            urls_all.append(canonicalize_url(url))
        stats.append(
            {"pkg": pkg, "toc": n_toc, "found": n_found, "written": written, "full_bytes": len(full_text)}
        )
        print(f"{pkg:28} toc={n_toc:4} found={n_found:4} written={written:4} full={len(full_text)//1024}KB")

    lines = [
        "# Hugging Face documentation mirror",
        "",
        "Unofficial mirror from official `llms.txt` + `llms-full.txt`.",
        "",
        "## Packages",
        "",
        "| Package | Track | Pages | Full |",
        "|---------|-------|------:|------|",
    ]
    for s in stats:
        pkg = s["pkg"]
        label = TRACK_LABEL.get(pkg, pkg)
        lines.append(
            f"| [`{pkg}`](https://huggingface.co/docs/{pkg}) | {label} | {s['written']} | [full]({pkg}/_full.md) |"
        )
    lines += [
        "",
        "## Start here",
        "",
        "- [Transformers](transformers/index.md)",
        "- [Hub](hub/index.md)",
        "- [huggingface_hub](huggingface_hub/quick-start.md)",
        "- [Datasets](datasets/index.md)",
        "- [Diffusers](diffusers/index.md)",
        "- [CLI](cli/index.md)",
        "",
    ]
    (PAGES / "index.md").write_text("\n".join(lines), encoding="utf-8")

    list_obj = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "method": "llms-full-split",
        "ok": len(all_pages) + 1,
        "failed": 0,
        "pages": [{"rel": "index.md", "source": "mirror", "track": "Home", "url": ""}] + all_pages,
        "packageStats": stats,
    }
    (DOCS / "list.json").write_text(json.dumps(list_obj, indent=2), encoding="utf-8")
    (DOCS / "llms-urls.txt").write_text("\n".join(sorted(set(urls_all))) + "\n", encoding="utf-8")
    (DOCS / "llms.txt").write_text(
        "# Hugging Face Docs\n\n"
        + "\n".join(
            f"- [{TRACK_LABEL.get(s['pkg'], s['pkg'])}](https://huggingface.co/docs/{s['pkg']}) — {s['written']} pages"
            for s in stats
        )
        + "\n",
        encoding="utf-8",
    )
    print("TOTAL", len(all_pages) + 1)

if __name__ == "__main__":
    main()
