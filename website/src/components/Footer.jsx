import LogoMark from "./LogoMark.jsx";
import Wordmark from "./Wordmark.jsx";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <LogoMark size={22} />
          <Wordmark className="text-sm text-ink" />
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Hints, not answers.
          </p>
          <p className="text-sm text-muted">Built for people who'd rather understand.</p>
        </div>
      </div>
    </footer>
  );
}
