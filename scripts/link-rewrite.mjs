/**
 * Shared link rewriter for *-docs static sites.
 *
 * @param {object} opts
 * @param {(path: string, locale?: string) => string} opts.asset
 * @param {string[]} [opts.hosts] absolute doc hosts to map into the mirror
 * @param {string[]} [opts.rootPrefixes] site-absolute path prefixes e.g. /oss/ /docs/
 * @param {(fromRel: string, target: string) => string} [opts.resolveRelative]
 */
import path from "node:path";

export function createLinkRewriter(opts) {
  const asset = opts.asset;
  const hosts = (opts.hosts || []).map((h) => h.replace(/\/$/, ""));
  const rootPrefixes = opts.rootPrefixes || [];
  const resolveRelative =
    opts.resolveRelative ||
    ((fromRel, target) => {
      const dir = path.posix.dirname(String(fromRel).replace(/\\/g, "/"));
      let rel = target.replace(/^\.\//, "");
      if (!rel.startsWith("/")) {
        rel = path.posix.normalize(path.posix.join(dir === "." ? "" : dir, rel));
      }
      return rel.replace(/^\/+/, "");
    });

  function hostMatch(href) {
    for (const h of hosts) {
      if (href.startsWith(h + "/") || href === h) return h;
    }
    return null;
  }

  function toHtmlPath(p) {
    let x = p.replace(/\.md$/i, "").replace(/\/+$/, "");
    if (!x) return "index.html";
    return x + ".html";
  }

  return function rewriteLinks(html, fromRel, locale = "en") {
    return String(html).replace(/href="([^"]+)"/g, (full, href) => {
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("data:")) {
        return full;
      }

      const host = hostMatch(href);
      if (host) {
        let rest = href.slice(host.length).replace(/^\//, "");
        const hash = rest.includes("#") ? "#" + rest.split("#").slice(1).join("#") : "";
        rest = rest.split("#")[0];
        return `href="${asset(toHtmlPath(rest), locale)}${hash}"`;
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
        let rel = resolveRelative(fromRel, target);
        if (rel.endsWith(".md")) rel = rel.slice(0, -3) + ".html";
        else if (!rel.endsWith(".html")) rel = toHtmlPath(rel);
        return `href="${asset(rel, locale)}${hash}"`;
      }

      for (const pref of rootPrefixes) {
        if (href === pref || href.startsWith(pref)) {
          let p = href.replace(/^\//, "").replace(/\.md$/i, "").replace(/\/+$/, "");
          const hash = href.includes("#") ? "#" + href.split("#").slice(1).join("#") : "";
          p = p.split("#")[0];
          return `href="${asset(toHtmlPath(p), locale)}${hash}"`;
        }
      }

      return full;
    });
  };
}

export default createLinkRewriter;
