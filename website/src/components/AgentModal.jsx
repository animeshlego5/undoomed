import { useState } from "react";
import { FileText, Copy, Download, X } from "lucide-react";
import Modal from "./Modal";
import agentText from "../content/agent.md?raw";

export default function AgentModal({ open, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(agentText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="modal-agent-title">
      <div className="reveal flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-white">
              <FileText size={18} strokeWidth={1.5} />
            </span>
            <div>
              <h3
                id="modal-agent-title"
                className="text-lg font-medium tracking-tight"
              >
                agent.md
              </h3>
              <p className="text-xs text-muted">
                Drop this in your project root for Claude Code / Cursor
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

        <div className="overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 font-mono text-[12.5px] leading-relaxed text-ink">
            {agentText}
          </pre>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/25 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent hover:text-white"
          >
            <Copy size={14} strokeWidth={1.5} />
            {copied ? "Copied!" : "Copy"}
          </button>
          <a
            href="/agent.md"
            download
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
          >
            <Download size={15} strokeWidth={1.5} />
            Download agent.md
          </a>
        </div>
      </div>
    </Modal>
  );
}
