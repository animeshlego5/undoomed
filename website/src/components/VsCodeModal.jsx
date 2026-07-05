import { Code, X } from "lucide-react";
import Modal from "./Modal";

export default function VsCodeModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-vscode-title">
      <div className="reveal w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-white">
              <Code size={18} strokeWidth={1.5} />
            </span>
            <div>
              <h3
                id="modal-vscode-title"
                className="text-lg font-medium tracking-tight"
              >
                Un-Doomed for VS Code
              </h3>
              <p className="text-xs text-muted">
                Socratic review beside your editor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5">
          <ol className="space-y-4">
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">
                1
              </span>
              <p className="text-sm leading-relaxed">
                Get the Un-Doomed repository — the extension lives in the{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  vscode-extension
                </code>{" "}
                folder. Package it once:{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  npx @vscode/vsce package
                </code>
                .
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">
                2
              </span>
              <p className="text-sm leading-relaxed">
                In VS Code: Extensions panel → <span className="font-medium">…</span>{" "}
                menu → <span className="font-medium">Install from VSIX…</span>{" "}
                and pick the generated{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  .vsix
                </code>
                . (To hack on it instead, open the folder and press{" "}
                <span className="font-medium">F5</span>.)
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">
                3
              </span>
              <p className="text-sm leading-relaxed">
                Start your server (
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  undoom serve
                </code>
                ), run <span className="font-medium">"Un-Doomed: Set API Key"</span>{" "}
                once, then review any file with{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  Ctrl+Alt+U
                </code>
                .
              </p>
            </li>
          </ol>

          <p className="mt-5 text-center text-xs text-muted">
            Verdict, edge-case faults, and Socratic hints open in a panel
            beside your code — answers stay yours to find.
          </p>
        </div>
      </div>
    </Modal>
  );
}
