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
let sidebar = null; // the activity-bar view provider (set in activate)

// The brand mark, theme-agnostic: an SVG mask carves the slash gap, so it
// works on any background (sidebar, light or dark).
const LOGO_SVG = `<svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
  <defs><mask id="udgap"><rect width="100" height="100" fill="white"/>
  <path d="M13 31 L91 80" stroke="black" stroke-width="18" stroke-linecap="round"/></mask></defs>
  <g mask="url(#udgap)" fill="none">
    <path d="M37 16 H50 C73 16 84 31 84 50 C84 69 73 84 50 84 H37 Q28 84 28 75 V25 Q28 16 37 16 Z" stroke="#2563eb" stroke-width="8" stroke-linejoin="round"/>
    <path d="M45 27 H58" stroke="#2563eb" stroke-width="5.5" stroke-linecap="round"/>
    <circle cx="50.5" cy="71.5" r="4" fill="#2563eb"/>
  </g>
  <path d="M13 31 L91 80" stroke="#2563eb" stroke-width="8" stroke-linecap="round"/>
</svg>`;

// ---- Activity-bar sidebar view: brand, actions, and the last verdict ---------
class UndoomedViewProvider {
  constructor() {
    this.view = null;
    this.last = null; // { data, fileName }
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html();
    view.webview.onDidReceiveMessage((m) => {
      if (!m) return;
      if (m.type === "review") vscode.commands.executeCommand("undoomed.review");
      if (m.type === "setKey") vscode.commands.executeCommand("undoomed.setApiKey");
      if (m.type === "setTask") vscode.commands.executeCommand("undoomed.setTask");
      if (m.type === "openSettings")
        vscode.commands.executeCommand("workbench.action.openSettings", "undoomed.");
      if (m.type === "openLast" && this.last && panel) panel.reveal(undefined, true);
    });
  }

  update(data, fileName) {
    this.last = { data, fileName };
    if (this.view) this.view.webview.html = this.html();
  }

  html() {
    let lastHtml = "";
    if (this.last) {
      const d = this.last.data;
      const status = d.status || "pending";
      const label =
        status === "approved" ? "APPROVED" : status === "needs_revision" ? "NEEDS REVISION" : "PENDING";
      const bg = status === "approved" ? "#2563eb" : "var(--vscode-foreground)";
      const fg = "var(--vscode-sideBar-background, #ffffff)";
      const faults = Array.isArray(d.edge_case_faults) ? d.edge_case_faults.length : 0;
      lastHtml = `
        <div class="last">
          <div class="lfile">${esc(this.last.fileName)}</div>
          <span class="pill" style="background:${bg};color:${fg}">${label}</span>
          <span class="faults">${faults ? faults + " fault" + (faults > 1 ? "s" : "") : "no faults"} · attempt #${Number(d.loop_count) || 0}</span>
          <button class="ghost" onclick="post('openLast')">Reopen review panel</button>
        </div>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px 14px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .name { font-weight: 600; font-size: 13px; }
  .name .strike { text-decoration: line-through; text-decoration-color: #2563eb; text-decoration-thickness: 2px; }
  .tag { font-size: 11px; opacity: .65; }
  button { display: block; width: 100%; border: 0; border-radius: 999px; padding: 8px 12px; margin-top: 8px;
           background: #2563eb; color: #fff; font-weight: 600; font-size: 12px; cursor: pointer; font-family: inherit; }
  button:hover { background: #1d4ed8; }
  button.ghost { background: transparent; color: var(--vscode-foreground); font-weight: 500;
                 border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); }
  button.ghost:hover { border-color: #2563eb; color: #2563eb; }
  .actions { margin-top: 14px; }
  .last { margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,.35)); font-size: 12px; }
  .lfile { font-family: var(--vscode-editor-font-family, monospace); font-size: 11px; opacity: .8; margin-bottom: 6px; }
  .pill { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 9px; letter-spacing: .12em;
          font-family: var(--vscode-editor-font-family, monospace); }
  .faults { display: block; margin-top: 6px; opacity: .7; font-size: 11px; }
</style></head><body>
  <div class="brand">${LOGO_SVG}
    <div><div class="name">Un-<span class="strike">Doomed</span></div>
    <div class="tag">Hints, not answers.</div></div>
  </div>
  <div class="actions">
    <button onclick="post('review')">Request Socratic Review</button>
    <button class="ghost" onclick="post('setTask')">Set task for this file</button>
    <button class="ghost" onclick="post('setKey')">Set API key</button>
    <button class="ghost" onclick="post('openSettings')">Settings — provider · model · server</button>
  </div>
  ${lastHtml}
  <script>const vsapi = acquireVsCodeApi(); function post(type){ vsapi.postMessage({ type }); }</script>
</body></html>`;
  }
}

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

function showPanel(data, doc, context) {
  const fileName = doc.uri.path.split("/").pop() || "file";
  if (!panel) {
    panel = vscode.window.createWebviewPanel(
      "undoomedReview",
      "Un-Doomed Review",
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: false }
    );
    // The editor tab carries the brand mark, like Claude Code's tabs do.
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, "media", "mark.svg");
    panel.onDidDispose(() => {
      panel = null;
    });
  }
  panel.title = "Un-Doomed — " + fileName;
  panel.webview.html = renderHtml(data, fileName);
  panel.reveal(vscode.ViewColumn.Beside, true);
  if (sidebar) sidebar.update(data, fileName);
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
      showPanel(data, doc, context);
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
  sidebar = new UndoomedViewProvider();
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("undoomed.home", sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("undoomed.review", () => requestReview(context)),
    vscode.commands.registerCommand("undoomed.setTask", () => setTask(context)),
    vscode.commands.registerCommand("undoomed.setApiKey", () => setApiKey(context))
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
