// =============================================================================
// content.js — Un-doomed scraper + ON-PAGE OVERLAY, injected into LeetCode.
// =============================================================================
//
// Runs in the extension's "isolated world": it shares the page DOM but cannot
// see the page's JS globals (most importantly `window.monaco`). So:
//   * The reliable full-code + language read happens in popup.js via
//     chrome.scripting in the MAIN world.
//   * This file provides:
//       1. The problem description (pure DOM) + a DOM-only code fallback.
//       2. A roomy, readable RESULTS OVERLAY rendered in a Shadow DOM (so
//          LeetCode's CSS can't bleed in and ours can't leak out).
//       3. PER-PROBLEM HISTORY: results are cached in chrome.storage.local, so
//          closing the popup or reloading the page never loses an answer — the
//          user can reopen past reviews without re-submitting (saving tokens).
//
// Messages handled (from popup.js):
//   { type: "UNDOOMED_SCRAPE" }                       -> returns page data
//   { type: "UNDOOMED_OVERLAY", phase: "loading" }    -> open overlay, spinner
//   { type: "UNDOOMED_OVERLAY", phase: "result", entry } -> render + refresh
//   { type: "UNDOOMED_OVERLAY", phase: "error", message }-> show error
// =============================================================================

(function () {
  "use strict";

  // Guard: the manifest declares this script AND popup.js may inject it as a
  // fallback. Running the setup twice would duplicate the UI and listeners.
  if (window.__undoomedContentLoaded) return;
  window.__undoomedContentLoaded = true;

  // -------------------------------------------------------------------------
  // 1. SCRAPING (description + DOM code fallback)
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
    const body = firstText([
      "[data-track-load='description_content']",
      "div.elfjS",
      "[data-cy='question-content']",
      ".question-content__JfgR",
      ".content__u3I1",
    ]);
    if (title && body) return title + "\n\n" + body;
    return body || title || "";
  }

  function scrapeCodeFromDom() {
    const lines = Array.from(document.querySelectorAll(".view-line"));
    if (!lines.length) return "";
    lines.sort(
      (a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0)
    );
    return lines
      .map((line) => line.innerText.replace(/\u00a0/g, " "))
      .join("\n")
      .trim();
  }

  // -------------------------------------------------------------------------
  // 2. PROBLEM IDENTITY + HISTORY STORAGE
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

  // -------------------------------------------------------------------------
  // 3. THE OVERLAY (Shadow DOM)
  // -------------------------------------------------------------------------
  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .launch {
      position: fixed; right: 18px; bottom: 18px; z-index: 1;
      display: inline-flex; align-items: center; gap: 8px;
      padding: 10px 14px; border: 0; border-radius: 999px; cursor: pointer;
      background: #4f46e5; color: #fff; font: 600 13px/1 -apple-system,
        BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 6px 20px rgba(79,70,229,.35);
    }
    .launch:hover { background: #4338ca; }
    .launch__badge {
      min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
      background: #fff; color: #4f46e5; font-size: 10px; font-weight: 700;
      display: inline-grid; place-items: center;
    }
    .panel {
      position: fixed; top: 0; right: 0; height: 100vh; width: min(440px, 94vw);
      background: #fff; color: #1c1c28; z-index: 2;
      display: flex; flex-direction: column;
      box-shadow: -12px 0 40px rgba(20,20,40,.18);
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
      transform: translateX(100%); transition: transform .22s ease;
    }
    .panel--open { transform: translateX(0); }
    .phead {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid #ececf1;
    }
    .phead__l { display: flex; align-items: center; gap: 10px; }
    .mark {
      width: 30px; height: 30px; border-radius: 8px; background: #4f46e5;
      color: #fff; display: grid; place-items: center; font-size: 16px; font-weight: 700;
    }
    .pname { font-size: 15px; font-weight: 650; }
    .pmeta { font-size: 11.5px; color: #6b7280; }
    .phead__r { display: flex; align-items: center; gap: 8px; }
    .pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
    .pill--revision { background: #fff7ed; color: #b45309; }
    .pill--approved { background: #ecfdf5; color: #16a34a; }
    .pill--neutral { background: #eef2ff; color: #4f46e5; }
    .iconbtn {
      appearance: none; border: 0; background: none; cursor: pointer;
      font-size: 20px; line-height: 1; color: #6b7280; padding: 2px 6px; border-radius: 6px;
    }
    .iconbtn:hover { background: #f1f1f5; color: #1c1c28; }
    .tabs { display: flex; gap: 4px; padding: 8px 12px 0; border-bottom: 1px solid #ececf1; }
    .tab {
      appearance: none; border: 0; background: none; cursor: pointer;
      padding: 8px 12px; font-size: 13px; font-weight: 600; color: #6b7280;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab--active { color: #4f46e5; border-bottom-color: #4f46e5; }
    .body { flex: 1; overflow: auto; padding: 16px; }
    .empty { color: #6b7280; font-size: 13px; text-align: center; margin-top: 40px; }

    /* spinner */
    .loading { display: flex; align-items: center; gap: 10px; color: #6b7280; margin-top: 30px; justify-content: center; }
    .spin { width: 18px; height: 18px; border: 2px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: ud-spin .8s linear infinite; }
    @keyframes ud-spin { to { transform: rotate(360deg); } }

    /* history list */
    .hitem {
      width: 100%; text-align: left; appearance: none; cursor: pointer;
      border: 1px solid #ececf1; background: #fff; border-radius: 10px;
      padding: 10px 12px; margin-bottom: 8px; display: block;
    }
    .hitem:hover { border-color: #c7c9d6; background: #fafafe; }
    .hitem__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .hitem__when { font-size: 11px; color: #9ca3af; }
    .hitem__sub { font-size: 12px; color: #6b7280; margin-top: 3px; }

    /* rendered markdown */
    .md .ud-h { margin: 14px 0 6px; line-height: 1.3; }
    .md h1.ud-h { font-size: 18px; } .md h2.ud-h { font-size: 16px; }
    .md h3.ud-h { font-size: 14.5px; } .md h4.ud-h, .md h5.ud-h, .md h6.ud-h { font-size: 13.5px; }
    .md .ud-p { margin: 8px 0; }
    .md .ud-list { margin: 8px 0; padding-left: 22px; }
    .md .ud-list li { margin: 3px 0; }
    .md .ud-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px;
      background: #f1f1f5; padding: 1px 5px; border-radius: 5px;
    }
    .md .ud-pre {
      background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 12px 14px;
      overflow: auto; margin: 10px 0;
    }
    .md .ud-pre code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: none; padding: 0; }
    .md .ud-hr { border: 0; border-top: 1px solid #ececf1; margin: 14px 0; }
    .md a { color: #4f46e5; }
    .md strong { font-weight: 650; }
  `;

  let els = null; // cached references inside the shadow root

  function buildOverlay() {
    const host = document.createElement("div");
    host.id = "undoomed-overlay-host";
    const root = host.attachShadow({ mode: "open" });

    root.innerHTML = `
      <style>${STYLE}</style>
      <button class="launch" id="ud-launch" title="Open Un-doomed">
        <span>⏻ Un-doomed</span><span class="launch__badge" id="ud-badge" hidden></span>
      </button>
      <aside class="panel" id="ud-panel" role="dialog" aria-label="Un-doomed review">
        <div class="phead">
          <div class="phead__l">
            <div class="mark">⏻</div>
            <div>
              <div class="pname">Un-doomed</div>
              <div class="pmeta" id="ud-meta">Hints, not answers.</div>
            </div>
          </div>
          <div class="phead__r">
            <span class="pill pill--neutral" id="ud-pill" hidden></span>
            <button class="iconbtn" id="ud-close" title="Close">&times;</button>
          </div>
        </div>
        <nav class="tabs">
          <button class="tab tab--active" id="ud-tab-current" data-tab="current">Current</button>
          <button class="tab" id="ud-tab-history" data-tab="history">History</button>
        </nav>
        <section class="body">
          <div class="md" id="ud-current"><p class="empty">Click “Request Socratic Review” in the Un-doomed popup to get hints here.</p></div>
          <div id="ud-history" hidden></div>
        </section>
      </aside>
    `;

    (document.documentElement || document.body).appendChild(host);

    els = {
      host,
      root,
      launch: root.getElementById("ud-launch"),
      badge: root.getElementById("ud-badge"),
      panel: root.getElementById("ud-panel"),
      meta: root.getElementById("ud-meta"),
      pill: root.getElementById("ud-pill"),
      close: root.getElementById("ud-close"),
      tabCurrent: root.getElementById("ud-tab-current"),
      tabHistory: root.getElementById("ud-tab-history"),
      current: root.getElementById("ud-current"),
      history: root.getElementById("ud-history"),
    };

    els.launch.addEventListener("click", () => togglePanel());
    els.close.addEventListener("click", () => openPanel(false));
    els.tabCurrent.addEventListener("click", () => switchTab("current"));
    els.tabHistory.addEventListener("click", () => switchTab("history"));

    return els;
  }

  function ensureOverlay() {
    if (!els) buildOverlay();
    return els;
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

  function renderMarkdown(target, text) {
    if (window.UndoomedMarkdown) {
      target.innerHTML = window.UndoomedMarkdown.render(text);
    } else {
      target.textContent = text; // safe fallback
      target.style.whiteSpace = "pre-wrap";
    }
  }

  function pillFor(status) {
    if (status === "approved") return ["Approved", "pill pill--approved"];
    if (status === "needs_revision") return ["Needs revision", "pill pill--revision"];
    return ["Pending", "pill pill--neutral"];
  }

  function metaLine(entry) {
    const bits = [];
    if (entry.language) bits.push(entry.language);
    if (entry.loop_count) bits.push("attempt #" + entry.loop_count);
    if (entry.ts) bits.push(new Date(entry.ts).toLocaleTimeString());
    return bits.join("  ·  ") || "Hints, not answers.";
  }

  function showLoading() {
    ensureOverlay();
    switchTab("current");
    els.pill.hidden = false;
    els.pill.textContent = "Reviewing…";
    els.pill.className = "pill pill--neutral";
    els.meta.textContent = "Talking to your reviewer…";
    els.current.innerHTML =
      '<div class="loading"><span class="spin"></span><span>Reviewing your code…</span></div>';
    openPanel(true);
  }

  function showError(message) {
    ensureOverlay();
    switchTab("current");
    els.pill.hidden = true;
    els.meta.textContent = "Something went wrong";
    renderMarkdown(els.current, "**Review failed.**\n\n" + (message || "Unknown error."));
    openPanel(true);
  }

  function renderEntry(entry) {
    ensureOverlay();
    const [pillText, pillClass] = pillFor(entry.status);
    els.pill.hidden = false;
    els.pill.textContent = pillText;
    els.pill.className = pillClass;
    els.meta.textContent = metaLine(entry);

    let md = "";
    if (entry.faults && entry.faults.length) {
      md += "#### Edge-case faults found\n";
      md += entry.faults.map((f) => "- " + f).join("\n");
      md += "\n\n";
    }
    md += entry.body || "";
    renderMarkdown(els.current, md);
  }

  async function refreshHistory(slug) {
    ensureOverlay();
    const list = await loadHistory(slug);

    // Badge on the launch button = number of cached reviews for this problem.
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
      const [pillText] = pillFor(entry.status);
      const btn = document.createElement("button");
      btn.className = "hitem";
      const when = entry.ts ? new Date(entry.ts).toLocaleString() : "";
      const sub =
        (entry.language ? entry.language + " · " : "") +
        pillText +
        (entry.loop_count ? " · attempt #" + entry.loop_count : "");
      // textContent for the dynamic bits (no injection); fixed structure here.
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
      return; // synchronous response already sent
    }

    if (message.type === "UNDOOMED_OVERLAY") {
      ensureOverlay();
      if (message.phase === "loading") {
        showLoading();
      } else if (message.phase === "result" && message.entry) {
        renderEntry(message.entry);
        switchTab("current");
        openPanel(true);
        refreshHistory(currentSlug());
      } else if (message.phase === "error") {
        showError(message.message);
      }
      return;
    }
  });

  // -------------------------------------------------------------------------
  // 5. ON LOAD: build the launcher and preload cached history (no API call)
  // -------------------------------------------------------------------------
  function init() {
    ensureOverlay();
    const slug = currentSlug();
    refreshHistory(slug).then((list) => {
      if (list.length) {
        // Preload the most recent review into the Current tab so reopening the
        // panel after a reload shows the last answer instantly — no re-submit.
        renderEntry(list[0]);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
