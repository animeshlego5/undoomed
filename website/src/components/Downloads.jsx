import { useState } from "react";
import { Chrome, Terminal, Code, FileText, ArrowRight } from "lucide-react";

export default function Downloads({ onOpenExtension, onOpenAgent }) {
  const [copyLabel, setCopyLabel] = useState("Copy");

  const handleCopy = () => {
    navigator.clipboard
      .writeText("pip install undoomed")
      .then(() => {
        setCopyLabel("Copied!");
        setTimeout(() => setCopyLabel("Copy"), 1500);
      })
      .catch(() => {
        setCopyLabel("Press Ctrl+C");
      });
  };

  return (
    <section
      id="downloads"
      className="mx-auto max-w-6xl border-t border-line px-5 py-20 md:py-28"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">/ 02</span> DOWNLOADS
      </p>

      <div className="mt-6 max-w-2xl">
        <h2 className="text-3xl font-medium tracking-tight md:text-5xl">
          Bring it everywhere you code
        </h2>
        <p className="mt-4 text-muted">
          Same brain, your choice of surface. Bring your own API key — it stays
          on your machine.
        </p>
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Browser Extension */}
        <article className="flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-ink/40">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-line">
              <Chrome size={18} strokeWidth={1.5} />
            </div>
            <span className="rounded-full border border-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
              Available
            </span>
          </div>
          <h3 className="mt-5 font-medium">Browser Extension</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Review your LeetCode solution right on the page. Works in Chrome &
            Edge (Manifest V3).
          </p>
          <button
            type="button"
            onClick={onOpenExtension}
            className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
          >
            Get Beta Access
            <ArrowRight size={14} strokeWidth={1.5} />
          </button>
        </article>

        {/* CLI Tool */}
        <article
          id="cli"
          className="flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-ink/40"
        >
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-line">
              <Terminal size={18} strokeWidth={1.5} />
            </div>
            <span className="rounded-full border border-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
              Available
            </span>
          </div>
          <h3 className="mt-5 font-medium">CLI Tool</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Review any file from your terminal:{" "}
            <code className="font-mono text-[12px]">undoom check app.py</code>
          </p>
          <div className="mt-5 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
            <code className="font-mono text-[13px]">pip install undoomed</code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-line bg-card px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:text-accent"
              aria-label="Copy install command"
            >
              {copyLabel}
            </button>
          </div>
        </article>

        {/* VS Code Extension */}
        <article className="flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-ink/40">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-line text-muted">
              <Code size={18} strokeWidth={1.5} />
            </div>
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
              Coming Soon
            </span>
          </div>
          <h3 className="mt-5 font-medium text-muted">VS Code Extension</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            Inline Socratic review without leaving your editor.
          </p>
          <button
            type="button"
            disabled
            className="mt-5 cursor-not-allowed rounded-full border border-line px-5 py-2.5 text-sm font-medium text-muted/70"
          >
            Coming soon
          </button>
        </article>

        {/* Claude agent.md */}
        <article className="flex flex-col rounded-2xl border border-line bg-card p-6 transition-colors hover:border-ink/40">
          <div className="flex items-center justify-between">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-line">
              <FileText size={18} strokeWidth={1.5} />
            </div>
            <span className="rounded-full border border-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
              Template
            </span>
          </div>
          <h3 className="mt-5 font-medium">
            Claude <code className="font-mono text-[13px]">agent.md</code>
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
            A drop-in agent spec so Claude Code and Cursor review the Un-doomed
            way.
          </p>
          <button
            type="button"
            onClick={onOpenAgent}
            className="mt-5 inline-flex items-center justify-center rounded-full border border-ink/25 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            View instructions
          </button>
        </article>
      </div>
    </section>
  );
}
