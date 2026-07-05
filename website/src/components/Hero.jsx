import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import BrowserDemo from "./BrowserDemo.jsx";

// The accent word is typed out, held, backspaced, and replaced — a live
// typewriter that promises the motion the demo below delivers.
const WORDS = ["building.", "thinking.", "solving.", "shipping."];
const TYPE_MS = 75; // per character, typing
const ERASE_MS = 42; // per character, backspacing
const HOLD_MS = 2100; // pause on the complete word

export default function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [len, setLen] = useState(WORDS[0].length);
  const [deleting, setDeleting] = useState(false);
  const [animate] = useState(() => {
    try {
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return true;
    }
  });

  useEffect(() => {
    if (!animate) return;
    const word = WORDS[wordIndex];
    const delay = deleting ? ERASE_MS : len === word.length ? HOLD_MS : TYPE_MS;
    const t = setTimeout(() => {
      if (!deleting) {
        if (len < word.length) setLen(len + 1);
        else setDeleting(true);
      } else if (len > 0) {
        setLen(len - 1);
      } else {
        setDeleting(false);
        setWordIndex((wordIndex + 1) % WORDS.length);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [animate, len, deleting, wordIndex]);

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center md:pt-28">
        <p className="reveal font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          <span className="text-accent">/ 00</span> Socratic AI code review —
          hints, not answers
        </p>

        <h1 className="reveal-2 mx-auto mt-6 max-w-3xl text-5xl font-medium leading-[1.05] tracking-tight md:text-7xl">
          {/* The block centers as a whole, but lines left-align inside it,
              so "Stop" and "Start" share the same left edge. */}
          <span className="inline-block text-left">
          Stop scrolling.
          <br />
          Start{" "}
          {/* Screen readers get a stable sentence; the typewriter is visual. */}
          <span className="sr-only">building.</span>
          {/* Invisible sizer words keep the slot at the widest word's width,
              so the centered line never reflows while characters change. */}
          <span aria-hidden="true" className="inline-grid text-left align-baseline text-accent">
            {WORDS.map((w) => (
              <span key={w} className="invisible col-start-1 row-start-1 whitespace-nowrap">
                {w}
                {/* reserve the caret's width too — otherwise the widest word
                    (shipping.) plus its caret overflows the slot and nudges the
                    centered headline left. Must match the live caret's footprint. */}
                <span className="ml-1 inline-block w-[3px]" />
              </span>
            ))}
            <span className="col-start-1 row-start-1 whitespace-nowrap">
              {animate ? WORDS[wordIndex].slice(0, len) : WORDS[0]}
              <span className="hero-caret ml-1 inline-block h-[0.78em] w-[3px] translate-y-[0.08em] bg-accent" />
            </span>
          </span>
          </span>
        </h1>

        <p className="reveal-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
          Un-Doomed is the Socratic AI code reviewer that{" "}
          <span className="font-medium text-ink">forces you to think</span>. It
          hunts your edge cases, asks the questions that lead you to the bug, and
          only critiques style once your logic is sound.
        </p>

        <div className="reveal-3 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#downloads"
            className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent hover:text-white"
          >
            Get the browser extension
            <ArrowRight
              size={14}
              strokeWidth={1.5}
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            />
          </a>
          <a
            href="#downloads"
            className="rounded-full border border-ink/25 px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent hover:text-white"
          >
            Install the CLI
          </a>
        </div>

        {/* the numbers that matter, in the site's mono label voice */}
        <div className="reveal-3 mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          {["3 reviewers", "4 providers", "0 answers handed over"].map((s) => (
            <span
              key={s}
              className="cursor-default transition-colors hover:text-accent"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="reveal-3 mt-12">
          <BrowserDemo />
        </div>
      </div>
    </section>
  );
}
