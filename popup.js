// =============================================================================
// popup.js — the toolbar popup: a thin trigger for a review.
// =============================================================================
//
// The heavy lifting (read code + language from Monaco, scrape, fetch, save
// history, render) lives in the service worker (background.js) and the on-page
// overlay (content.js). This popup just:
//   1. Checks you're on a LeetCode problem and have an API key set.
//   2. Asks the service worker to run a review on the active tab.
//   3. Points you at the on-page panel, where results appear and persist.
//
// You can also start a review entirely on-page via the "Review" button on the
// floating launcher — the popup is just one of two entry points.
// =============================================================================

"use strict";

const btn = document.getElementById("review-btn");
const statusEl = document.getElementById("status");
const threadEl = document.getElementById("thread");

function slugFromUrl(url) {
  const m = /leetcode\.com\/problems\/([^/?#]+)/.exec(url || "");
  return m ? m[1] : "";
}

function setStatus(text, isError = false) {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("status--error", Boolean(isError));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function hasApiKey() {
  const s = await chrome.storage.local.get("undoomed_api_key");
  return Boolean(s.undoomed_api_key);
}

async function requestReview() {
  btn.disabled = true;
  try {
    const tab = await getActiveTab();
    if (!tab || !/^https:\/\/leetcode\.com\/problems\//.test(tab.url || "")) {
      setStatus("Open a LeetCode problem page, then try again.", true);
      return;
    }
    if (!(await hasApiKey())) {
      setStatus("Add your AI provider and API key in Settings (⚙), then retry.", true);
      return;
    }

    setStatus("Starting your review…");
    const res = await chrome.runtime.sendMessage({
      type: "UNDOOMED_RUN_REVIEW",
      tabId: tab.id,
      tabUrl: tab.url,
    });

    if (res && res.ok && res.unchanged) {
      setStatus("No code changes — showing your last review on the page →");
    } else if (res && res.ok) {
      setStatus("Done — see the Un-doomed panel on the page →");
    } else if (res && res.error) {
      setStatus(res.error, true);
    } else {
      setStatus("Review started — see the Un-doomed panel on the page →");
    }
  } catch (err) {
    setStatus("Couldn't start the review: " + err.message, true);
  } finally {
    btn.disabled = false;
  }
}

btn.addEventListener("click", requestReview);

document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Footer: show the current problem (short + readable), not the raw thread id.
(async () => {
  const tab = await getActiveTab();
  const slug = slugFromUrl(tab && tab.url);
  threadEl.textContent = slug ? slug : "";
  threadEl.title = slug ? "Reviews + history are saved per problem" : "";
})();

// Nudge first-time users toward Settings.
hasApiKey().then((ok) => {
  if (!ok) setStatus("First time? Set your AI provider + API key in Settings (⚙).");
});
