// =============================================================================
// background.js — Un-doomed MV3 service worker (the review engine).
// =============================================================================
//
// Why this exists
// ---------------
// Both the toolbar popup AND the on-page buttons (in content.js) need to run a
// review, which means: read the full code + language from Monaco (MAIN world),
// scrape the description, read the user's settings, and POST to the backend.
//
// In Manifest V3 a *content script* can't do a cross-origin fetch with the
// extension's privileges (it's bound by the page's CORS), and it can't reach
// `window.monaco` without MAIN-world injection. A service worker can do BOTH
// (chrome.scripting + privileged fetch). So all review logic lives here once,
// and every UI surface just sends one message:
//
//     chrome.runtime.sendMessage({ type: "UNDOOMED_RUN_REVIEW" })
//
// The worker drives the on-page overlay (content.js) through its lifecycle:
// loading -> result | error, and saves the result to per-problem history.
// =============================================================================

"use strict";

// Single source of truth for the backend URL (same file the pages load).
try {
  importScripts("config.js");
} catch (e) {
  /* fall back to the default below */
}
const API_BASE_URL =
  (typeof globalThis !== "undefined" && globalThis.UNDOOMED_API_BASE_URL) ||
  "https://undoomed.onrender.com";
const API_URL = API_BASE_URL.replace(/\/+$/, "") + "/api/review";

const HISTORY_LIMIT = 10;

// ---- problem identity + per-problem persistence -----------------------------
function slugFromUrl(url) {
  const m = /leetcode\.com\/problems\/([^/?#]+)/.exec(url || "");
  return m ? m[1] : "";
}

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

// ---- settings ---------------------------------------------------------------
async function getSettings() {
  const saved = await chrome.storage.local.get([
    "undoomed_provider",
    "undoomed_model",
    "undoomed_api_key",
    "undoomed_server_secret",
  ]);
  return {
    provider: saved.undoomed_provider || "openai",
    model: saved.undoomed_model || "",
    api_key: saved.undoomed_api_key || "",
    server_secret: saved.undoomed_server_secret || "",
  };
}

// ---- MAIN-world reader (injected into the page to reach window.monaco) -------
// Must be fully self-contained — it runs in the page, not here.
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

// ---- talk to the overlay (inject the content script if it isn't there yet) --
async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (e) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["md.js", "content.js"],
      });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (e2) {
      return null;
    }
  }
}

// ---- the one review flow ----------------------------------------------------
async function runReview(tabId, url) {
  if (!/^https:\/\/leetcode\.com\/problems\//.test(url || "")) {
    return { ok: false, error: "Open a LeetCode problem page, then try again." };
  }

  const settings = await getSettings();
  if (!settings.api_key) {
    const msg = "Add your AI provider and API key in Settings (⚙), then retry.";
    await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "error", message: msg });
    return { ok: false, error: msg };
  }

  const slug = slugFromUrl(url);
  await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "loading" });

  // Full code + language straight from Monaco (MAIN world).
  let monaco = { code: "", language: "" };
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: readMonacoCodeAndLang,
    });
    monaco = (injection && injection.result) || monaco;
  } catch (e) {
    /* DOM fallback below */
  }

  // Description (+ DOM code fallback) from the content script.
  let scraped = {};
  try {
    scraped = (await chrome.tabs.sendMessage(tabId, { type: "UNDOOMED_SCRAPE" })) || {};
  } catch (e) {
    /* leave empty */
  }

  const current_code =
    monaco.code && monaco.code.trim() ? monaco.code : scraped.current_code || "";
  if (!current_code.trim()) {
    const msg = "Couldn't read your code from the editor. Write some code and retry.";
    await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "error", message: msg });
    return { ok: false, error: msg };
  }

  const task_description = scraped.task_description || "";
  const language = monaco.language || "";
  const thread_id = await getThreadId(slug);

  const headers = { "Content-Type": "application/json" };
  if (settings.server_secret) headers["X-Server-Secret"] = settings.server_secret;

  let response;
  try {
    response = await fetch(API_URL, {
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
  } catch (e) {
    const msg =
      "Couldn't reach the Un-doomed API at " + API_BASE_URL + ". Is the server running?";
    await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "error", message: msg });
    return { ok: false, error: msg };
  }

  if (!response.ok) {
    let detail = "Server responded " + response.status + ".";
    try {
      const body = await response.json();
      if (body && body.detail) detail = body.detail;
    } catch (e) {
      /* keep status-code message */
    }
    await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "error", message: detail });
    return { ok: false, error: detail };
  }

  const data = await response.json();
  const approved = data.status === "approved";
  const body = approved
    ? data.style_feedback || "Your logic is clean. Nice work!"
    : data.socratic_hints || "No hints were returned.";

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
  await sendToTab(tabId, { type: "UNDOOMED_OVERLAY", phase: "result", entry });
  return { ok: true, status: data.status };
}

// ---- message router ---------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "UNDOOMED_RUN_REVIEW") {
    (async () => {
      const tabId = message.tabId || (sender.tab && sender.tab.id);
      if (!tabId) {
        sendResponse({ ok: false, error: "No active tab." });
        return;
      }
      let url = message.tabUrl || (sender.tab && sender.tab.url);
      if (!url) {
        try {
          const tab = await chrome.tabs.get(tabId);
          url = tab.url;
        } catch (e) {
          /* leave undefined */
        }
      }
      const result = await runReview(tabId, url || "");
      sendResponse(result);
    })();
    return true; // keep the channel open for the async sendResponse
  }
});
