/**
 * langgraph Docs chrome — paradigm v3 (aligned to modal-docs)
 * multi-open accordion · TOC spy · progress · keyboard · copy · chips auto-fill
 */
(function () {
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");
  const search = document.getElementById("search");
  const nav = document.getElementById("nav");
  const backdrop = document.getElementById("backdrop");
  const STORE_KEY = "lg-docs-nav-v3";
  const LANG_KEY = "lg-docs-lang";

  function loadState() {
    try {
      return JSON.parse(sessionStorage.getItem(STORE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }
  function saveState(state) {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  function setTrackOpen(trackEl, open) {
    trackEl.dataset.open = open ? "1" : "0";
    const btn = trackEl.querySelector(":scope > [data-track-toggle]");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function setGroupOpen(groupEl, open) {
    groupEl.dataset.open = open ? "1" : "0";
    const btn = groupEl.querySelector(":scope > .group-btn");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function persistFromDom() {
    if (!nav) return;
    const tracks = {};
    const groups = {};
    nav.querySelectorAll(".track").forEach((t) => {
      const id = t.dataset.track;
      if (!id) return;
      tracks[id] = t.dataset.open === "1";
      t.querySelectorAll(":scope .group").forEach((g) => {
        const gName = g.dataset.group;
        if (gName) groups[`${id}::${gName}`] = g.dataset.open === "1";
      });
    });
    saveState({ tracks, groups });
  }

  function syncChips(activeId, isOpen) {
    document.querySelectorAll(".chip").forEach((c) => {
      const id = c.getAttribute("data-jump-track");
      c.classList.toggle("active", Boolean(isOpen && id === activeId));
    });
  }

  // ---- auto-fill chips from nav when host is empty (sister-repo safety) ----
  const chipsHost =
    document.getElementById("trackChips") ||
    document.getElementById("chips") ||
    document.querySelector(".chips");
  if (chipsHost && !chipsHost.querySelector("[data-jump-track]") && nav) {
    const frag = document.createDocumentFragment();
    let n = 0;
    nav.querySelectorAll(".track").forEach((t) => {
      if (n >= 12) return;
      const id = t.dataset.track;
      const label = t.querySelector(".track-label")?.textContent?.trim();
      if (!id || !label || id === "home") return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.setAttribute("data-jump-track", id);
      btn.textContent = label;
      frag.appendChild(btn);
      n += 1;
    });
    chipsHost.appendChild(frag);
  }

  // ---- track toggles ----
  nav?.querySelectorAll("[data-track-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-track-toggle");
      const track = nav.querySelector(`.track[data-track="${CSS.escape(id)}"]`);
      if (!track) return;
      const willOpen = track.dataset.open !== "1";
      setTrackOpen(track, willOpen);
      if (willOpen) {
        track.querySelectorAll(":scope .group").forEach((g) => setGroupOpen(g, true));
        requestAnimationFrame(() => {
          track.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      }
      persistFromDom();
      syncChips(id, willOpen);
    });
  });

  nav?.querySelectorAll(".group-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const g = btn.closest(".group");
      if (!g) return;
      setGroupOpen(g, g.dataset.open !== "1");
      persistFromDom();
    });
  });

  // ---- initial expand ----
  const active = nav?.querySelector(".leaf.active");
  const stored = loadState();

  if (active) {
    const track = active.closest(".track");
    const group = active.closest(".group");
    track?.setAttribute("data-active", "1");
    if (track) setTrackOpen(track, true);

    nav?.querySelectorAll(".track").forEach((t) => {
      if (t === track) return;
      const id = t.dataset.track;
      if (stored.tracks && typeof stored.tracks[id] === "boolean") {
        setTrackOpen(t, stored.tracks[id]);
      }
    });

    if (track) {
      track.querySelectorAll(":scope .group").forEach((g) => {
        const key = `${track.dataset.track}::${g.dataset.group}`;
        if (stored.groups && typeof stored.groups[key] === "boolean") {
          setGroupOpen(g, g === group ? true : stored.groups[key]);
        } else {
          setGroupOpen(g, true);
        }
      });
    }

    nav?.querySelectorAll(".track").forEach((t) => {
      if (t === track || t.dataset.open !== "1") return;
      t.querySelectorAll(":scope .group").forEach((g) => {
        const key = `${t.dataset.track}::${g.dataset.group}`;
        if (stored.groups && typeof stored.groups[key] === "boolean") {
          setGroupOpen(g, stored.groups[key]);
        } else {
          setGroupOpen(g, true);
        }
      });
    });

    syncChips(track?.dataset.track, true);
    setTimeout(() => {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 60);
  } else {
    let anyRestored = false;
    nav?.querySelectorAll(".track").forEach((t) => {
      const id = t.dataset.track;
      if (stored.tracks && typeof stored.tracks[id] === "boolean") {
        setTrackOpen(t, stored.tracks[id]);
        anyRestored = true;
        if (stored.tracks[id]) {
          t.querySelectorAll(":scope .group").forEach((g) => {
            const key = `${id}::${g.dataset.group}`;
            if (stored.groups && typeof stored.groups[key] === "boolean") {
              setGroupOpen(g, stored.groups[key]);
            } else {
              setGroupOpen(g, true);
            }
          });
        }
      }
    });
    if (!anyRestored) {
      const preferred =
        nav?.querySelector('.track[data-track="python"]') ||
        nav?.querySelector('.track[data-track="javascript"]') ||
        nav?.querySelector(".track");
      if (preferred) {
        setTrackOpen(preferred, true);
        preferred.querySelectorAll(":scope .group").forEach((g) => setGroupOpen(g, true));
        syncChips(preferred.dataset.track, true);
      }
    }
  }
  persistFromDom();

  // ---- chips ----
  document.querySelectorAll("[data-jump-track]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const id = chip.getAttribute("data-jump-track");
      const track = nav?.querySelector(`.track[data-track="${CSS.escape(id)}"]`);
      if (!track) return;
      setTrackOpen(track, true);
      track.querySelectorAll(":scope .group").forEach((g) => setGroupOpen(g, true));
      sidebar?.classList.add("open");
      backdrop?.classList.add("show");
      track.scrollIntoView({ block: "nearest", behavior: "smooth" });
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      persistFromDom();
    });
  });

  // ---- mobile menu ----
  function closeMobile() {
    sidebar?.classList.remove("open");
    backdrop?.classList.remove("show");
  }
  function openMobile() {
    sidebar?.classList.add("open");
    backdrop?.classList.add("show");
  }
  menuBtn?.addEventListener("click", () => {
    if (sidebar?.classList.contains("open")) closeMobile();
    else openMobile();
  });
  backdrop?.addEventListener("click", closeMobile);
  document.querySelector(".main")?.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 1023px)").matches) closeMobile();
  });

  // ---- search filter ----
  search?.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    const searching = q.length > 0;

    nav?.querySelectorAll(".track").forEach((track) => {
      let trackHit = false;
      track.querySelectorAll(":scope .group").forEach((group) => {
        let groupHit = false;
        group.querySelectorAll("a.leaf").forEach((leaf) => {
          const hay = (leaf.getAttribute("data-search") || leaf.textContent || "").toLowerCase();
          const ok = !searching || hay.includes(q);
          leaf.closest("li")?.classList.toggle("hidden", !ok);
          if (ok) groupHit = true;
        });
        group.classList.toggle("hidden", searching && !groupHit);
        if (groupHit) {
          trackHit = true;
          if (searching) setGroupOpen(group, true);
        }
      });
      track.querySelectorAll(":scope > .track-panel .leaf-list > li").forEach((li) => {
        if (li.closest(".group")) return;
        const leaf = li.querySelector("a.leaf");
        if (!leaf) return;
        const hay = (leaf.getAttribute("data-search") || leaf.textContent || "").toLowerCase();
        const ok = !searching || hay.includes(q);
        li.classList.toggle("hidden", !ok);
        if (ok) trackHit = true;
      });
      track.classList.toggle("hidden", searching && !trackHit);
      if (searching && trackHit) setTrackOpen(track, true);
    });
  });

  function focusSearch() {
    if (window.matchMedia("(max-width: 1023px)").matches) openMobile();
    search?.focus();
    search?.select();
  }

  // ---- keyboard: / · ⌘K · Esc · ? ----
  const kbdHelp = document.getElementById("kbdHelp");
  function closeKbdHelp() {
    kbdHelp?.classList.remove("open");
  }
  function toggleKbdHelp() {
    if (!kbdHelp) return;
    kbdHelp.classList.toggle("open");
  }
  kbdHelp?.addEventListener("click", (e) => {
    if (e.target === kbdHelp) closeKbdHelp();
  });
  document.getElementById("kbdHelpClose")?.addEventListener("click", closeKbdHelp);

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable;
    if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) && !typing) {
      e.preventDefault();
      focusSearch();
      return;
    }
    if (e.key === "?" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      toggleKbdHelp();
      return;
    }
    if (e.key === "Escape") {
      closeKbdHelp();
      if (document.activeElement === search) {
        search.blur();
        search.value = "";
        search.dispatchEvent(new Event("input"));
      }
      closeMobile();
    }
  });

  // ---- copy code ----
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const block = btn.closest(".code-block");
      const code = block?.querySelector("pre code")?.innerText || "";
      try {
        await navigator.clipboard.writeText(code);
        const prev = btn.textContent;
        const copied = btn.getAttribute("data-label-copied") || "Copied";
        btn.textContent = copied;
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = btn.getAttribute("data-label-copy") || prev;
          btn.classList.remove("copied");
        }, 1400);
      } catch {
        /* ignore */
      }
    });
  });

  // ---- heading anchor: copy URL ----
  document.querySelectorAll(".prose .anchor").forEach((a) => {
    a.addEventListener("click", async (e) => {
      try {
        const url = new URL(a.href, location.href).href;
        await navigator.clipboard.writeText(url);
        a.dataset.tip = "copied";
        setTimeout(() => delete a.dataset.tip, 1200);
      } catch {
        /* ignore */
      }
    });
  });

  // ---- hljs ----
  if (window.hljs) {
    document.querySelectorAll("pre code").forEach((el) => {
      try {
        window.hljs.highlightElement(el);
      } catch {
        /* ignore */
      }
    });
  }

  // ---- reading progress ----
  const progress = document.querySelector(".progress");
  const article = document.querySelector("article.prose, article.content");
  function updateProgress() {
    if (!progress || !article) return;
    const rect = article.getBoundingClientRect();
    const total = article.scrollHeight - window.innerHeight;
    const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
    const pct = total > 0 ? (scrolled / total) * 100 : 0;
    progress.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();

  // ---- back to top ----
  let toTop = document.getElementById("toTop");
  if (!toTop) {
    toTop = document.createElement("button");
    toTop.type = "button";
    toTop.id = "toTop";
    toTop.className = "to-top";
    toTop.setAttribute("aria-label", "Back to top");
    toTop.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg>';
    document.body.appendChild(toTop);
  }
  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  function updateToTop() {
    toTop.classList.toggle("show", window.scrollY > 480);
  }
  window.addEventListener("scroll", updateToTop, { passive: true });
  updateToTop();

  // ---- TOC scroll spy ----
  const tocLinks = [...document.querySelectorAll(".toc a[href^='#']")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const map = new Map();
    tocLinks.forEach((a) => {
      const id = decodeURIComponent(a.getAttribute("href").slice(1));
      const el = document.getElementById(id);
      if (el) map.set(el, a);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const a = map.get(entry.target);
          if (!a) return;
          if (entry.isIntersecting) {
            tocLinks.forEach((l) => l.classList.remove("active"));
            a.classList.add("active");
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: [0, 1] },
    );
    map.forEach((_, el) => io.observe(el));
  }

  // ---- lang preference ----
  document.querySelectorAll("[data-lang-set]").forEach((a) => {
    a.addEventListener("click", () => {
      try {
        localStorage.setItem(LANG_KEY, a.getAttribute("data-lang-set") || "en");
      } catch {
        /* ignore */
      }
    });
  });
})();
