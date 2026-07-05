import { Puzzle, Download, X } from "lucide-react";
import Modal from "./Modal";

export default function ExtensionModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-extension-title">
      <div className="reveal w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-white">
              <Puzzle size={18} strokeWidth={1.5} />
            </span>
            <div>
              <h3
                id="modal-extension-title"
                className="text-lg font-medium tracking-tight"
              >
                Get Beta Access
              </h3>
              <p className="text-xs text-muted">
                Load the extension in Chrome or Edge
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
                Download the{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  .zip
                </code>{" "}
                below and unzip it. Then open{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  chrome://extensions
                </code>{" "}
                or{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  edge://extensions
                </code>
                .
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">
                2
              </span>
              <p className="text-sm leading-relaxed">
                Turn on <span className="font-medium">Developer mode</span>, then
                click <span className="font-medium">"Load unpacked."</span>
              </p>
            </li>
            <li className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-accent/40 font-mono text-[11px] text-accent">
                3
              </span>
              <p className="text-sm leading-relaxed">
                Select the unzipped{" "}
                <code className="rounded bg-surface px-1 py-0.5 font-mono text-[12px]">
                  undoomed
                </code>{" "}
                folder. Pin the icon, open a LeetCode problem, and click{" "}
                <span className="font-medium">Request Socratic Review</span>.
              </p>
            </li>
          </ol>

          <a
            href="/undoomed-extension.zip"
            download
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
          >
            <Download size={15} strokeWidth={1.5} /> Download extension (.zip)
          </a>
          <p className="mt-3 text-center text-xs text-muted">
            Then set your AI provider + key in the extension's Settings.
          </p>
        </div>
      </div>
    </Modal>
  );
}
