// =============================================================================
// Un-Doomed for VS Code — Socratic hints (never the answer) on the active file.
//
// Speaks the exact same protocol as the browser extension and the CLI:
// POST {serverUrl}/api/review with task_description / current_code / language /
// thread_id (+ optional provider / model / api_key, X-Server-Secret header).
// Results render in a reusable webview panel beside the editor.
// =============================================================================

"use strict";

const vscode = require("vscode");
const crypto = require("crypto");

let panel = null; // single results webview, reused across reviews

function cfg() {
  const c = vscode.workspace.getConfiguration("undoomed");
  return {
    serverUrl: String(c.get("serverUrl") || "http://127.0.0.1:8000").replace(/\/+$/, ""),
    provider: c.get("provider") || "",
    model: (c.get("model") || "").trim(),
    apiKey: (c.get("apiKey") || "").trim(),
    serverSecret: (c.get("serverSecret") || "").trim(),
  };
}

// Stable per-workspace+file thread id, so loop_count and history persist —
// same idea as the CLI's .undoomed_session, but no file on disk needed.
function threadIdFor(doc) {
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  const scope = (folder ? folder.uri.toString() : "") + "|" + doc.uri.toString();
  return "vscode_" + crypto.createHash("sha1").update(scope).digest("hex").slice(0, 12);
}

// ---- tiny, safe Markdown-ish renderer: escape EVERYTHING first ---------------
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function mdToHtml(text) {
  const lines = esc(text || "").split(/\r?\n/);
  const out = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push("<li>" + inline(line.slice(2)) + "</li>");
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (!line) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = Math.min(h[1].length + 2, 6);
      out.push(`<h${lvl}>` + inline(h[2]) + `</h${lvl}>`);
    } else {
      out.push("<p>" + inline(line) + "</p>");
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

function renderHtml(data, fileName) {
  const status = data.status || "pending";
  const pill =
    status === "approved"
      ? ["APPROVED", "#2563eb", "#ffffff"]
      : status === "needs_revision"
        ? ["NEEDS REVISION", "#161613", "#f0efe3"]
        : ["PENDING", "#dcd9c8", "#161613"];

  const faults = Array.isArray(data.edge_case_faults) ? data.edge_case_faults : [];
  const faultsHtml = faults.length
    ? "<h3>Edge-case faults</h3><ul>" +
      faults.map((f) => "<li>" + inline(esc(f)) + "</li>").join("") +
      "</ul>"
    : "";

  const hints = data.socratic_hints ? "<h3>Socratic hints</h3>" + mdToHtml(data.socratic_hints) : "";
  const style = data.style_feedback ? "<h3>Style review</h3>" + mdToHtml(data.style_feedback) : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<style>
  body { font-family: "PP Neue Montreal", Arial, sans-serif; background: #f0efe3; color: #161613;
         margin: 0; padding: 20px 24px; font-size: 13.5px; line-height: 1.6; }
  .meta { font-family: Monaco, Menlo, Consolas, monospace; font-size: 10px; letter-spacing: .15em;
          text-transform: uppercase; color: #6f6d61; margin-bottom: 10px; }
  .pill { display: inline-block; border-radius: 999px; padding: 4px 12px; font-family: Monaco, Menlo, Consolas, monospace;
          font-size: 10px; letter-spacing: .15em; }
  h3 { font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: #6f6d61;
       font-family: Monaco, Menlo, Consolas, monospace; margin: 22px 0 8px; }
  ul { margin: 6px 0; padding-left: 20px; }
  li { margin: 4px 0; }
  p { margin: 8px 0; }
  code { font-family: Monaco, Menlo, Consolas, monospace; font-size: 12px; background: #e4e2d4;
         padding: 1px 5px; border-radius: 4px; }
  .foot { margin-top: 26px; border-top: 1px solid #dcd9c8; padding-top: 10px;
          font-family: Monaco, Menlo, Consolas, monospace; font-size: 10px; color: #6f6d61; }
</style></head>
<body>
  <div class="meta">Un-Doomed · ${esc(fileName)}</div>
  <span class="pill" style="background:${pill[1]};color:${pill[2]}">${pill[0]}</span>
  ${faultsHtml}
  ${hints}
  ${style}
  <div class="foot">attempt #${Number(data.loop_count) || 0} · hints, not answers</div>
</body></html>`;
}

function showPanel(data, doc) {
  const fileName = doc.uri.path.split("/").pop() || "file";
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "undoomedReview",
      "Un-Doomed Review",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false }
    );
    panel.onDidDispose(() => {
      panel = null;
    });
  }
  panel.title = "Un-Doomed — " + fileName;
  panel.webview.html = renderHtml(data, fileName);
  panel.reveal(vscode.ViewColumn.Beside, true);
}

async function requestReview(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Un-Doomed: open a file to review.");
    return;
  }
  const doc = editor.document;
  const code = doc.getText();
  if (!code.trim()) {
    vscode.window.showWarningMessage("Un-Doomed: this file is empty.");
    return;
  }

  // Task description — asked once per file, remembered in workspace state.
  const taskKey = "undoomed.task:" + doc.uri.toString();
  let task = context.workspaceState.get(taskKey);
  if (!task) {
    task = await vscode.window.showInputBox({
      title: "What should this code do?",
      prompt: "One sentence — the reviewers judge correctness against this. (Change later: 'Un-Doomed: Set Task Description'.)",
      placeHolder: "e.g. Return indices of the two numbers that sum to target",
      ignoreFocusOut: true,
    });
    if (!task) return; // cancelled
    await context.workspaceState.update(taskKey, task);
  }

  const s = cfg();
  const apiKey = (await context.secrets.get("undoomed.apiKey")) || s.apiKey;

  const headers = { "Content-Type": "application/json" };
  if (s.serverSecret) headers["X-Server-Secret"] = s.serverSecret;

  const payload = {
    task_description: task,
    current_code: code,
    language: doc.languageId || null,
    thread_id: threadIdFor(doc),
    provider: s.provider || null,
    model: s.model || null,
    api_key: apiKey || null,
  };

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Un-Doomed: reviewing your code…",
    },
    async () => {
      let res;
      try {
        res = await fetch(s.serverUrl + "/api/review", {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });
      } catch (err) {
        vscode.window.showErrorMessage(
          `Un-Doomed: can't reach the server at ${s.serverUrl} — start it with "undoom serve". (${err.message})`
        );
        return;
      }
      if (!res.ok) {
        let detail = "HTTP " + res.status;
        try {
          const j = await res.json();
          if (j && j.detail) detail = j.detail;
        } catch (_) {
          /* keep the HTTP status */
        }
        vscode.window.showErrorMessage("Un-Doomed: " + detail);
        return;
      }
      const data = await res.json();
      showPanel(data, doc);
    }
  );
}

