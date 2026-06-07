// =============================================================================
// popup.js — the trigger + brain of the Un-doomed popup panel.
// =============================================================================
//
// Responsibilities:
//   1. Keep a stable per-browser id, and derive a PER-PROBLEM thread_id from it
//      (so loop_count / memory are tracked separately for each LeetCode problem).
//   2. Read the user's full code AND the selected language from Monaco (page
//      MAIN world).
//   3. Ask content.js for the problem description (+ a DOM code fallback).
//   4. POST { task_description, current_code, language, thread_id } to the API.
//   5. Render the response — preferring the roomy ON-PAGE OVERLAY (content.js),
//      and falling back to an inline card in the popup.
//   6. Save every result to a per-problem HISTORY so closing the popup (or
//      reloading the page) never loses an answer — no need to re-submit and burn
//      tokens.
// =============================================================================

"use strict";

// Base URL comes from config.js (the single place to change for production).
const API_BASE_URL =
  (typeof window !== "undefined" && window.UNDOOMED_API_BASE_URL) ||
  "http://127.0.0.1:8000";
const API_URL = API_BASE_URL.replace(/\/+$/, "") + "/api/review";

const HISTORY_LIMIT = 10; // keep the last N reviews per problem

// ---- DOM references ---------------------------------------------------------
const btn = document.getElementById("review-btn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLabel = document.getElementById("result-label");
const statusPill = document.getElementById("status-pill");
const resultBody = document.getElementById("result-body");
const threadEl = document.getElementById("thread");

// ---- problem identity -------------------------------------------------------
// LeetCode problem URLs look like https://leetcode.com/problems/<slug>/...
function slugFromUrl(url) {
  const m = /leetcode\.com\/problems\/([^/?#]+)/.exec(url || "");
  return m ? m[1] : "";
}

// A stable per-browser prefix, created once, kept in storage.
async function getProfilePrefix() {
  const stored = await chrome.storage.local.get("undoomed_thread_id");
  if (stored.undoomed_thread_id) return stored.undoomed_thread_id;
  const id =
    "student_" +
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + "_" + Math.random().toString(16).slice(2));
  await chrome.storage.local.set({ undoomed_thread_id: id });
  return id;
}

// Per-problem thread id: <profile>__<slug>. Each problem keeps its own
// loop_count / escalation state on the backend.
async function getThreadId(slug) {
  const prefix = await getProfilePrefix();
  return slug ? prefix + "__" + slug : prefix;
}

function historyKey(slug) {
  return "undoomed_history__" + (slug || "unknown");
}

async function saveHistory(slug, entry) {
  const key = historyKey(slug);
  const stored = await chrome.storage.local.get(key);
  const list = Array.isArray(stored[key]) ? stored[key] : [];
  list.unshift(entry); // newest first
  await chrome.storage.local.set({ [key]: list.slice(0, HISTORY_LIMIT) });
}

// ---- provider settings: chosen in the Settings (options) page ---------------
async function getSettings() {
  const saved = await chrome.storage.local.get([
    "undoomed_provider",
    "undoomed_model",
    "undoomed_api_key",
    "undoomed_server_secret",
    "undoomed_overlay_enabled",
  ]);
  return {
    provider: saved.undoomed_provider || "openai",
    model: saved.undoomed_model || "",
    api_key: saved.undoomed_api_key || "",
    server_secret: saved.undoomed_server_secret || "",
    // Default ON: the on-page overlay is the better reading experience.
    overlay: saved.undoomed_overlay_enabled !== false,
  };
}

// ---- small UI helpers -------------------------------------------------------
function setStatus(text, isError = false) {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("status--error", Boolean(isError));
}

// Inline (in-popup) rendering — used when the overlay is disabled or the page
// isn't reachable. Renders Markdown via the shared md.js renderer.
function showResultInline(label, pillText, pillClass, markdown) {
  resultLabel.textContent = label;
  statusPill.textContent = pillText;
  statusPill.className = "pill " + pillClass;
  if (window.UndoomedMarkdown) {
    resultBody.innerHTML = window.UndoomedMarkdown.render(markdown);
  } else {
    resultBody.textContent = markdown; // safe fallback if md.js failed to load
  }
  resultEl.hidden = false;
}

// Try to hand a payload to the on-page overlay (content.js). Returns true on
// success, false if the content script couldn't be reached.
async function sendToOverlay(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return true;
  } catch (err) {
    // Content script not present (e.g. tab opened before install). Inject, retry.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["md.js", "content.js"],
      });
      await chrome.tabs.sendMessage(tabId, message);
      return true;
    } catch (_) {
      return false;
    }
  }
}

/**
 * Runs INSIDE the page's MAIN world (injected by chrome.scripting), so it can
 * touch `window.monaco` directly. Fully self-contained — no outer-scope refs.
 * Returns { code, language } (language is Monaco's id, e.g. "java"/"python").
 */
