# Un-Doomed for VS Code

Socratic hints — never the answer — on the file you're editing, then a style
review once your logic is clean. Talks to the same Un-Doomed server as the
browser extension and the `undoom` CLI.

## Use

1. Start the backend: `undoom serve` (or point `undoomed.serverUrl` at a
   deployed instance).
2. Run **"Un-Doomed: Set API Key"** from the Command Palette (stored in VS
   Code secret storage), and pick a provider/model under **Settings →
   Un-Doomed** if you don't want the server default.
3. Open a file and run **"Un-Doomed: Request Socratic Review"**
   (`Ctrl+Alt+U` / `Cmd+Alt+U`). The first review of a file asks what the
   code is supposed to do; change it later with **"Un-Doomed: Set Task
   Description for This File"**.
4. Verdict, edge-case faults, and Socratic hints appear in a panel beside
   your editor. Reviews of the same file share a thread, so the reviewer
   remembers your attempts.

## Develop / test

Open this folder in VS Code and press **F5** — an Extension Development Host
window launches with the extension loaded.

## Package / install

```
npm install -g @vscode/vsce
vsce package            # produces undoomed-vscode-0.1.0.vsix
```

Install the `.vsix` via Extensions panel → `…` menu → **Install from VSIX…**,
or `code --install-extension undoomed-vscode-0.1.0.vsix`.
