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

// Same editorial split as the rest of the page: heading block on the left,
// content on the right, full max-w-6xl width.
export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section
      id="faq"
      className="mx-auto max-w-6xl border-t border-line px-5 py-20 md:py-28"
    >
      <div className="grid gap-10 md:grid-cols-[minmax(0,380px)_1fr] md:gap-20">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            <span className="text-accent">/ 03</span> FAQ
          </p>
          <h2 className="mt-6 text-3xl font-medium tracking-tight md:text-5xl">
            Calm by design
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            Short answers to the questions everyone asks first.
          </p>
        </div>

        <div className="divide-y divide-line border-t border-line md:mt-2">
          {faqs.map(({ q, a }, i) => {
            const isOpen = open === i;
            return (
              <div key={q} className="group">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-baseline gap-5 py-6 text-left"
                >
                  <span
                    className={
                      "shrink-0 font-mono text-sm transition-colors " +
                      (isOpen ? "text-accent" : "text-muted group-hover:text-accent")
                    }
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={
                      "flex-1 text-base font-medium transition-[color,transform] duration-200 md:text-lg " +
                      (isOpen
                        ? "text-accent"
                        : "text-ink group-hover:translate-x-1 group-hover:text-accent")
                    }
                  >
                    {q}
                  </span>
                  <Plus
                    size={18}
                    strokeWidth={1.5}
                    className={
                      "shrink-0 self-center transition-transform duration-300 " +
                      (isOpen
                        ? "rotate-45 text-accent"
                        : "text-muted group-hover:text-ink")
                    }
                  />
                </button>
                <div
                  className={
                    "grid transition-[grid-template-rows] duration-300 ease-out " +
                    (isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")
                  }
                >
                  <div className="overflow-hidden">
                    <p className="max-w-xl pb-6 pl-[calc(1.25rem+2ch)] text-sm leading-relaxed text-muted md:text-[15px]">
                      {a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
