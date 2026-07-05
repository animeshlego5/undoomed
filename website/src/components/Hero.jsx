import BrowserDemo from "./BrowserDemo.jsx";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center md:pt-28">
        <p className="reveal font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          <span className="text-accent">/ 00</span> Socratic AI code review —
          hints, not answers
        </p>

        <h1 className="reveal-2 mx-auto mt-6 max-w-3xl text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
          Stop scrolling.
          <br />
          Start <span className="text-accent">building.</span>
        </h1>

        <p className="reveal-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Un-doomed is the Socratic AI code reviewer that{" "}
          <span className="font-medium text-ink">forces you to think</span>. It
          hunts your edge cases, asks the questions that lead you to the bug, and
          only critiques style once your logic is sound.
        </p>

        <div className="reveal-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#downloads"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
          >
            Get the browser extension
          </a>
          <a
            href="#cli"
            className="rounded-full border border-ink/25 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            Install the CLI
          </a>
        </div>

        <div className="reveal-3 mt-16">
          <BrowserDemo />
        </div>
      </div>
    </section>
  );
}
