import { ArrowRight } from "lucide-react";

export default function Cta() {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24">
      <div className="rounded-3xl bg-ink px-8 py-16 text-surface md:px-16 md:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-surface/50">
          <span className="text-[#8ab4f8]">/ 04</span> Get started
        </p>
        <h3 className="mt-5 text-3xl font-medium tracking-tight md:text-5xl">
          Think it through. Ship it clean.
        </h3>
        <p className="mt-4 max-w-md text-surface/70">
          Add Un-Doomed to your workflow and turn every bug into a lesson.
        </p>
        <a
          href="#downloads"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-accent hover:text-white"
        >
          Get started — it's free
          <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}
