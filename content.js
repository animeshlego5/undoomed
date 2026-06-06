// =============================================================================
// content.js — Un-doomed scraper, injected into LeetCode problem pages.
// =============================================================================
//
// This script runs in the extension's "isolated world": it shares the page's
// DOM (so it can read the visible HTML) but it CANNOT see the page's own
// JavaScript globals — most importantly `window.monaco`, the editor engine.
//
// Because of that limitation, the *reliable* full-code read is performed by
// popup.js using chrome.scripting in the page's MAIN world. This file is
// responsible for:
//   1. The problem description text (pure DOM — easy and reliable here).
//   2. A best-effort DOM-only fallback for the code (used only if the MAIN
//      world read fails for some reason).
//
// popup.js asks for this data by sending a {type: "UNDOOMED_SCRAPE"} message.
// =============================================================================

(function () {
  "use strict";

  /**
   * Return the trimmed innerText of the first selector that matches and has
   * non-empty text. LeetCode rewrites its CSS class names often, so we try a
   * list of candidates from most-stable to least-stable.
   */
  function firstText(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim()) {
        return el.innerText.trim();
      }
    }
    return "";
  }

  /** Grab the problem title + statement and combine them into one string. */
  function scrapeDescription() {
    const title = firstText([
      "a[href^='/problems/'].truncate", // current sidebar/title link
      ".text-title-large a",
      "div.text-title-large",
      "[data-cy='question-title']", // older layout
    ]);

    const body = firstText([
      "[data-track-load='description_content']", // stable data attribute
      "div.elfjS", // current (obfuscated) statement container
      "[data-cy='question-content']", // older layout
      ".question-content__JfgR",
      ".content__u3I1",
    ]);

    if (title && body) return title + "\n\n" + body;
    return body || title || "";
  }

  /**
   * DOM-only fallback for the user's code.
   *
   * Monaco renders each visible line as a `.view-line` element, but it
   * "virtualizes" the editor — only the lines currently on screen exist in the
   * DOM. So this can MISS code that is scrolled out of view. That's why it is a
   * fallback only; popup.js gets the complete, accurate code straight from
   * Monaco's in-memory model in the MAIN world.
   */
  function scrapeCodeFromDom() {
    const lines = Array.from(document.querySelectorAll(".view-line"));
    if (!lines.length) return "";

    // Monaco positions lines with an inline `top` pixel value rather than DOM
    // order, so sort by it to reconstruct the correct top-to-bottom sequence.
    lines.sort(
      (a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0)
    );

    return lines
      .map((line) => line.innerText.replace(/\u00a0/g, " ")) // nbsp -> space
      .join("\n")
      .trim();
  }

  // ---- Message bridge: popup.js -> here -> popup.js --------------------------
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "UNDOOMED_SCRAPE") return;

    sendResponse({
      task_description: scrapeDescription(),
      current_code: scrapeCodeFromDom(),
      url: location.href,
    });
    // Everything above is synchronous, so the response is already sent.
  });
})();
