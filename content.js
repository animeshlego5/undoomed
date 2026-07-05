// =============================================================================
// content.js — Un-Doomed scraper + ON-PAGE controls + results OVERLAY.
// =============================================================================
//
// Runs in the extension's isolated world (shares the page DOM, but cannot touch
// the page's JS globals such as window.monaco). So this file:
//   1. Scrapes the problem description (+ a DOM-only code fallback).
//   2. Draws on-page CONTROLS — a launcher with a "Review" button (request a
//      review without opening the toolbar popup) and a panel toggle.
//   3. Draws the results OVERLAY in a Shadow DOM (so LeetCode's CSS can't bleed
//      in and ours can't leak out). The panel is a FREE-FLOATING window: drag it
//      anywhere by its header, resize from any edge/corner, and its position +
//      size persist. It opens top-right (below LeetCode's bar) by default.
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
  // 2. STORAGE (history + window geometry)
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
  // Window geometry (x, y, w, h) persists so the panel reopens exactly where
  // you left it. Older builds stored only w/h under the same keys — those still
  // load fine (x/y just come back null and fall back to the default corner).
  async function loadWin() {
    try {
      const s = await chrome.storage.local.get([
        "undoomed_panel_x",
        "undoomed_panel_y",
        "undoomed_panel_w",
        "undoomed_panel_h",
      ]);
      return {
        x: typeof s.undoomed_panel_x === "number" ? s.undoomed_panel_x : null,
        y: typeof s.undoomed_panel_y === "number" ? s.undoomed_panel_y : null,
        w: s.undoomed_panel_w || null,
        h: s.undoomed_panel_h || null,
      };
    } catch (e) {
      return { x: null, y: null, w: null, h: null };
    }
  }
  async function saveWin(x, y, w, h) {
    try {
      await chrome.storage.local.set({
        undoomed_panel_x: x,
        undoomed_panel_y: y,
        undoomed_panel_w: w,
        undoomed_panel_h: h,
      });
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
      font: 14px/1.55 "PP Neue Montreal", Arial, sans-serif;
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

    /* Launcher: a split pill — [Un-Doomed | Review] — bottom-right. Lifts on
       hover; a gradient gives the blue some depth. */
    .launch {
      position: fixed; right: 18px; bottom: 18px; z-index: 1;
      display: inline-flex; align-items: stretch; border-radius: 999px;
      overflow: hidden;
      box-shadow: 0 6px 22px rgba(37,99,235,.42), 0 1px 3px rgba(0,0,0,.22);
      transition: box-shadow .2s ease, transform .2s ease;
    }
    .launch:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 30px rgba(37,99,235,.55), 0 2px 6px rgba(0,0,0,.25);
    }
    .launch__toggle, .launch__review {
      appearance: none; border: 0; cursor: pointer; color: #fff;
      font: 600 13px/1 inherit; padding: 11px 15px; display: inline-flex;
      align-items: center; gap: 8px; transition: background .15s ease;
    }
    .launch__toggle { background: var(--accent); }
    .launch__toggle:hover { background: var(--accent-press); }
    .launch__review {
      background: var(--accent-press); border-left: 1px solid rgba(255,255,255,.22);
    }
    .launch__review:hover { background: var(--accent-deep); }
    .launch__toggle:active, .launch__review:active { filter: brightness(.94); }
    .launch__mark { display: inline-flex; flex: 0 0 auto; }
    .launch__bolt { flex: 0 0 auto; opacity: .95; }
    /* History-count badge: how many saved reviews exist for this problem. */
    .launch__badge {
      min-width: 19px; height: 19px; padding: 0 6px; border-radius: 999px;
      background: #fff; color: var(--accent-press); font: 800 11px/1 inherit;
      display: inline-grid; place-items: center; box-shadow: 0 1px 2px rgba(0,0,0,.28);
    }

    /* Panel: a free-floating window. left/top/width/height are all set inline
       by JS — dragged by the header, resized from any edge or corner. */
    .panel {
      position: fixed; z-index: 2; background: var(--surface); color: var(--ink);
      display: flex; flex-direction: column;
      border: 1px solid var(--line); border-radius: 12px;
      box-shadow: 0 18px 50px var(--shadow);
      opacity: 0; visibility: hidden; transform: translateY(8px);
      transition: opacity .18s ease, transform .18s ease;
    }
    .panel--open { opacity: 1; visibility: visible; transform: none; }

    /* The header doubles as the drag handle (buttons inside stay clickable). */
    .phead {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid var(--line);
      cursor: move; user-select: none; touch-action: none;
      border-radius: 12px 12px 0 0;
    }
    .phead button { cursor: pointer; }
    .phead__l { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .mark {
      width: 28px; height: 28px; display: grid; place-items: center; flex: 0 0 auto;
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

    /* drag-to-resize handles — every edge and corner of the window */
    .rsz { position: absolute; z-index: 5; touch-action: none; }
    .rsz-n { top: -4px; left: 12px; right: 12px; height: 9px; cursor: ns-resize; }
    .rsz-s { bottom: -4px; left: 12px; right: 12px; height: 9px; cursor: ns-resize; }
    .rsz-e { right: -4px; top: 12px; bottom: 12px; width: 9px; cursor: ew-resize; }
    .rsz-w { left: -4px; top: 12px; bottom: 12px; width: 9px; cursor: ew-resize; }
    .rsz-ne { top: -5px; right: -5px; width: 18px; height: 18px; cursor: nesw-resize; z-index: 6; }
    .rsz-nw { top: -5px; left: -5px; width: 18px; height: 18px; cursor: nwse-resize; z-index: 6; }
    .rsz-se { bottom: -5px; right: -5px; width: 18px; height: 18px; cursor: nwse-resize; z-index: 6; }
    .rsz-sw { bottom: -5px; left: -5px; width: 18px; height: 18px; cursor: nesw-resize; z-index: 6; }

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
  let placed = false; // has the window been given an initial position/size yet?

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = "undoomed-overlay-host";
    const root = host.attachShadow({ mode: "open" });

    root.innerHTML =
      "<style>" + STYLE + "</style>" +
      '<div class="ui">' +
      '  <div class="launch" id="ud-launch">' +
      '    <button class="launch__toggle" id="ud-toggle" title="Open or close the Un-Doomed panel">' +
      '<span class="launch__mark"><svg width="16" height="16" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M37 16 H50 C73 16 84 31 84 50 C84 69 73 84 50 84 H37 Q28 84 28 75 V25 Q28 16 37 16 Z" style="stroke:#ffffff" stroke-width="8" stroke-linejoin="round"/><path d="M45 27 H58" style="stroke:#ffffff" stroke-width="5.5" stroke-linecap="round"/><circle cx="50.5" cy="71.5" r="4" style="fill:#ffffff"/><path d="M13 31 L91 80" style="stroke:var(--accent)" stroke-width="18" stroke-linecap="round"/><path d="M13 31 L91 80" style="stroke:#ffffff" stroke-width="8" stroke-linecap="round"/></svg></span><span>Un-Doomed</span><span class="launch__badge" id="ud-badge" title="Saved reviews for this problem" aria-label="saved reviews for this problem" hidden></span>' +
      "    </button>" +
      '    <button class="launch__review" id="ud-review-quick" title="Request a Socratic review">' +
      '<svg class="launch__bolt" width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M13 2 L3 14 L12 14 L11 22 L21 10 L12 10 Z"/></svg><span>Review</span>' +
      "    </button>" +
      "  </div>" +
      '  <aside class="panel" id="ud-panel" role="dialog" aria-label="Un-Doomed review">' +
      '    <div class="phead">' +
      '      <div class="phead__l">' +
      '        <div class="mark"><svg width="26" height="26" viewBox="0 0 100 100" fill="none" aria-hidden="true"><path d="M37 16 H50 C73 16 84 31 84 50 C84 69 73 84 50 84 H37 Q28 84 28 75 V25 Q28 16 37 16 Z" style="stroke:var(--accent)" stroke-width="8" stroke-linejoin="round"/><path d="M45 27 H58" style="stroke:var(--accent)" stroke-width="5.5" stroke-linecap="round"/><circle cx="50.5" cy="71.5" r="4" style="fill:var(--accent)"/><path d="M13 31 L91 80" style="stroke:var(--surface)" stroke-width="18" stroke-linecap="round"/><path d="M13 31 L91 80" style="stroke:var(--accent)" stroke-width="8" stroke-linecap="round"/></svg></div>' +
      '        <div style="min-width:0">' +
      '          <div class="pname">Un-Doomed</div>' +
      '          <div class="pmeta" id="ud-meta">Hints, not answers.</div>' +
      "        </div>" +
      "      </div>" +
      '      <div class="phead__r">' +
      '        <span class="pill pill--neutral" id="ud-pill" hidden></span>' +
      '        <button class="iconbtn" id="ud-settings" title="Settings — provider, model, API key">&#9881;</button>' +
      '        <button class="iconbtn iconbtn--x" id="ud-close" title="Close">&times;</button>' +
      "      </div>" +
      "    </div>" +
      '    <div class="actions">' +
      '      <button class="review-btn" id="ud-review" type="button">Request Socratic Review</button>' +
      '      <button class="size-reset" id="ud-reset" type="button" title="Reset size &amp; position (or double-click a resize edge)">&#8690;</button>' +
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
      '    <div class="rsz rsz-n"  data-dir="n"  title="Drag to resize"></div>' +
      '    <div class="rsz rsz-s"  data-dir="s"  title="Drag to resize"></div>' +
      '    <div class="rsz rsz-e"  data-dir="e"  title="Drag to resize"></div>' +
      '    <div class="rsz rsz-w"  data-dir="w"  title="Drag to resize"></div>' +
      '    <div class="rsz rsz-ne" data-dir="ne" title="Drag to resize"></div>' +
      '    <div class="rsz rsz-nw" data-dir="nw" title="Drag to resize"></div>' +
      '    <div class="rsz rsz-se" data-dir="se" title="Drag to resize"></div>' +
      '    <div class="rsz rsz-sw" data-dir="sw" title="Drag to resize"></div>' +
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
      phead: root.querySelector(".phead"),
    };

    root.getElementById("ud-toggle").addEventListener("click", () => togglePanel());
    root.getElementById("ud-review-quick").addEventListener("click", () => triggerReview());
    els.reviewBtn.addEventListener("click", () => triggerReview());
    root.getElementById("ud-close").addEventListener("click", () => openPanel(false));
    root.getElementById("ud-reset").addEventListener("click", () => resetWindow());
    root.getElementById("ud-settings").addEventListener("click", () => openSettings());
    root.getElementById("ud-foot-settings").addEventListener("click", () => openSettings());
    els.tabCurrent.addEventListener("click", () => switchTab("current"));
    els.tabHistory.addEventListener("click", () => switchTab("history"));

    // Drag the whole window by grabbing its header.
    els.phead.addEventListener("pointerdown", (e) => startDrag(e));

    // Resize from any edge or corner; double-click a handle to reset.
    root.querySelectorAll(".rsz").forEach((h) => {
      h.addEventListener("pointerdown", (e) => startResize(e, h.dataset.dir));
      h.addEventListener("dblclick", () => resetWindow());
    });

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

  // ---- Free-floating window: geometry, placement, drag, resize --------------
  const MIN_W = 320;
  const MIN_H = 240;

  // Default corner + size the first time the panel opens (top-right, below
  // LeetCode's bar) — used whenever no stored geometry exists.
  function defaultRect() {
    const w = Math.min(520, Math.max(MIN_W, window.innerWidth - 24));
    const h = Math.max(MIN_H, window.innerHeight - TOP_OFFSET - 16);
    const x = Math.max(12, window.innerWidth - w - 16);
    const y = TOP_OFFSET;
    return { x, y, w, h };
  }

  // Place the window at a given rect (each missing field falls back to the
  // default), clamped so it always stays fully on-screen and grabbable.
  function placeWindow(win) {
    ensureOverlay();
    const d = defaultRect();
    let w = win && win.w ? win.w : d.w;
    let h = win && win.h ? win.h : d.h;
    let x = win && win.x != null ? win.x : d.x;
    let y = win && win.y != null ? win.y : d.y;
    w = Math.max(MIN_W, Math.min(w, window.innerWidth));
    h = Math.max(MIN_H, Math.min(h, window.innerHeight));
    x = Math.max(0, Math.min(x, window.innerWidth - w));
    y = Math.max(0, Math.min(y, window.innerHeight - h));
    els.panel.style.width = Math.round(w) + "px";
    els.panel.style.height = Math.round(h) + "px";
    els.panel.style.left = Math.round(x) + "px";
    els.panel.style.top = Math.round(y) + "px";
    placed = true;
  }

  function saveWinFromPanel() {
    const r = els.panel.getBoundingClientRect();
    saveWin(Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height));
  }

  // Restore the default position AND size — also recovers a window dragged
  // somewhere awkward. Double-clicking any resize handle calls this too.
  function resetWindow() {
    ensureOverlay();
    placeWindow(null);
    chrome.storage.local
      .remove(["undoomed_panel_x", "undoomed_panel_y", "undoomed_panel_w", "undoomed_panel_h"])
      .catch(() => {});
  }

  // Drag the whole window by its header. Ignores drags that start on a button,
  // so the gear / close controls still click normally.
  function startDrag(e) {
    if (e.button != null && e.button !== 0) return; // primary button only
    if (e.target.closest("button")) return;
    ensureOverlay();
    e.preventDefault();
    const rect = els.panel.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    const grip = e.currentTarget;
    try {
      grip.setPointerCapture(e.pointerId);
    } catch (_) {
      /* capture is best-effort */
    }
    document.body.style.userSelect = "none";

    function onMove(ev) {
      const w = els.panel.offsetWidth;
      const h = els.panel.offsetHeight;
      const x = Math.max(0, Math.min(ev.clientX - offX, window.innerWidth - w));
      const y = Math.max(0, Math.min(ev.clientY - offY, window.innerHeight - h));
      els.panel.style.left = Math.round(x) + "px";
      els.panel.style.top = Math.round(y) + "px";
    }
    function onUp() {
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onUp);
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
      document.body.style.userSelect = "";
      saveWinFromPanel();
    }
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
  }

  // Resize from any edge/corner. `dir` is any combination of n/s/e/w; the
  // opposite edge stays pinned, so dragging the top or left also moves x/y.
  function startResize(e, dir) {
    ensureOverlay();
    e.preventDefault();
    const handle = e.currentTarget;
    const rect = els.panel.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const s = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };

    try {
      handle.setPointerCapture(e.pointerId);
    } catch (_) {
      /* capture is best-effort */
    }
    document.body.style.userSelect = "none";

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let x = s.x;
      let y = s.y;
      let w = s.w;
      let h = s.h;
      if (dir.indexOf("e") !== -1) {
        w = Math.max(MIN_W, Math.min(s.w + dx, window.innerWidth - s.x));
      }
      if (dir.indexOf("s") !== -1) {
        h = Math.max(MIN_H, Math.min(s.h + dy, window.innerHeight - s.y));
      }
      if (dir.indexOf("w") !== -1) {
        const right = s.x + s.w;
        x = Math.min(Math.max(0, s.x + dx), right - MIN_W);
        w = right - x;
      }
      if (dir.indexOf("n") !== -1) {
        const bottom = s.y + s.h;
        y = Math.min(Math.max(0, s.y + dy), bottom - MIN_H);
        h = bottom - y;
      }
      els.panel.style.width = Math.round(w) + "px";
      els.panel.style.height = Math.round(h) + "px";
      els.panel.style.left = Math.round(x) + "px";
      els.panel.style.top = Math.round(y) + "px";
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
      saveWinFromPanel();
    }
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  function openPanel(open) {
    ensureOverlay();
    if (open && !placed) placeWindow(null);
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
    ensureOverlay();
    const win = await loadWin();
    placeWindow(win);
    // Re-clamp on browser resize so the window is never stranded off-screen.
    window.addEventListener("resize", () => {
      if (!els || !placed) return;
      const r = els.panel.getBoundingClientRect();
      placeWindow({ x: r.left, y: r.top, w: r.width, h: r.height });
    });
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
