// =============================================================================
// popup.js — the "brain" of the Un-doomed popup panel.
// =============================================================================
//
// Responsibilities:
//   1. Keep a stable, unique thread_id in chrome.storage.local (created once).
//   2. Read the user's full code reliably from Monaco (page MAIN world).
//   3. Ask content.js for the problem description (+ a DOM code fallback).
//   4. POST { task_description, current_code, thread_id } to the local API.
//   5. Render the response (Socratic hints OR style review) gracefully.
// =============================================================================

"use strict";

// Base URL comes from config.js (the single place to change for production).
// Falls back to localhost if config.js somehow didn't load.
const API_BASE_URL =
  (typeof window !== "undefined" && window.UNDOOMED_API_BASE_URL) ||
  "http://127.0.0.1:8000";
const API_URL = API_BASE_URL.replace(/\/+$/, "") + "/api/review";

// ---- DOM references ---------------------------------------------------------
const btn = document.getElementById("review-btn");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const resultLabel = document.getElementById("result-label");
const statusPill = document.getElementById("status-pill");
const resultBody = document.getElementById("result-body");
const threadEl = document.getElementById("thread");

// ---- thread_id: a stable identity so the backend can remember this student --
async function getThreadId() {
  const stored = await chrome.storage.local.get("undoomed_thread_id");
  if (stored.undoomed_thread_id) return stored.undoomed_thread_id;

  // First run on this browser profile: mint a new id and persist it.
  const id =
    "student_" +
    (crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now() + "_" + Math.random().toString(16).slice(2));
  await chrome.storage.local.set({ undoomed_thread_id: id });
  return id;
}

// ---- provider settings: chosen in the Settings (options) page ---------------
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

// ---- small UI helpers -------------------------------------------------------
function setStatus(text, isError = false) {
  statusEl.textContent = text || "";
  statusEl.classList.toggle("status--error", Boolean(isError));
}

function showResult(label, pillText, pillClass, body) {
  resultLabel.textContent = label;
  statusPill.textContent = pillText;
  statusPill.className = "pill " + pillClass;
  // textContent (never innerHTML) so model output can never inject markup.
  resultBody.textContent = body;
  resultEl.hidden = false;
}

/**
 * Runs INSIDE the page's MAIN world (injected by chrome.scripting), so it can
 * touch `window.monaco` directly. Must be fully self-contained — it cannot use
 * any variables from this file's scope.
 *
 * Returns the user's code, or "" if Monaco isn't available.
 */
function readMonacoCode() {
  try {
    if (window.monaco && window.monaco.editor) {
      const values = window.monaco.editor
        .getModels()
        .map((model) => model.getValue())
        .filter((value) => typeof value === "string" && value.trim().length);
      if (values.length) {
        // The solution editor holds the longest non-empty text.
        return values.sort((a, b) => b.length - a.length)[0];
      }
    }
  } catch (err) {
    /* fall through to "" */
  }
  return "";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Collect the problem description and the user's current code from the tab.
 * Code comes from Monaco (reliable) with a content.js DOM fallback.
 */
async function scrape(tab) {
  // 1) Reliable full code, read from Monaco in the page's MAIN world.
  let monacoCode = "";
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readMonacoCode,
    });
    monacoCode = (injection && injection.result) || "";
  } catch (err) {
    /* ignore — we'll rely on the DOM fallback below */
  }

  // 2) Description (+ DOM code fallback) from the content script.
  let scraped = {};
  try {
    scraped =
      (await chrome.tabs.sendMessage(tab.id, { type: "UNDOOMED_SCRAPE" })) || {};
  } catch (err) {
    // The content script may not be loaded (e.g. the tab was open before the
    // extension was installed). Inject it once, then retry.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    scraped =
      (await chrome.tabs.sendMessage(tab.id, { type: "UNDOOMED_SCRAPE" })) || {};
  }

  return {
    task_description: scraped.task_description || "",
    current_code: monacoCode.trim() ? monacoCode : scraped.current_code || "",
  };
}

// ---- main action ------------------------------------------------------------
async function requestReview() {
  resultEl.hidden = true;
  btn.disabled = true;

  try {
    const tab = await getActiveTab();
    if (!tab || !/^https:\/\/leetcode\.com\/problems\//.test(tab.url || "")) {
      setStatus("Open a LeetCode problem page, then try again.", true);
      return;
    }

    const settings = await getSettings();
    if (!settings.api_key) {
      setStatus("Add your AI provider and API key in Settings (⚙), then retry.", true);
      return;
    }

    setStatus("Reading the problem and your code…");
    const { task_description, current_code } = await scrape(tab);

    if (!current_code.trim()) {
      setStatus(
        "Couldn't read your code from the editor. Write some code and retry.",
        true
      );
      return;
    }

    const thread_id = await getThreadId();
    setStatus("Sending to your local Un-doomed reviewer…");

    const headers = { "Content-Type": "application/json" };
    if (settings.server_secret) headers["X-Server-Secret"] = settings.server_secret;

    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task_description,
        current_code,
        thread_id,
        provider: settings.provider,
        model: settings.model,
        api_key: settings.api_key,
      }),
    });
    if (!response.ok) {
      // Surface the server's own message (e.g. 401 bad secret, 400 bad provider).
      let detail = "Server responded " + response.status + ".";
      try {
        const body = await response.json();
        if (body && body.detail) detail = body.detail;
      } catch (_) {
        /* keep the status-code message */
      }
      setStatus(detail, true);
      return;
    }

    const data = await response.json();
    setStatus("");

    if (data.status === "approved") {
      showResult(
        "Style Review",
        "Approved",
        "pill--approved",
        data.style_feedback || "Your logic is clean. Nice work!"
      );
    } else {
      showResult(
        "Socratic Hints",
        "Needs revision",
        "pill--revision",
        data.socratic_hints || "No hints were returned."
      );
    }
  } catch (err) {
    setStatus(
      "Couldn't reach the Un-doomed API at " + API_BASE_URL +
        ". Is the server running? (" + err.message + ")",
      true
    );
  } finally {
    btn.disabled = false;
  }
}

// ---- wire up ----------------------------------------------------------------
btn.addEventListener("click", requestReview);

// Open the full Settings (options) page where the user picks provider + key.
document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// Surface the persistent session id in the footer for transparency.
getThreadId().then((id) => {
  threadEl.textContent = id;
});

// On first open with nothing configured yet, nudge the user toward Settings.
getSettings().then((s) => {
  if (!s.api_key) {
    setStatus("First time? Set your AI provider + API key in Settings (⚙).");
  }
});
