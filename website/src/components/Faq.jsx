import { useState } from "react";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: 'Why "Un-Doomed"?',
    a: (
      <>
        It saves you from the two dooms of learning to code: getting stuck for
        hours, or copy-pasting an answer you don't understand. You stay in the
        productive middle — thinking.
      </>
    ),
  },
  {
    q: "Which AI models can I use?",
    a: (
      <>
        OpenAI, Anthropic (Claude), Google Gemini, or DeepSeek. You bring your
        own API key, and it never leaves your machine.
      </>
    ),
  },
  {
    q: "Is my code or key sent anywhere?",
    a: (
      <>
        Only to a small server that runs on your own computer, which then calls
        your chosen AI provider with your key. No Un-Doomed cloud in between.
      </>
    ),
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section
      id="faq"
      className="mx-auto max-w-3xl border-t border-line px-5 py-20 md:py-28"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">/ 03</span> FAQ
      </p>
      <h2 className="mt-6 text-3xl font-medium tracking-tight md:text-5xl">
        Calm by design
      </h2>

      <div className="mt-10 divide-y divide-line border-t border-line">
        {faqs.map(({ q, a }, i) => (
          <div key={q}>
            <button
              type="button"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
              className={
                "flex w-full items-center justify-between py-5 text-left font-medium transition-colors hover:text-accent " +
                (open === i ? "text-accent" : "")
              }
            >
              {q}
              <Plus
                size={16}
                strokeWidth={1.5}
                className={
                  "shrink-0 text-muted transition-transform duration-300 " +
                  (open === i ? "rotate-45 text-accent" : "")
                }
              />
            </button>
            <div
              className={
                "grid transition-[grid-template-rows] duration-300 ease-out " +
                (open === i ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
              }
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-sm leading-relaxed text-muted">{a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
