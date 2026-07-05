// =============================================================================
// content.js — Un-doomed scraper + ON-PAGE controls + results OVERLAY.
// =============================================================================
//
// Runs in the extension's isolated world (shares the page DOM, but cannot touch
// the page's JS globals such as window.monaco). So this file:
//   1. Scrapes the problem description (+ a DOM-only code fallback).
//   2. Draws on-page CONTROLS — a launcher with a "Review" button (request a
//      review without opening the toolbar popup) and a panel toggle.
//   3. Draws the results OVERLAY in a Shadow DOM (so LeetCode's CSS can't bleed
//      in and ours can't leak out). The panel can sit on the LEFT or RIGHT and
//      starts below LeetCode's top bar so it never covers the timer/avatar.
//   4. Shows per-problem HISTORY cached in chrome.storage.local — reopen past
//      reviews instantly, no API call, no tokens.
//
// The actual review work (Monaco read + cross-origin fetch) happens in the
// service worker (background.js); on-page buttons just send it a message.
// =============================================================================

(function () {
  "use strict";

  if (window.__undoomedContentLoaded) return;
  window.__undoomedContentLoaded = true;

  // Non-breaking space, built from its code point so no invisible character
  // ever ends up in this source file.
  const NBSP = String.fromCharCode(160);

  // Per-provider default model, used only to LABEL the footer when the user
  // hasn't overridden the model. The authoritative defaults live in the backend
  // and the Settings page; this is a display convenience.
  const DEFAULT_MODELS = {
    openai: "gpt-4o-mini",
    anthropic: "claude-opus-4-8",
    gemini: "gemini-2.5-flash",
    deepseek: "deepseek-chat",
  };

  // -------------------------------------------------------------------------
  // 1. SCRAPING
  // -------------------------------------------------------------------------
  function firstText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim()) return el.innerText.trim();
    }
    return "";
  }

  function scrapeDescription() {
    const title = firstText([
      "a[href^='/problems/'].truncate",
      ".text-title-large a",
      "div.text-title-large",
      "[data-cy='question-title']",
    ]);
    const bodyEl = (
      document.querySelector("[data-track-load='description_content']") ||
      document.querySelector("div.elfjS") ||
      document.querySelector("[data-cy='question-content']") ||
      document.querySelector(".question-content__JfgR") ||
      document.querySelector(".content__u3I1")
    );
    const body = bodyEl ? bodyEl.innerText.trim() : "";

    // Try to pull the Constraints block out separately so it is always clearly
    // labelled when we send the prompt to the AI — prevents the model from
    // raising faults for inputs the constraints explicitly rule out.
    let constraints = "";
    if (bodyEl) {
      // Walk paragraphs/headings looking for one whose text starts with "Constraints"
      const allBlocks = bodyEl.querySelectorAll("p, ul, ol, li");
      let capturing = false;
      const constraintLines = [];
      allBlocks.forEach((el) => {
        const t = el.innerText ? el.innerText.trim() : "";
        if (!capturing && /^constraints/i.test(t)) {
          capturing = true;
          return; // heading itself — skip the label, grab what follows
        }
        if (capturing) {
          // Stop if we hit the next major heading
          if (el.tagName === "P" && /^(follow-up|note|example|hint)/i.test(t)) {
            capturing = false;
          } else if (t) {
            constraintLines.push(t);
          }
        }
      });
      if (constraintLines.length) {
        constraints = "\n\nCONSTRAINTS (hard limits — do not raise issues that violate these):\n" +
          constraintLines.map((l) => "- " + l).join("\n");
      }
    }

    const full = body + constraints;
    if (title && full) return title + "\n\n" + full;
    return full || title || "";
  }

  function scrapeCodeFromDom() {
    const lines = Array.from(document.querySelectorAll(".view-line"));
    if (!lines.length) return "";
    lines.sort(
      (a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0)
    );
    const nbspRe = new RegExp(NBSP, "g");
    return lines
      .map((line) => line.innerText.replace(nbspRe, " "))
      .join("\n")
      .trim();
  }

  // -------------------------------------------------------------------------
  // 2. STORAGE (history + side preference)
  // -------------------------------------------------------------------------
  function currentSlug() {
    const m = /leetcode\.com\/problems\/([^/?#]+)/.exec(location.href);
    return m ? m[1] : "unknown";
  }
  function historyKey(slug) {
    return "undoomed_history__" + (slug || "unknown");
  }
  async function loadHistory(slug) {
    try {
      const key = historyKey(slug);
      const stored = await chrome.storage.local.get(key);
      return Array.isArray(stored[key]) ? stored[key] : [];
    } catch (e) {
      return [];
    }
  }
  async function loadSide() {
    try {
      const s = await chrome.storage.local.get("undoomed_overlay_side");
      return s.undoomed_overlay_side === "left" ? "left" : "right";
    } catch (e) {
      return "right";
    }
  }
  async function saveSide(value) {
    try {
      await chrome.storage.local.set({ undoomed_overlay_side: value });
    } catch (e) {
      /* ignore */
    }
  }
  async function loadPanelSize() {
    try {
      const s = await chrome.storage.local.get(["undoomed_panel_w", "undoomed_panel_h"]);
      return { w: s.undoomed_panel_w || null, h: s.undoomed_panel_h || null };
    } catch (e) {
      return { w: null, h: null };
    }
  }
  async function savePanelSize(w, h) {
    try {
      await chrome.storage.local.set({ undoomed_panel_w: w, undoomed_panel_h: h });
    } catch (e) {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // 3. OVERLAY (Shadow DOM)
  // -------------------------------------------------------------------------
  const TOP_OFFSET = 56; // clears LeetCode's top navigation bar

  // Greyscale + blue theme. All colors live in CSS variables on .ui; the
  // .ui--dark modifier swaps the greys so the panel matches LeetCode's own
  // light/dark theme (detected from the page, see applyTheme()).
  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .ui {
      --surface: #ffffff;      /* panel background */
      --bg-soft: #f4f4f5;      /* hovers, soft chips */
      --ink: #18181b;          /* main text */
      --muted: #71717a;        /* secondary text */
      --line: #e4e4e7;         /* borders */
      --accent: #2563eb;       /* THE blue — primary actions + highlights */
      --accent-press: #1d4ed8;
      --accent-deep: #1e40af;
      --accent-soft: #eff6ff;  /* soft blue background for callouts */
      --accent-soft-ink: #1e40af;
      --code-bg: #ececee;
      --pre-bg: #1c1c21;
      --pre-ink: #e4e4e7;
      --shadow: rgba(24,24,27,.18);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
    }
    .ui--dark {
      --surface: #232327;
      --bg-soft: #2e2e33;
      --ink: #f4f4f5;
      --muted: #a1a1aa;
      --line: #3a3a40;
      --accent: #3b82f6;
      --accent-press: #2563eb;
      --accent-deep: #1d4ed8;
      --accent-soft: #1e2a45;
      --accent-soft-ink: #93c5fd;
      --code-bg: #2e2e33;
      --pre-bg: #131316;
      --pre-ink: #d4d4d8;
      --shadow: rgba(0,0,0,.5);
    }

    /* Keyboard focus is always visible — and always blue. */
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    /* Launcher: a split pill — [toggle | Review] — bottom-right. */
    .launch {
      position: fixed; right: 18px; bottom: 18px; z-index: 1;
      display: inline-flex; align-items: stretch; border-radius: 999px;
      overflow: hidden; box-shadow: 0 6px 20px rgba(37,99,235,.35);
    }
    .launch__toggle, .launch__review {
      appearance: none; border: 0; cursor: pointer; color: #fff;
      font: 600 13px/1 inherit; padding: 11px 14px; display: inline-flex;
      align-items: center; gap: 7px;
    }
    .launch__toggle { background: var(--accent); }
    .launch__toggle:hover { background: var(--accent-press); }
    .launch__review { background: var(--accent-press); border-left: 1px solid rgba(255,255,255,.25); }
    .launch__review:hover { background: var(--accent-deep); }
    .launch__badge {
      min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
      background: #fff; color: var(--accent-press); font-size: 10px; font-weight: 700;
      display: inline-grid; place-items: center;
    }

    /* Panel: a drawer on the left OR right, below the top bar.
       width/height are defaults; drag handles set inline px overrides. */
    .panel {
      position: fixed; top: ${TOP_OFFSET}px; height: calc(100vh - ${TOP_OFFSET}px);
      width: min(520px, 92vw); background: var(--surface); color: var(--ink); z-index: 2;
      display: flex; flex-direction: column; transition: transform .22s ease;
    }
    .panel--right { right: 0; box-shadow: -12px 0 40px var(--shadow); transform: translateX(100%); }
    .panel--left  { left: 0;  box-shadow: 12px 0 40px var(--shadow);  transform: translateX(-100%); }
    .panel--open { transform: translateX(0); }

    .phead {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid var(--line);
    }
    .phead__l { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .mark {
      width: 28px; height: 28px; border-radius: 8px; background: var(--ink);
      color: var(--surface); display: grid; place-items: center; font-size: 15px; font-weight: 700; flex: 0 0 auto;
    }
    .pname { font-size: 14.5px; font-weight: 650; }
    .pmeta { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .phead__r { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
    /* Greyscale verdicts: approved = blue (the highlight), needs-revision =
       inverted ink (urgent without color), pending = quiet grey. */
    .pill--revision { background: var(--ink); color: var(--surface); }
    .pill--approved { background: var(--accent-soft); color: var(--accent-soft-ink); }
    .pill--neutral { background: var(--bg-soft); color: var(--muted); }
    .iconbtn {
      appearance: none; border: 0; background: none; cursor: pointer;
      font-size: 16px; line-height: 1; color: var(--muted); padding: 4px 7px; border-radius: 6px;
    }
    .iconbtn:hover { background: var(--bg-soft); color: var(--ink); }
    .iconbtn--x { font-size: 20px; }

    .actions { padding: 12px 14px; border-bottom: 1px solid var(--line); display: flex; gap: 8px; align-items: stretch; }
    .review-btn {
      appearance: none; border: 0; cursor: pointer; flex: 1; padding: 10px 14px;
      background: var(--accent); color: #fff; font: 600 14px/1 inherit; border-radius: 10px;
    }
    .review-btn:hover { background: var(--accent-press); }
    .review-btn:disabled { opacity: .6; cursor: progress; }
    .size-reset {
      appearance: none; cursor: pointer; flex: 0 0 auto; width: 40px;
      background: var(--surface); color: var(--muted); border: 1px solid var(--line); border-radius: 10px;
      font-size: 15px;
    }
    .size-reset:hover { color: var(--ink); background: var(--bg-soft); }

    /* Footer: a quick link to Settings that also shows the active model. */
    .pfoot { border-top: 1px solid var(--line); padding: 6px 8px; flex: 0 0 auto; }
    .foot-btn {
      width: 100%; appearance: none; border: 0; background: none; cursor: pointer;
      display: flex; align-items: center; gap: 8px; padding: 6px 8px;
      border-radius: 8px; font: inherit; color: var(--muted); text-align: left;
    }
    .foot-btn:hover { background: var(--bg-soft); color: var(--ink); }
    .foot-gear { font-size: 14px; flex: 0 0 auto; }
    .foot-model { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* "no changes" note banner above the review body — a blue callout. */
    .ud-note {
      background: var(--accent-soft); color: var(--accent-soft-ink);
      border: 1px solid rgba(37,99,235,.25);
      border-radius: 8px; padding: 8px 10px; font-size: 12.5px; margin-bottom: 12px;
    }

    /* drag-to-resize handles */
    .rsz { position: absolute; z-index: 5; touch-action: none; }
    .rsz--w { top: 0; bottom: 0; width: 10px; cursor: ew-resize; }
    .panel--right .rsz--w { left: -3px; }
    .panel--left .rsz--w { right: -3px; }
    .rsz--h { left: 0; right: 0; bottom: -3px; height: 10px; cursor: ns-resize; }
    .rsz--c { width: 16px; height: 16px; bottom: 0; z-index: 6; }
    .panel--right .rsz--c { left: 0; cursor: nesw-resize; }
    .panel--left .rsz--c { right: 0; cursor: nwse-resize; }
    .rsz--w:hover, .rsz--h:hover { background: rgba(37,99,235,.15); }

    .tabs { display: flex; gap: 4px; padding: 6px 12px 0; border-bottom: 1px solid var(--line); }
    .tab {
      appearance: none; border: 0; background: none; cursor: pointer;
      padding: 8px 12px; font: 600 13px/1 inherit; color: var(--muted);
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab:hover { color: var(--ink); }
    .tab--active { color: var(--accent); border-bottom-color: var(--accent); }
    .body { flex: 1; overflow: auto; padding: 16px; }
    .empty { color: var(--muted); font-size: 13px; text-align: center; margin-top: 36px; }

    .loading { display: flex; align-items: center; gap: 10px; color: var(--muted); margin-top: 30px; justify-content: center; }
    .spin { width: 18px; height: 18px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: ud-spin .8s linear infinite; }
    @keyframes ud-spin { to { transform: rotate(360deg); } }

    .hitem {
      width: 100%; text-align: left; appearance: none; cursor: pointer;
      border: 1px solid var(--line); background: var(--surface); border-radius: 10px;
      padding: 10px 12px; margin-bottom: 8px; display: block; font: inherit; color: var(--ink);
    }
    .hitem:hover { border-color: var(--muted); background: var(--bg-soft); }
    .hitem__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .hitem__when { font-size: 11px; color: var(--muted); }
    .hitem__sub { font-size: 12px; color: var(--muted); margin-top: 3px; }

    .md .ud-h { margin: 14px 0 6px; line-height: 1.3; }
    .md h1.ud-h { font-size: 18px; } .md h2.ud-h { font-size: 16px; }
    .md h3.ud-h { font-size: 14.5px; } .md h4.ud-h, .md h5.ud-h, .md h6.ud-h { font-size: 13.5px; }
    .md .ud-p { margin: 8px 0; }
    .md .ud-list { margin: 8px 0; padding-left: 22px; }
    .md .ud-list li { margin: 3px 0; }
    .md .ud-code {
      font-family: Monaco, Menlo, 'Ubuntu Mono', Consolas, 'source-code-pro', monospace; font-size: 12.5px;
      background: var(--code-bg); padding: 1px 5px; border-radius: 5px;
    }
    .md .ud-pre {
      background: var(--pre-bg); color: var(--pre-ink); border-radius: 10px; padding: 12px 14px;
      overflow: auto; margin: 10px 0;
    }
    .md .ud-pre code { font-family: Monaco, Menlo, 'Ubuntu Mono', Consolas, 'source-code-pro', monospace; font-size: 12.5px; background: none; padding: 0; }
    .md .ud-hr { border: 0; border-top: 1px solid var(--line); margin: 14px 0; }
    .md a { color: var(--accent); }
    .md strong { font-weight: 650; }
    .md :first-child { margin-top: 0; }
  `;

  let els = null;
  let side = "right";

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = "undoomed-overlay-host";
    const root = host.attachShadow({ mode: "open" });

    root.innerHTML =
      "<style>" + STYLE + "</style>" +
      '<div class="ui">' +
      '  <div class="launch" id="ud-launch">' +
      '    <button class="launch__toggle" id="ud-toggle" title="Open/close Un-doomed">' +
      "      <span>&#9097; Un-doomed</span><span class=\"launch__badge\" id=\"ud-badge\" hidden></span>" +
      "    </button>" +
      '    <button class="launch__review" id="ud-review-quick" title="Request a Socratic review">Review</button>' +
      "  </div>" +
      '  <aside class="panel panel--right" id="ud-panel" role="dialog" aria-label="Un-doomed review">' +
      '    <div class="phead">' +
      '      <div class="phead__l">' +
      '        <div class="mark">&#9097;</div>' +
      '        <div style="min-width:0">' +
      '          <div class="pname">Un-doomed</div>' +
      '          <div class="pmeta" id="ud-meta">Hints, not answers.</div>' +
      "        </div>" +
      "      </div>" +
      '      <div class="phead__r">' +
      '        <span class="pill pill--neutral" id="ud-pill" hidden></span>' +
      '        <button class="iconbtn" id="ud-settings" title="Settings — provider, model, API key">&#9881;</button>' +
      '        <button class="iconbtn" id="ud-flip" title="Move to the other side">&#8646;</button>' +
      '        <button class="iconbtn iconbtn--x" id="ud-close" title="Close">&times;</button>' +
      "      </div>" +
      "    </div>" +
      '    <div class="actions">' +
      '      <button class="review-btn" id="ud-review" type="button">Request Socratic Review</button>' +
      '      <button class="size-reset" id="ud-reset" type="button" title="Reset panel size (or double-click an edge)">&#8690;</button>' +
      "    </div>" +
      '    <nav class="tabs">' +
      '      <button class="tab tab--active" id="ud-tab-current" data-tab="current">Current</button>' +
      '      <button class="tab" id="ud-tab-history" data-tab="history">History</button>' +
      "    </nav>" +
      '    <section class="body">' +
      '      <div class="md" id="ud-current"><p class="empty">Click "Request Socratic Review" to get hints here.</p></div>' +
      '      <div id="ud-history" hidden></div>' +
      "    </section>" +
      '    <div class="pfoot">' +
      '      <button class="foot-btn" id="ud-foot-settings" type="button" title="Open settings — provider, model, API key">' +
      '        <span class="foot-gear">&#9881;</span>' +
      '        <span class="foot-model" id="ud-foot-model">Settings</span>' +
      "      </button>" +
      "    </div>" +
      '    <div class="rsz rsz--w" id="ud-rsz-w" title="Drag to resize width"></div>' +
      '    <div class="rsz rsz--h" id="ud-rsz-h" title="Drag to resize height"></div>' +
      '    <div class="rsz rsz--c" id="ud-rsz-c" title="Drag to resize"></div>' +
      "  </aside>" +
      "</div>";

    (document.documentElement || document.body).appendChild(host);

    els = {
      host,
      root,
      ui: root.querySelector(".ui"),
      panel: root.getElementById("ud-panel"),
      badge: root.getElementById("ud-badge"),
      meta: root.getElementById("ud-meta"),
      pill: root.getElementById("ud-pill"),
      current: root.getElementById("ud-current"),
      history: root.getElementById("ud-history"),
      tabCurrent: root.getElementById("ud-tab-current"),
      tabHistory: root.getElementById("ud-tab-history"),
      reviewBtn: root.getElementById("ud-review"),
      footModel: root.getElementById("ud-foot-model"),
      rszW: root.getElementById("ud-rsz-w"),
      rszH: root.getElementById("ud-rsz-h"),
      rszC: root.getElementById("ud-rsz-c"),
    };

    root.getElementById("ud-toggle").addEventListener("click", () => togglePanel());
    root.getElementById("ud-review-quick").addEventListener("click", () => triggerReview());
    els.reviewBtn.addEventListener("click", () => triggerReview());
    root.getElementById("ud-close").addEventListener("click", () => openPanel(false));
    root.getElementById("ud-flip").addEventListener("click", () => flipSide());
    root.getElementById("ud-reset").addEventListener("click", () => resetPanelSize());
    root.getElementById("ud-settings").addEventListener("click", () => openSettings());
    root.getElementById("ud-foot-settings").addEventListener("click", () => openSettings());
    els.tabCurrent.addEventListener("click", () => switchTab("current"));
    els.tabHistory.addEventListener("click", () => switchTab("history"));

    // Drag-to-resize: width (inner edge), height (bottom), corner (both).
    els.rszW.addEventListener("pointerdown", (e) => startResize(e, "w"));
    els.rszH.addEventListener("pointerdown", (e) => startResize(e, "h"));
    els.rszC.addEventListener("pointerdown", (e) => startResize(e, "c"));
    [els.rszW, els.rszH, els.rszC].forEach((h) =>
      h.addEventListener("dblclick", () => resetPanelSize())
    );

    applySide();
    applyTheme();
    watchPageTheme();
    return els;
  }

  function ensureOverlay() {
    if (!els) buildOverlay();
    return els;
  }

  // ---- Theme: match LeetCode's own light/dark mode --------------------------
  // LeetCode toggles a "dark" class on <html>. If neither "dark" nor "light"
  // is present (e.g. the site changes), fall back to the OS preference.
  function pageIsDark() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) return true;
    if (html.classList.contains("light")) return false;
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) {
      return false;
    }
  }

  function applyTheme() {
    if (!els || !els.ui) return;
    els.ui.classList.toggle("ui--dark", pageIsDark());
  }

  // Re-theme live when the user flips LeetCode's appearance setting.
  function watchPageTheme() {
    try {
      new MutationObserver(() => applyTheme()).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    } catch (e) {
      /* observer is best-effort */
    }
    try {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => applyTheme());
    } catch (e) {
      /* older browsers — ignore */
    }
  }

  function applySide() {
    ensureOverlay();
    const open = els.panel.classList.contains("panel--open");
    els.panel.classList.remove("panel--left", "panel--right");
    els.panel.classList.add(side === "left" ? "panel--left" : "panel--right");
    if (open) els.panel.classList.add("panel--open");
  }

  function flipSide() {
    side = side === "left" ? "right" : "left";
    applySide();
    saveSide(side);
  }

  // Apply a stored width/height (clamped to the current viewport).
  function applySize(w, h) {
    ensureOverlay();
    const maxW = Math.round(window.innerWidth * 0.96);
    const maxH = window.innerHeight - TOP_OFFSET;
    if (w) els.panel.style.width = Math.min(w, maxW) + "px";
    if (h) els.panel.style.height = Math.min(h, maxH) + "px";
  }

  function resetPanelSize() {
    ensureOverlay();
    els.panel.style.width = "";
    els.panel.style.height = "";
    chrome.storage.local
      .remove(["undoomed_panel_w", "undoomed_panel_h"])
      .catch(() => {});
  }

  // Drag a handle: mode "w" (width), "h" (height), or "c" (corner = both).
  function startResize(e, mode) {
    ensureOverlay();
    e.preventDefault();
    const handle = e.currentTarget;
    const rect = els.panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const MIN_W = 320;
    const MIN_H = 260;
    const maxW = Math.round(window.innerWidth * 0.96);
    const maxH = window.innerHeight - TOP_OFFSET;

    try {
      handle.setPointerCapture(e.pointerId);
    } catch (_) {
      /* capture is best-effort */
    }
    document.body.style.userSelect = "none";

    function onMove(ev) {
      if (mode === "w" || mode === "c") {
        // Width grows when dragging the INNER edge away from the pinned side.
        const dw = side === "right" ? startX - ev.clientX : ev.clientX - startX;
        els.panel.style.width = Math.max(MIN_W, Math.min(maxW, Math.round(startW + dw))) + "px";
      }
      if (mode === "h" || mode === "c") {
        els.panel.style.height =
          Math.max(MIN_H, Math.min(maxH, Math.round(startH + (ev.clientY - startY)))) + "px";
      }
    }
    function onUp() {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      document.body.style.userSelect = "";
      const w = parseInt(els.panel.style.width, 10) || startW;
      const h = parseInt(els.panel.style.height, 10) || startH;
      savePanelSize(w, h);
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  function openPanel(open) {
    ensureOverlay();
    els.panel.classList.toggle("panel--open", open);
  }
  function togglePanel() {
    ensureOverlay();
    openPanel(!els.panel.classList.contains("panel--open"));
  }
  function switchTab(which) {
    ensureOverlay();
    const isCurrent = which === "current";
    els.tabCurrent.classList.toggle("tab--active", isCurrent);
    els.tabHistory.classList.toggle("tab--active", !isCurrent);
    els.current.hidden = !isCurrent;
    els.history.hidden = isCurrent;
  }

  // Open the extension's Settings page. A content script can't call
  // chrome.runtime.openOptionsPage() directly, so we ask the service worker.
  function openSettings() {
    try {
      chrome.runtime
        .sendMessage({ type: "UNDOOMED_OPEN_OPTIONS" })
        .catch(() => {});
    } catch (e) {
      /* extension context may be reloading — ignore */
    }
  }

  // Footer label: show which provider + model the next review will use, so the
  // user can see (and change) their setup without leaving the page.
  async function refreshSettingsLabel() {
    ensureOverlay();
    try {
      const s = await chrome.storage.local.get([
        "undoomed_provider",
        "undoomed_model",
      ]);
      const provider = s.undoomed_provider || "openai";
      const model =
        s.undoomed_model && s.undoomed_model.trim()
          ? s.undoomed_model.trim()
          : (DEFAULT_MODELS[provider] || "default");
      els.footModel.textContent = provider + "  " + String.fromCharCode(183) + "  " + model;
      els.footModel.title =
        "Provider: " + provider + " " + String.fromCharCode(183) + " Model: " + model +
        " — click to change in Settings";
    } catch (e) {
      els.footModel.textContent = "Settings";
    }
  }

  function renderMarkdown(target, text) {
    if (window.UndoomedMarkdown) {
      target.innerHTML = window.UndoomedMarkdown.render(text);
    } else {
      target.textContent = text;
      target.style.whiteSpace = "pre-wrap";
    }
  }

  function pillFor(status) {
    if (status === "approved") return ["Approved", "pill pill--approved"];
    if (status === "needs_revision") return ["Needs revision", "pill pill--revision"];
    return ["Pending", "pill pill--neutral"];
  }

  function metaLine(entry) {
    const dot = "  " + String.fromCharCode(183) + "  "; // middle dot
    const bits = [];
    if (entry.language) bits.push(entry.language);
    if (entry.loop_count) bits.push("attempt #" + entry.loop_count);
    if (entry.ts) bits.push(new Date(entry.ts).toLocaleTimeString());
    return bits.join(dot) || "Hints, not answers.";
  }

  function setBusy(busy) {
    ensureOverlay();
    els.reviewBtn.disabled = busy;
    els.reviewBtn.textContent = busy ? "Reviewing..." : "Request Socratic Review";
  }

  function showLoading() {
    ensureOverlay();
    switchTab("current");
    setBusy(true);
    els.pill.hidden = false;
    els.pill.textContent = "Reviewing...";
    els.pill.className = "pill pill--neutral";
    els.meta.textContent = "Talking to your reviewer...";
    els.current.innerHTML =
      '<div class="loading"><span class="spin"></span><span>Reviewing your code...</span></div>';
    openPanel(true);
  }

  function showError(message) {
    ensureOverlay();
    switchTab("current");
    setBusy(false);
    els.pill.hidden = true;
    els.meta.textContent = "Something went wrong";
    renderMarkdown(els.current, "**Review failed.**\n\n" + (message || "Unknown error."));
    openPanel(true);
  }

  function renderEntry(entry, note) {
    ensureOverlay();
    setBusy(false);
    const verdict = pillFor(entry.status);
    els.pill.hidden = false;
    els.pill.textContent = verdict[0];
    els.pill.className = verdict[1];
    els.meta.textContent = metaLine(entry);

    let md = "";
    if (entry.faults && entry.faults.length) {
      md += "#### Edge-case faults found\n";
      md += entry.faults.map((f) => "- " + f).join("\n");
      md += "\n\n";
    }
    md += entry.body || "";
    renderMarkdown(els.current, md);

    // Optional banner (e.g. "no changes since last review"), rendered as text.
    if (note) {
      const banner = document.createElement("div");
      banner.className = "ud-note";
      banner.textContent = note;
      els.current.insertBefore(banner, els.current.firstChild);
    }
  }

  async function refreshHistory(slug) {
    ensureOverlay();
    const list = await loadHistory(slug);

    if (list.length) {
      els.badge.hidden = false;
      els.badge.textContent = String(list.length);
    } else {
      els.badge.hidden = true;
    }

    if (!list.length) {
      els.history.innerHTML = '<p class="empty">No past reviews for this problem yet.</p>';
      return list;
    }

    els.history.innerHTML = "";
    list.forEach((entry, idx) => {
      const verdict = pillFor(entry.status);
      const btn = document.createElement("button");
      btn.className = "hitem";
      const when = entry.ts ? new Date(entry.ts).toLocaleString() : "";
      const dot = " " + String.fromCharCode(183) + " ";
      const sub =
        (entry.language ? entry.language + dot : "") +
        verdict[0] +
        (entry.loop_count ? dot + "attempt #" + entry.loop_count : "");
      btn.innerHTML =
        '<div class="hitem__top"><strong></strong><span class="hitem__when"></span></div>' +
        '<div class="hitem__sub"></div>';
      btn.querySelector("strong").textContent = entry.title || "Review " + (idx + 1);
      btn.querySelector(".hitem__when").textContent = when;
      btn.querySelector(".hitem__sub").textContent = sub;
      btn.addEventListener("click", () => {
        renderEntry(entry);
        switchTab("current");
      });
      els.history.appendChild(btn);
    });
    return list;
  }

  // Ask the service worker to run a review for THIS tab.
  function triggerReview() {
    ensureOverlay();
    showLoading();
    chrome.runtime
      .sendMessage({ type: "UNDOOMED_RUN_REVIEW" })
      .then((res) => {
        // The worker drives the overlay (loading -> result/error). If it failed
        // before pushing an error, surface it here as a fallback.
        if (res && res.ok === false && els.reviewBtn.disabled) {
          showError(res.error);
        }
      })
      .catch(() => showError("Couldn't start the review. Try reloading the page."));
  }

  // -------------------------------------------------------------------------
  // 4. MESSAGE BRIDGE
  // -------------------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;

    if (message.type === "UNDOOMED_SCRAPE") {
      sendResponse({
        task_description: scrapeDescription(),
        current_code: scrapeCodeFromDom(),
        url: location.href,
      });
      return;
    }

    if (message.type === "UNDOOMED_OVERLAY") {
      ensureOverlay();
      if (message.phase === "loading") {
        showLoading();
      } else if (message.phase === "result" && message.entry) {
        renderEntry(message.entry, message.note);
        switchTab("current");
        openPanel(true);
        refreshHistory(currentSlug());
      } else if (message.phase === "error") {
        showError(message.message);
      }
      return;
    }
  });

  // Reflect changes made on the Settings page without a reload.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.undoomed_overlay_side) {
        side = changes.undoomed_overlay_side.newValue === "left" ? "left" : "right";
        applySide();
      }
      // Keep the footer's provider/model label in sync with Settings.
      if (changes.undoomed_provider || changes.undoomed_model) {
        refreshSettingsLabel();
      }
    });
  } catch (e) {
    /* storage events optional */
  }

  // -------------------------------------------------------------------------
  // 5. ON LOAD
  // -------------------------------------------------------------------------
  async function init() {
    side = await loadSide();
    ensureOverlay();
    applySide();
    const size = await loadPanelSize();
    applySize(size.w, size.h);
    refreshSettingsLabel();
    const slug = currentSlug();
    const list = await refreshHistory(slug);
    if (list.length) renderEntry(list[0]); // preload latest (no API call)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
