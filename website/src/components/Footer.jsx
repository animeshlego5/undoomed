import LogoMark from "./LogoMark.jsx";
import Wordmark from "./Wordmark.jsx";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-10 sm:flex-row sm:items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <LogoMark size={22} />
            <Wordmark className="text-sm text-ink" />
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Hints, not answers.
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <p className="text-sm text-muted">For people who'd rather understand.</p>
          <p className="text-sm text-muted">
            Built by{" "}
            <a
              href="https://animeshlego5.github.io/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink transition-colors hover:text-accent"
            >
              Animesh
            </a>
            {" · "}
            <a
              href="https://github.com/animeshlego5/undoomed"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink transition-colors hover:text-accent"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