function readMonacoCodeAndLang() {
  try {
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels().filter((m) => {
        try {
          return typeof m.getValue() === "string" && m.getValue().trim().length;
        } catch (e) {
          return false;
        }
      });
      if (models.length) {
        // The solution editor holds the longest non-empty text.
        models.sort((a, b) => b.getValue().length - a.getValue().length);
        const model = models[0];
        let language = "";
        try {
          language = model.getLanguageId ? model.getLanguageId() : "";
        } catch (e) {
          /* leave blank */
        }
        return { code: model.getValue(), language: language || "" };
      }
    }
  } catch (err) {
    /* fall through */
  }
  return { code: "", language: "" };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Collect description (content.js) + code & language (Monaco, MAIN world).
 */
async function scrape(tab) {
  let monaco = { code: "", language: "" };
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readMonacoCodeAndLang,
    });
    monaco = (injection && injection.result) || monaco;
  } catch (err) {
    /* DOM fallback below */
  }

  let scraped = {};
  try {
    scraped =
      (await chrome.tabs.sendMessage(tab.id, { type: "UNDOOMED_SCRAPE" })) || {};
  } catch (err) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["md.js", "content.js"],
    });
    scraped =
      (await chrome.tabs.sendMessage(tab.id, { type: "UNDOOMED_SCRAPE" })) || {};
  }

  return {
    task_description: scraped.task_description || "",
    current_code: monaco.code && monaco.code.trim() ? monaco.code : scraped.current_code || "",
    language: monaco.language || "",
  };
}

// ---- main action ------------------------------------------------------------
async function requestReview() {
  resultEl.hidden = true;
  btn.disabled = true;

  let tab;
  try {
    tab = await getActiveTab();
    if (!tab || !/^https:\/\/leetcode\.com\/problems\//.test(tab.url || "")) {
      setStatus("Open a LeetCode problem page, then try again.", true);
      return;
    }

    const settings = await getSettings();
    if (!settings.api_key) {
      setStatus("Add your AI provider and API key in Settings (⚙), then retry.", true);
      return;
    }

    const slug = slugFromUrl(tab.url);

    setStatus("Reading the problem and your code…");
    const { task_description, current_code, language } = await scrape(tab);

    if (!current_code.trim()) {
      setStatus("Couldn't read your code from the editor. Write some code and retry.", true);
      return;
    }

    const thread_id = await getThreadId(slug);

    // Open the overlay in a loading state right away (if enabled).
    if (settings.overlay) {
      await sendToOverlay(tab.id, { type: "UNDOOMED_OVERLAY", phase: "loading" });
    }
    setStatus("Sending to your Un-doomed reviewer…");

    const headers = { "Content-Type": "application/json" };
    if (settings.server_secret) headers["X-Server-Secret"] = settings.server_secret;

    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task_description,
        current_code,
        language,
        thread_id,
        provider: settings.provider,
        model: settings.model,
        api_key: settings.api_key,
      }),
    });

    if (!response.ok) {
      let detail = "Server responded " + response.status + ".";
      try {
        const body = await response.json();
        if (body && body.detail) detail = body.detail;
      } catch (_) {
        /* keep the status-code message */
      }
      setStatus(detail, true);
      if (settings.overlay) {
        await sendToOverlay(tab.id, {
          type: "UNDOOMED_OVERLAY",
          phase: "error",
          message: detail,
        });
      }
      return;
    }

    const data = await response.json();
    setStatus("");

    const approved = data.status === "approved";
    const body = approved
      ? data.style_feedback || "Your logic is clean. Nice work!"
      : data.socratic_hints || "No hints were returned.";

    // Build a history entry and persist it (survives popup close & page reload).
    const title = (task_description.split("\n")[0] || slug).trim();
    const entry = {
      ts: Date.now(),
      slug,
      title,
      language,
      status: data.status,
      loop_count: data.loop_count || 0,
      faults: data.edge_case_faults || [],
      body,
    };
    await saveHistory(slug, entry);

    // Render: overlay first, else inline.
    let shown = false;
    if (settings.overlay) {
      shown = await sendToOverlay(tab.id, {
        type: "UNDOOMED_OVERLAY",
        phase: "result",
        entry,
      });
      if (shown) setStatus("Shown on the page — see the Un-doomed panel →");
    }
    if (!shown) {
      showResultInline(
        approved ? "Style Review" : "Socratic Hints",
        approved ? "Approved" : "Needs revision",
        approved ? "pill--approved" : "pill--revision",
        body
      );
    }
  } catch (err) {
    setStatus(
      "Couldn't reach the Un-doomed API at " + API_BASE_URL +
        ". Is the server running? (" + err.message + ")",
      true
    );
    if (tab && tab.id) {
      const s = await getSettings();
      if (s.overlay) {
        await sendToOverlay(tab.id, {
          type: "UNDOOMED_OVERLAY",
          phase: "error",
          message: "Couldn't reach the Un-doomed API at " + API_BASE_URL + ".",
        });
      }
    }
  } finally {
    btn.disabled = false;
  }
}

// ---- wire up ----------------------------------------------------------------
btn.addEventListener("click", requestReview);

document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Footer: show the per-problem thread id for the active tab (transparency).
(async () => {
  const tab = await getActiveTab();
  const slug = slugFromUrl(tab && tab.url);
  threadEl.textContent = await getThreadId(slug);
})();

// On first open with nothing configured yet, nudge toward Settings.
getSettings().then((s) => {
  if (!s.api_key) {
    setStatus("First time? Set your AI provider + API key in Settings (⚙).");
  }
});