async function setTask(context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Un-Doomed: open a file first.");
    return;
  }
  const taskKey = "undoomed.task:" + editor.document.uri.toString();
  const value = await vscode.window.showInputBox({
    title: "Task description for this file",
    value: context.workspaceState.get(taskKey) || "",
    prompt: "The reviewers judge correctness against this sentence.",
    ignoreFocusOut: true,
  });
  if (value === undefined) return; // cancelled
  await context.workspaceState.update(taskKey, value || undefined);
  vscode.window.showInformationMessage(
    value ? "Un-Doomed: task saved for this file." : "Un-Doomed: task cleared for this file."
  );
}

async function setApiKey(context) {
  const value = await vscode.window.showInputBox({
    title: "Un-Doomed: provider API key",
    prompt: "Stored in VS Code secret storage (never written to settings.json). Leave empty to clear.",
    password: true,
    ignoreFocusOut: true,
  });
  if (value === undefined) return; // cancelled
  if (value) {
    await context.secrets.store("undoomed.apiKey", value);
    vscode.window.showInformationMessage("Un-Doomed: API key saved to secret storage.");
  } else {
    await context.secrets.delete("undoomed.apiKey");
    vscode.window.showInformationMessage("Un-Doomed: API key cleared.");
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("undoomed.review", () => requestReview(context)),
    vscode.commands.registerCommand("undoomed.setTask", () => setTask(context)),
    vscode.commands.registerCommand("undoomed.setApiKey", () => setApiKey(context))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
