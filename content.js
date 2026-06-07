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

  // -------------------------------------------------------------------------
  // 3. OVERLAY (Shadow DOM)
  // -------------------------------------------------------------------------
  const TOP_OFFSET = 56; // clears LeetCode's top navigation bar

  const STYLE = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .ui {
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
        Helvetica, Arial, sans-serif;
    }

    /* Launcher: a split pill — [toggle | Review] — bottom-right. */
    .launch {
      position: fixed; right: 18px; bottom: 18px; z-index: 1;
      display: inline-flex; align-items: stretch; border-radius: 999px;
      overflow: hidden; box-shadow: 0 6px 20px rgba(79,70,229,.35);
    }
    .launch__toggle, .launch__review {
      appearance: none; border: 0; cursor: pointer; color: #fff;
      font: 600 13px/1 inherit; padding: 11px 14px; display: inline-flex;
      align-items: center; gap: 7px;
    }
    .launch__toggle { background: #4f46e5; }
    .launch__toggle:hover { background: #4338ca; }
    .launch__review { background: #4338ca; border-left: 1px solid rgba(255,255,255,.25); }
    .launch__review:hover { background: #3730a3; }
    .launch__badge {
      min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px;
      background: #fff; color: #4f46e5; font-size: 10px; font-weight: 700;
      display: inline-grid; place-items: center;
    }

    /* Panel: a drawer on the left OR right, below the top bar. */
    .panel {
      position: fixed; top: ${TOP_OFFSET}px; height: calc(100vh - ${TOP_OFFSET}px);
      width: min(420px, 92vw); background: #fff; color: #1c1c28; z-index: 2;
      display: flex; flex-direction: column; transition: transform .22s ease;
    }
    .panel--right { right: 0; box-shadow: -12px 0 40px rgba(20,20,40,.18); transform: translateX(100%); }
    .panel--left  { left: 0;  box-shadow: 12px 0 40px rgba(20,20,40,.18);  transform: translateX(-100%); }
    .panel--open { transform: translateX(0); }

    .phead {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-bottom: 1px solid #ececf1;
    }
    .phead__l { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .mark {
      width: 28px; height: 28px; border-radius: 8px; background: #4f46e5;
      color: #fff; display: grid; place-items: center; font-size: 15px; font-weight: 700; flex: 0 0 auto;
    }
    .pname { font-size: 14.5px; font-weight: 650; }
    .pmeta { font-size: 11.5px; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .phead__r { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
    .pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
    .pill--revision { background: #fff7ed; color: #b45309; }
    .pill--approved { background: #ecfdf5; color: #16a34a; }
    .pill--neutral { background: #eef2ff; color: #4f46e5; }
    .iconbtn {
      appearance: none; border: 0; background: none; cursor: pointer;
      font-size: 16px; line-height: 1; color: #6b7280; padding: 4px 7px; border-radius: 6px;
    }
    .iconbtn:hover { background: #f1f1f5; color: #1c1c28; }
    .iconbtn--x { font-size: 20px; }

    .actions { padding: 12px 14px; border-bottom: 1px solid #ececf1; }
    .review-btn {
      appearance: none; border: 0; cursor: pointer; width: 100%; padding: 10px 14px;
      background: #4f46e5; color: #fff; font: 600 14px/1 inherit; border-radius: 10px;
    }
    .review-btn:hover { background: #4338ca; }
    .review-btn:disabled { opacity: .6; cursor: progress; }

    .tabs { display: flex; gap: 4px; padding: 6px 12px 0; border-bottom: 1px solid #ececf1; }
    .tab {
      appearance: none; border: 0; background: none; cursor: pointer;
      padding: 8px 12px; font: 600 13px/1 inherit; color: #6b7280;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
    }
    .tab--active { color: #4f46e5; border-bottom-color: #4f46e5; }
    .body { flex: 1; overflow: auto; padding: 16px; }
    .empty { color: #6b7280; font-size: 13px; text-align: center; margin-top: 36px; }

    .loading { display: flex; align-items: center; gap: 10px; color: #6b7280; margin-top: 30px; justify-content: center; }
    .spin { width: 18px; height: 18px; border: 2px solid #e5e7eb; border-top-color: #4f46e5; border-radius: 50%; animation: ud-spin .8s linear infinite; }
    @keyframes ud-spin { to { transform: rotate(360deg); } }

    .hitem {
      width: 100%; text-align: left; appearance: none; cursor: pointer;
      border: 1px solid #ececf1; background: #fff; border-radius: 10px;
      padding: 10px 12px; margin-bottom: 8px; display: block; font: inherit;
    }
    .hitem:hover { border-color: #c7c9d6; background: #fafafe; }
    .hitem__top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .hitem__when { font-size: 11px; color: #9ca3af; }
    .hitem__sub { font-size: 12px; color: #6b7280; margin-top: 3px; }

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
      '        <button class="iconbtn" id="ud-flip" title="Move to the other side">&#8646;</button>' +
      '        <button class="iconbtn iconbtn--x" id="ud-close" title="Close">&times;</button>' +
      "      </div>" +
      "    </div>" +
      '    <div class="actions">' +
      '      <button class="review-btn" id="ud-review" type="button">Request Socratic Review</button>' +
      "    </div>" +
      '    <nav class="tabs">' +
      '      <button class="tab tab--active" id="ud-tab-current" data-tab="current">Current</button>' +
      '      <button class="tab" id="ud-tab-history" data-tab="history">History</button>' +
      "    </nav>" +
      '    <section class="body">' +
      '      <div class="md" id="ud-current"><p class="empty">Click "Request Socratic Review" to get hints here.</p></div>' +
      '      <div id="ud-history" hidden></div>' +
      "    </section>" +
      "  </aside>" +
      "</div>";

    (document.documentElement || document.body).appendChild(host);

    els = {
      host,
      root,
      panel: root.getElementById("ud-panel"),
      badge: root.getElementById("ud-badge"),
      meta: root.getElementById("ud-meta"),
      pill: root.getElementById("ud-pill"),
      current: root.getElementById("ud-current"),
      history: root.getElementById("ud-history"),
      tabCurrent: root.getElementById("ud-tab-current"),
      tabHistory: root.getElementById("ud-tab-history"),
      reviewBtn: root.getElementById("ud-review"),
    };

    root.getElementById("ud-toggle").addEventListener("click", () => togglePanel());
    root.getElementById("ud-review-quick").addEventListener("click", () => triggerReview());
    els.reviewBtn.addEventListener("click", () => triggerReview());
    root.getElementById("ud-close").addEventListener("click", () => openPanel(false));
    root.getElementById("ud-flip").addEventListener("click", () => flipSide());
    els.tabCurrent.addEventListener("click", () => switchTab("current"));
    els.tabHistory.addEventListener("click", () => switchTab("history"));

    applySide();
    return els;
  }

  function ensureOverlay() {
    if (!els) buildOverlay();
    return els;
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

  function renderEntry(entry) {
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

  // Reflect a position change made on the Settings page without a reload.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.undoomed_overlay_side) {
        side = changes.undoomed_overlay_side.newValue === "left" ? "left" : "right";
        applySide();
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
