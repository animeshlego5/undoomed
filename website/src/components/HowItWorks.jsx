import { Shield, HelpCircle, Sparkles } from "lucide-react";

const reviewers = [
  {
    index: "01",
    Icon: Shield,
    title: "Edge-Case Executioner",
    body: (
      <>
        A ruthless auditor that checks correctness first — empty inputs,
        duplicates, "no solution", off-by-ones. Style comes later.
      </>
    ),
  },
  {
    index: "02",
    Icon: HelpCircle,
    title: "Socratic Tutor",
    body: (
      <>
        Turns each bug into a question that leads you to the fix yourself — zero
        code handed over (until you're truly stuck).
      </>
    ),
  },
  {
    index: "03",
    Icon: Sparkles,
    title: "Clean-Code Critic",
    body: (
      <>
        Once your logic is sound, it reviews Big-O complexity and style — so you
        ship code that's correct <em>and</em> clean.
      </>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how"
      className="mx-auto max-w-6xl border-t border-line px-5 py-20 md:py-28"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">/ 01</span> HOW IT WORKS
      </p>

      <div className="mt-6 max-w-2xl">
        <h2 className="text-3xl font-medium tracking-tight md:text-5xl">
          Three reviewers, one rule:{" "}
          <span className="italic text-accent">make you think.</span>
        </h2>
        <p className="mt-4 text-muted">
          Un-doomed never just hands over the answer. It reviews in the order a
          great mentor would.
        </p>
      </div>

      <div className="mt-14 grid gap-0 md:grid-cols-3 md:divide-x md:divide-line">
        {reviewers.map(({ index, Icon, title, body }) => (
          <div key={title} className="px-0 md:px-8 first:md:pl-0">
            <p className="font-mono text-sm text-accent">{index}</p>
            <Icon size={20} strokeWidth={1.5} className="mt-4 text-ink" />
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
