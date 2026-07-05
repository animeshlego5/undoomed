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
const HEALTH_URL = API_BASE_URL.replace(/\/+$/, "") + "/health";

const STORAGE = {
  provider: "undoomed_provider",
  model: "undoomed_model",
  apiKey: "undoomed_api_key",
  serverSecret: "undoomed_server_secret",
  side: "undoomed_overlay_side",
  validModels: "undoomed_valid_models", // { provider: [model, ...] } — tested OK
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
const modelSelectEl = document.getElementById("model-select");
const modelNewEl = document.getElementById("model-new");
const keyEl = document.getElementById("api-key");
const serverEl = document.getElementById("server-secret");
const sideEl = document.getElementById("overlay-side");
const statusEl = document.getElementById("status");
const toggleBtn = document.getElementById("toggle-key");
const testBtn = document.getElementById("test-btn");
const healthBtn = document.getElementById("health");
const healthTextEl = document.getElementById("health-text");

// kind: "" (neutral) | "ok" | "warn" | "error"
function setStatus(text, kind = "") {
  statusEl.textContent = text || "";
  statusEl.className = "status" + (kind ? " status--" + kind : "");
}

// ---- Server health check -----------------------------------------------------
// Pings the backend's lightweight GET /health probe so the user sees whether
// the server is up BEFORE they fill in the form (or click Review and wonder
// why nothing happens). Runs on page load, after every Test connection, and
// whenever the chip itself is clicked.
function serverHost() {
  try {
    return new URL(API_BASE_URL).host;
  } catch (_) {
    return API_BASE_URL;
  }
}

async function checkServerHealth() {
  healthBtn.className = "health health--checking";
  healthTextEl.textContent = "Checking server at " + serverHost() + "…";

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const response = await fetch(HEALTH_URL, { signal: ctrl.signal });
    if (response.ok) {
      healthBtn.className = "health health--ok";
      healthTextEl.textContent = "Server connected — " + serverHost();
    } else {
      healthBtn.className = "health health--down";
      healthTextEl.textContent =
        "Server at " + serverHost() + " answered HTTP " + response.status + " — click to re-check";
    }
  } catch (_) {
    healthBtn.className = "health health--down";
    healthTextEl.textContent =
      "Server unreachable at " + serverHost() + ' — start it with "undoom serve", then click to re-check';
  } finally {
    clearTimeout(timer);
  }
}

healthBtn.addEventListener("click", checkServerHealth);

// ---- Valid-model history (per provider) -------------------------------------
// We remember every model that returned a SUCCESSFUL Test connection, grouped
// by provider, and offer them in a dropdown so the user never has to retype a
// known-good model id — and can't accidentally pick one that doesn't work.
const ADD_NEW = "__add_new__"; // sentinel dropdown value: reveal the text input
let validModels = {}; // { provider: ["gpt-4o", ...] }

async function loadValidModels() {
  const saved = await chrome.storage.local.get(STORAGE.validModels);
  const raw = saved[STORAGE.validModels];
  validModels = raw && typeof raw === "object" ? raw : {};
}

function modelsFor(provider) {
  return Array.isArray(validModels[provider]) ? validModels[provider].slice() : [];
}

async function addValidModel(provider, model) {
  if (!model) return;
  const list = modelsFor(provider);
  if (!list.includes(model)) {
    list.push(model);
    list.sort();
    validModels[provider] = list;
    await chrome.storage.local.set({ [STORAGE.validModels]: validModels });
  }
}

// Rebuild the model dropdown for a provider; select `selected` ("" = default).
function populateModelDropdown(provider, selected) {
  const def = DEFAULT_MODEL[provider] || "";
  const list = modelsFor(provider);
  // Keep a previously-saved model visible even if it isn't in the history yet.
  if (selected && selected !== def && !list.includes(selected)) list.unshift(selected);

  modelSelectEl.innerHTML = "";

  const optDefault = document.createElement("option");
  optDefault.value = ""; // empty => use the provider default
  optDefault.textContent = "Default — " + def;
  modelSelectEl.appendChild(optDefault);

  list.forEach((m) => {
    if (!m || m === def) return; // the default is already the first option
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelectEl.appendChild(opt);
  });

  const optAdd = document.createElement("option");
  optAdd.value = ADD_NEW;
  optAdd.textContent = "+ Add a new model…";
  modelSelectEl.appendChild(optAdd);

  modelSelectEl.value = selected && selected !== def ? selected : "";
  toggleNewModelInput();
}

function toggleNewModelInput() {
  const adding = modelSelectEl.value === ADD_NEW;
  modelNewEl.hidden = !adding;
  if (adding) {
    modelNewEl.value = "";
    modelNewEl.focus();
  }
}

// The model id the user currently intends to use ("" means provider default).
function currentModel() {
  if (modelSelectEl.value === ADD_NEW) return modelNewEl.value.trim();
  return modelSelectEl.value;
}

async function loadSettings() {
  await loadValidModels();
  const saved = await chrome.storage.local.get([
    STORAGE.provider,
    STORAGE.model,
    STORAGE.apiKey,
    STORAGE.serverSecret,
    STORAGE.side,
  ]);
  providerEl.value = saved[STORAGE.provider] || "openai";
  keyEl.value = saved[STORAGE.apiKey] || "";
  serverEl.value = saved[STORAGE.serverSecret] || "";
  sideEl.value = saved[STORAGE.side] === "left" ? "left" : "right";
  populateModelDropdown(providerEl.value, (saved[STORAGE.model] || "").trim());
}

// Switching provider shows that provider's own remembered models.
providerEl.addEventListener("change", () => populateModelDropdown(providerEl.value, ""));
modelSelectEl.addEventListener("change", toggleNewModelInput);

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
    [STORAGE.model]: currentModel(),
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
        model: currentModel(),
        api_key: apiKey,
      }),
    });

    if (response.ok) {
      // Success ⇒ this model works. Remember it for this provider and re-select
      // it in the dropdown so it's there next time (no retyping).
      const used = currentModel() || DEFAULT_MODEL[providerEl.value] || "";
      await addValidModel(providerEl.value, used);
      populateModelDropdown(providerEl.value, used);
      setStatus(
        `✓ Connection OK — ${providerEl.value} responded with “${used}”. ` +
          "Saved to your model list; don't forget to Save.",
        "ok"
      );
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
    checkServerHealth(); // a test just talked to the server — refresh the chip
  }
});

loadSettings();
checkServerHealth();
