/**
 * Modal-docs page form helpers — shared across all *-docs mirrors.
 * Call createParadigm({ htmlEscape, asset, CHEV_SVG, relToHtml? }) once.
 */
export function createParadigm({ htmlEscape, asset, CHEV_SVG, relToHtml }) {
  const toHtml = relToHtml || ((rel) => String(rel || "index.md").replace(/\.md$/i, ".html"));

  function flattenNav(tracks) {
    const items = [];
    for (const t of tracks || []) {
      if (!t || t.id === "home") continue;
      for (const g of t.groups || []) {
        for (const it of g.items || []) {
          if (!it || it.rel === "index.md") continue;
          items.push({
            title: it.title,
            href: it.href,
            rel: it.rel,
            trackId: t.id,
            trackName: t.name,
            groupName: g.name || "",
          });
        }
      }
    }
    return items;
  }

  function findActiveMeta(tracks, activeRel) {
    for (const t of tracks || []) {
      for (const g of t.groups || []) {
        for (const it of g.items || []) {
          if (it.rel === activeRel) {
            return {
              trackId: t.id,
              trackName: t.name,
              groupName: g.name || "",
              title: it.title,
            };
          }
        }
      }
    }
    return {
      trackId: tracks?.[0]?.id || "",
      trackName: tracks?.[0]?.name || "",
      groupName: "",
      title: "",
    };
  }

  function renderCrumb(ui, meta, isHome, homeHref) {
    if (isHome) {
      return `<span class="current">${htmlEscape(ui.home || ui.homeTitle || "Home")}</span>`;
    }
    const parts = [
      `<a href="${homeHref || "index.html"}">${htmlEscape(ui.home || ui.homeTitle || "Home")}</a>`,
    ];
    if (meta.trackName) {
      parts.push(
        `<span class="sep">/</span><span class="pill">${htmlEscape(meta.trackName)}</span>`,
      );
    }
    if (
      meta.groupName &&
      meta.groupName !== meta.trackName &&
      !/^(Pages|Articles|Home|Overview|All|Library|Platform)$/i.test(meta.groupName)
    ) {
      parts.push(`<span class="sep">/</span><span>${htmlEscape(meta.groupName)}</span>`);
    }
    if (meta.title) {
      parts.push(
        `<span class="sep">/</span><span class="current">${htmlEscape(meta.title)}</span>`,
      );
    }
    return parts.join("");
  }

  function renderPager(flat, activeRel, ui) {
    const idx = flat.findIndex((it) => it.rel === activeRel);
    if (idx < 0) return "";
    const prev = idx > 0 ? flat[idx - 1] : null;
    const next = idx < flat.length - 1 ? flat[idx + 1] : null;
    const prevLabel = ui.prev || "Previous";
    const nextLabel = ui.next || "Next";
    const prevHtml = prev
      ? `<a class="prev" href="${prev.href}"><span class="dir">← ${htmlEscape(prevLabel)}</span><span class="title">${htmlEscape(prev.title)}</span></a>`
      : `<div class="empty"></div>`;
    const nextHtml = next
      ? `<a class="next" href="${next.href}"><span class="dir">${htmlEscape(nextLabel)} →</span><span class="title">${htmlEscape(next.title)}</span></a>`
      : `<div class="empty"></div>`;
    return `<nav class="pager" aria-label="Pagination">${prevHtml}${nextHtml}</nav>`;
  }

  function renderHomeBody(navTracks, ui, opts = {}) {
    const isZh = (ui.__locale || ui.lang || "en") === "zh";
    const flat = flattenNav(navTracks);
    const tracks = (navTracks || []).filter((t) => t && t.id !== "home");
    const pageCount = opts.pageCount || flat.length;
    const trackCount = tracks.length;
    const localeCount = opts.localeCount || 1;
    const official = opts.officialUrl || "#";
    const llmsHref = opts.llmsHref || "meta/llms.txt";
    const first = flat[0];
    const ctaHref = first?.href || "index.html";

    const eyebrow = htmlEscape(
      ui.eyebrow || (isZh ? "文档镜像" : "Documentation mirror"),
    );
    const h1 = htmlEscape(ui.homeH1 || ui.indexTitle || ui.brand || "Docs");
    const lead = htmlEscape(ui.homeLead || ui.indexLead || "");
    const getStarted = htmlEscape(ui.getStarted || (isZh ? "开始阅读" : "Get started"));
    const officialLabel = htmlEscape(
      ui.officialDocs || (isZh ? "官方站点" : "Official site"),
    );
    const tracksLabel = htmlEscape(ui.tracks || (isZh ? "按路径浏览" : "Explore by track"));
    const startLabel = htmlEscape(
      ui.startHere || (isZh ? "热门入口" : "Popular entry points"),
    );
    const pagesWord = htmlEscape(ui.pages || (isZh ? "页" : "pages"));
    const syncNote = htmlEscape(
      ui.hierarchyNote || opts.syncNote || (isZh ? "每日自动同步" : "synced daily"),
    );
    const localePill =
      localeCount > 1 ? (isZh ? "中英双语" : "EN + 中文") : isZh ? "英文" : "English";

    const cards = tracks
      .map((t, i) => {
        const items = (t.groups || []).flatMap((g) => g.items || []);
        const firstItem = items.find((it) => it.rel !== "index.md") || items[0];
        const href = firstItem?.href || ctaHref;
        const n =
          t.count ??
          (t.groups || []).reduce((s, g) => s + (g.items?.length || 0), 0);
        const icon = String(i + 1).padStart(2, "0");
        return `<a class="card" href="${href}"><span class="card-icon">${icon}</span><strong>${htmlEscape(t.name)}</strong><span>${n} ${pagesWord}</span></a>`;
      })
      .join("\n");

    const starts = [];
    for (const t of tracks.slice(0, 6)) {
      const it = (t.groups || [])
        .flatMap((g) => g.items || [])
        .find((x) => x.rel !== "index.md");
      if (!it) continue;
      const hint = `${t.count ?? ""} ${isZh ? "页" : "pages"}`.trim();
      starts.push(
        `<li><a href="${it.href}"><span>${htmlEscape(t.name)} · ${htmlEscape(it.title)}</span><span class="hint">${htmlEscape(hint)}</span></a></li>`,
      );
    }

    return `
  <div class="hero">
    <div class="eyebrow">${eyebrow}</div>
    <h1>${h1}</h1>
    <p class="lead">${lead}</p>
    <div class="hero-actions">
      <a class="btn" href="${ctaHref}">${getStarted}</a>
      <a class="btn ghost" href="${htmlEscape(official)}" target="_blank" rel="noopener">${officialLabel}</a>
      <a class="btn ghost" href="${llmsHref}">llms.txt</a>
    </div>
    <div class="hero-meta">
      <span class="pill"><b>${pageCount}</b> ${pagesWord}</span>
      <span class="pill"><b>${trackCount}</b> ${isZh ? "路径" : "tracks"}</span>
      <span class="pill">${localePill}</span>
      <span class="pill">${syncNote}</span>
    </div>
  </div>
  <div class="stats" aria-label="Stats">
    <div class="stat"><div class="n">${pageCount}</div><div class="l">${isZh ? "镜像页面" : "mirrored pages"}</div></div>
    <div class="stat"><div class="n">${trackCount}</div><div class="l">${isZh ? "文档路径" : "learning tracks"}</div></div>
    <div class="stat"><div class="n">${localeCount}</div><div class="l">${isZh ? "语言" : "locales"}</div></div>
  </div>
  <h2>${tracksLabel}</h2>
  <div class="cards">${cards}</div>
  <h2>${startLabel}</h2>
  <ul class="start-list">${
    starts.join("\n") ||
    `<li><a href="${ctaHref}"><span>${getStarted}</span><span class="hint">→</span></a></li>`
  }</ul>
  <p class="muted">${
    isZh
      ? "按 ? 查看快捷键 · / 或 ⌘K 搜索"
      : "Press ? for shortcuts · / or ⌘K to search"
  }</p>
`;
  }

  function renderNavHtmlFull(tracks, activeRel, preferredIds = []) {
    const parts = [];
    let num = 0;
    const meta = findActiveMeta(tracks, activeRel);
    for (const track of tracks || []) {
      const trackActive =
        track.id === meta.trackId ||
        (track.groups || []).some((g) =>
          (g.items || []).some((it) => it.rel === activeRel),
        );
      const prefer = preferredIds.includes(track.id);
      const open = trackActive || prefer || track.id === "home" ? "1" : "0";
      const count =
        track.count ??
        (track.groups || []).reduce((s, g) => s + (g.items?.length || 0), 0);
      parts.push(
        `<section class="track" data-track="${htmlEscape(track.id)}" data-open="${open}"${trackActive ? ' data-active="1"' : ""}>`,
      );
      parts.push(
        `<button type="button" class="track-btn" data-track-toggle="${htmlEscape(track.id)}" aria-expanded="${open === "1"}"><span class="chev" aria-hidden="true">${CHEV_SVG}</span><span class="track-label">${htmlEscape(track.name)}</span><span class="track-count">${count}</span></button>`,
      );
      parts.push(
        `<div class="track-panel"><div class="track-panel-inner"><div class="track-body">`,
      );

      const groups = track.groups || [];
      const onlyFlat =
        groups.length === 1 &&
        (!groups[0].name ||
          /^(Pages|Articles|Home|Overview|All|API|Library|Platform)$/i.test(
            groups[0].name,
          ));

      const renderLeaves = (items, groupName) => {
        let html = `<ul class="leaf-list">`;
        for (const it of items || []) {
          num += 1;
          const active = it.rel === activeRel ? " active" : "";
          const search = htmlEscape(
            `${it.title} ${track.name} ${groupName || ""}`.toLowerCase(),
          );
          html += `<li><a class="leaf${active}" href="${it.href}" data-out="${htmlEscape(it.rel || "")}" data-search="${search}" data-track="${htmlEscape(track.id)}"><span class="num">${num}</span><span class="leaf-title">${htmlEscape(it.title)}</span></a></li>`;
        }
        html += `</ul>`;
        return html;
      };

      if (onlyFlat) {
        parts.push(renderLeaves(groups[0].items, groups[0].name));
      } else {
        for (const g of groups) {
          const gActive = (g.items || []).some((it) => it.rel === activeRel);
          const hideHeader =
            !g.name ||
            (groups.length === 1 && /^(Overview|More|All|API)$/i.test(g.name));
          if (hideHeader) {
            parts.push(renderLeaves(g.items, g.name));
            continue;
          }
          parts.push(
            `<div class="group" data-group="${htmlEscape(g.name)}" data-open="${trackActive || gActive || open === "1" ? "1" : "0"}">`,
          );
          parts.push(
            `<button type="button" class="group-btn" data-group-toggle aria-expanded="true"><span class="chev" aria-hidden="true">${CHEV_SVG}</span><span class="group-name">${htmlEscape(g.name)}</span><span class="group-count">${(g.items || []).length}</span></button>`,
          );
          parts.push(`<div class="group-panel"><div class="group-panel-inner">`);
          parts.push(renderLeaves(g.items, g.name));
          parts.push(`</div></div></div>`);
        }
      }
      parts.push(`</div></div></div></section>`);
    }
    return parts.join("\n");
  }

  function renderChipsHtmlFull(tracks, activeRel, limit = 12) {
    const meta = findActiveMeta(tracks, activeRel);
    return (tracks || [])
      .filter((t) => t.id !== "home")
      .slice(0, limit)
      .map((t) => {
        const act = t.id === meta.trackId ? " active" : "";
        return `<button type="button" class="chip${act}" data-jump-track="${htmlEscape(t.id)}">${htmlEscape(t.name)}</button>`;
      })
      .join("");
  }

  function kbdHelpHtml() {
    return `<button type="button" class="to-top" id="toTop" aria-label="Back to top">
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
</div>`;
  }

  function enrichUi(ui, locale, syncNote) {
    const isZh = locale === "zh";
    return {
      ...ui,
      __locale: locale || "en",
      hierarchyNote: syncNote || ui.hierarchyNote || (isZh ? "每日自动同步" : "synced daily"),
      home: ui.home || (isZh ? "首页" : "Home"),
      prev: ui.prev || (isZh ? "上一篇" : "Previous"),
      next: ui.next || (isZh ? "下一篇" : "Next"),
      pages: ui.pages || (isZh ? "页" : "pages"),
      getStarted: ui.getStarted || (isZh ? "开始阅读" : "Get started"),
      officialDocs: ui.officialDocs || (isZh ? "官方站点" : "Official site"),
      tracks: ui.tracks || (isZh ? "按路径浏览" : "Explore by track"),
      startHere: ui.startHere || (isZh ? "热门入口" : "Popular entry points"),
      eyebrow: ui.eyebrow || (isZh ? "文档镜像" : "Documentation mirror"),
    };
  }

  
  function addHeadingIds(html) {
    const slugCount = new Map();
    return String(html).replace(/<h([1-4])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (full, level, attrs = "", inner) => {
      if (/\sid=/.test(attrs || "")) return full;
      const text = String(inner).replace(/<[^>]+>/g, "").trim();
      let base = text
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-") || "section";
      const n = slugCount.get(base) || 0;
      slugCount.set(base, n + 1);
      const id = n ? `${base}-${n}` : base;
      return `<h${level} id="${id}"><a class="anchor" href="#${id}">#</a>${inner}</h${level}>`;
    });
  }

  return {
    flattenNav,
    addHeadingIds,
    findActiveMeta,
    renderCrumb,
    renderPager,
    renderHomeBody,
    renderNavHtmlFull,
    renderChipsHtmlFull,
    kbdHelpHtml,
    enrichUi,
    toHtml,
  };
}
