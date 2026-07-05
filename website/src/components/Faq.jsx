import { Plus } from "lucide-react";

const faqs = [
  {
    q: 'Why "Un-doomed"?',
    a: (
      <>
        It saves you from the two dooms of learning to code: getting stuck for
        hours, or copy-pasting an answer you don't understand. You stay in the
        productive middle — thinking.
      </>
    ),
    open: true,
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
        your chosen AI provider with your key. No Un-doomed cloud in between.
      </>
    ),
  },
];

export default function Faq() {
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
        {faqs.map(({ q, a, open }) => (
          <details key={q} className="group py-5" open={open}>
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              {q}
              <Plus
                size={16}
                strokeWidth={1.5}
                className="text-muted transition-transform group-open:rotate-45"
              />
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
