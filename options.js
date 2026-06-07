// =============================================================================
// options.js — load/save the user's AI provider + model + API key, and let them
// test the connection to the local server before leaving the page.
// Stored in chrome.storage.local (per browser profile, not synced).
// =============================================================================

"use strict";

// Base URL comes from config.js (the single place to change for production).
// Falls back to localhost if config.js somehow didn't load.
const API_BASE_URL =
  (typeof window !== "undefined" && window.UNDOOMED_API_BASE_URL) ||
  "http://127.0.0.1:8000";
const API_URL = API_BASE_URL.replace(/\/+$/, "") + "/api/review";

const STORAGE = {
  provider: "undoomed_provider",
  model: "undoomed_model",
  apiKey: "undoomed_api_key",
  serverSecret: "undoomed_server_secret",
  side: "undoomed_overlay_side",
};

// Default model shown as a placeholder hint for each provider.
// These are API identifiers (lowercase-with-dashes), NOT display names.
const DEFAULT_MODEL = {
  openai: "gpt-4o-mini",
  anthropic: "claude-opus-4-8",
  gemini: "gemini-2.5-flash",
  deepseek: "deepseek-chat",
};

const providerEl = document.getElementById("provider");
const modelEl = document.getElementById("model");
const keyEl = document.getElementById("api-key");
const serverEl = document.getElementById("server-secret");
const sideEl = document.getElementById("overlay-side");
const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle-key");
const testBtn = document.getElementById("test-btn");

// kind: "" (neutral) | "ok" | "warn" | "error"
function setStatus(text, kind = "") {
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? " status--" + kind : "");
}

function refreshModelPlaceholder() {
  modelEl.placeholder = "default: " + (DEFAULT_MODEL[providerEl.value] || "");
}

async function loadSettings() {
  const saved = await chrome.storage.local.get([
    STORAGE.provider,
    STORAGE.model,
    STORAGE.apiKey,
    STORAGE.serverSecret,
    STORAGE.side,
  ]);
  providerEl.value = saved[STORAGE.provider] || "openai";
  modelEl.value = saved[STORAGE.model] || "";
  keyEl.value = saved[STORAGE.apiKey] || "";
  serverEl.value = saved[STORAGE.serverSecret] || "";
  sideEl.value = saved[STORAGE.side] === "left" ? "left" : "right";
  refreshModelPlaceholder();
}

providerEl.addEventListener("change", refreshModelPlaceholder);

toggleBtn.addEventListener("click", () => {
  const revealing = keyEl.type === "password";
  keyEl.type = revealing ? "text" : "password";
  toggleBtn.textContent = revealing ? "Hide" : "Show";
});

// ---- Save -------------------------------------------------------------------
document.getElementById("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiKey = keyEl.value.trim();
  await chrome.storage.local.set({
    [STORAGE.provider]: providerEl.value,
    [STORAGE.model]: modelEl.value.trim(),
    [STORAGE.apiKey]: apiKey,
    [STORAGE.serverSecret]: serverEl.value.trim(),
    [STORAGE.side]: sideEl.value === "left" ? "left" : "right",
  });

  if (apiKey) {
    setStatus("Saved ✓", "ok");
  } else {
    setStatus("Saved — but you haven't entered an API key yet.", "warn");
  }
});

// ---- Test connection --------------------------------------------------------
// Sends a trivial review to the local server using the CURRENT form values (not
// necessarily the saved ones), so the user can confirm their key works before
// saving and leaving.
testBtn.addEventListener("click", async () => {
  const apiKey = keyEl.value.trim();
  if (!apiKey) {
    setStatus("Enter an API key first, then test.", "warn");
    return;
  }

  testBtn.disabled = true;
  setStatus("Testing connection…");

  try {
    const headers = { "Content-Type": "application/json" };
    const secret = serverEl.value.trim();
    if (secret) headers["X-Server-Secret"] = secret;

    const response = await fetch(API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        task_description: "Connection test — please respond.",
        current_code: "print('hello world')",
        thread_id: "undoomed_conntest_" + Date.now(),
        provider: providerEl.value,
        model: modelEl.value.trim(),
        api_key: apiKey,
      }),
    });

    if (response.ok) {
      setStatus(`✓ Connection OK — ${providerEl.value} responded. Don't forget to Save.`, "ok");
      return;
    }

    // Surface the server's error detail (e.g. bad key, missing package).
    let detail = "HTTP " + response.status;
    try {
      const body = await response.json();
      if (body && body.detail) detail = body.detail;
    } catch (_) {
      /* keep the HTTP status */
    }
    setStatus("✗ " + detail, "error");
  } catch (err) {
    setStatus(
      "✗ Can't reach the server at " + API_BASE_URL + " — is it running? (" + err.message + ")",
      "error"
    );
  } finally {
    testBtn.disabled = false;
  }
});

loadSettings();
