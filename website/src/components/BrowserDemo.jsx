import { useEffect, useRef, useState } from "react";
import {
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  Shield,
  RotateCw,
  Share,
  Plus,
  Copy,
  Lock,
  Code,
  ChevronDown,
  RotateCcw,
  Maximize2,
} from "lucide-react";
import LogoMark from "./LogoMark.jsx";

// The demo is a small state machine so the step indicator below it can be
// clicked: each step auto-advances after its duration, and clicking a chip
// jumps straight to that step (the timer re-arms from there).
const STEPS = [
  { label: "Review requested", duration: 2600 },
  { label: "Analyzing code", duration: 2600 },
  { label: "Edge-case faults", duration: 4200 },
  { label: "Socratic hints", duration: 6500 },
];

// The buggy Two Sum attempt shown in the editor, with syntax-tinted keywords.
const kw = (t) => <span className="text-[#8ab4f8]">{t}</span>;
const CODE_LINES = [
  <>{kw("class")} Solution:</>,
  <>
    {"    "}
    {kw("def")} twoSum(self, nums, target):
  </>,
  <>
    {"        "}
    {kw("for")} i {kw("in")} range(len(nums)):
  </>,
  <>
    {"            "}
    {kw("for")} j {kw("in")} range(len(nums)):
  </>,
  <>
    {"                "}
    {kw("if")} nums[i] + nums[j] == target:
  </>,
  <>
    {"                    "}
    {kw("return")} [i, j]
  </>,
];

// Rise-in transition for review lines: hidden until `on`, then staggered.
function Rise({ on, delay = 0, children, className = "" }) {
  return (
    <div
      style={{ transitionDelay: on ? `${delay}ms` : "0ms" }}
      className={
        "transition-all duration-500 " +
        (on ? "translate-y-0 opacity-100 " : "translate-y-2 opacity-0 ") +
        className
      }
    >
      {children}
    </div>
  );
}

export default function BrowserDemo() {
  const [step, setStep] = useState(0);
  const autoplay = useRef(true);

  // Respect "reduce motion": show the finished state, don't auto-advance
  // (the step chips still work — that's user-initiated).
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        autoplay.current = false;
        setStep(3);
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!autoplay.current) return;
    const t = setTimeout(
      () => setStep((s) => (s + 1) % STEPS.length),
      STEPS[step].duration
    );
    return () => clearTimeout(t);
  }, [step]);

  const panelOpen = step >= 1;
  const loading = step === 1;
  const faultsOn = step >= 2;
  const hintsOn = step >= 3;

  return (
    <div className="mx-auto max-w-5xl">
      <span className="sr-only">
        A looping demo: the Un-Doomed extension reviews a Two Sum solution on
        LeetCode and returns edge-case faults and Socratic hints instead of the
        answer.
      </span>

      <style>{`
        @keyframes bd-spin { to { transform: rotate(360deg); } }
        @keyframes bd-nudge {
          0%, 78%, 100% { transform: scale(1); filter: brightness(1); }
          84% { transform: scale(0.94); filter: brightness(0.82); }
          90% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bd-blink { 0%, 100% { opacity: 1; } 45% { opacity: .15; } }
        .bd-spin { animation: bd-spin 0.8s linear infinite; }
        .bd-nudge { animation: bd-nudge 2.6s ease-in-out infinite; }
        .bd-blink { animation: bd-blink 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bd-spin, .bd-nudge, .bd-blink { animation: none; }
        }
      `}</style>

      {/* ---- The browser window (decorative) ---- */}
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-ink/15 bg-card ring-1 ring-ink/5"
      >
        {/* Safari-style toolbar: lights · sidebar · back/forward · shield ·
            centered address pill with reload · share / new tab / tabs */}
        <div className="flex items-center gap-1 border-b border-line px-3 py-2 text-muted">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="ml-1 h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="ml-1 h-3 w-3 rounded-full bg-[#28c840]" />
          <PanelLeft size={14} strokeWidth={1.5} className="ml-3" />
          <ChevronLeft size={15} strokeWidth={1.5} className="ml-2" />
          <ChevronRight size={15} strokeWidth={1.5} className="opacity-40" />
          <Shield size={13} strokeWidth={1.5} className="ml-2 hidden sm:block" />
          <div className="mx-2 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 font-mono text-[11px] sm:mx-3">
            <Lock size={10} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">leetcode.com/problems/two-sum</span>
            <RotateCw size={11} strokeWidth={1.5} className="ml-auto shrink-0" />
          </div>
          <Share size={14} strokeWidth={1.5} className="hidden sm:block" />
          <Plus size={14} strokeWidth={1.5} className="ml-2 hidden sm:block" />
          <Copy size={14} strokeWidth={1.5} className="ml-2 hidden sm:block" />
        </div>

        {/* Content area */}
        <div className="relative flex min-h-[430px]">
          {/* Left problem pane — LeetCode's dark description panel */}
          <div className="hidden w-[38%] border-r border-[#333338] bg-[#262626] p-5 text-left md:block">
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#eff1f6]">1. Two Sum</span>
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono text-[10px] text-[#00b8a3]">
                Easy
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-[#b3b4b8]">
              <p>
                Given an array of integers{" "}
                <code className="rounded bg-white/10 px-1 font-mono text-[11px] text-[#eff1f6]">
                  nums
                </code>{" "}
                and an integer{" "}
                <code className="rounded bg-white/10 px-1 font-mono text-[11px] text-[#eff1f6]">
                  target
                </code>
                , return indices of the two numbers such that they add up to
                target.
              </p>
              <p>
                You may assume that each input would have exactly one solution.
              </p>
              <p>You may not use the same element twice.</p>
            </div>
            <div className="mt-4 rounded-md bg-white/[0.07] p-3 font-mono text-[11px] leading-relaxed text-[#b3b4b8]">
              <div>
                <span className="font-semibold text-[#eff1f6]">Input:</span>{" "}
                nums = [2,7,11,15], target = 9
              </div>
              <div>
                <span className="font-semibold text-[#eff1f6]">Output:</span>{" "}
                [0,1]
              </div>
            </div>
          </div>

          {/* Right editor pane — with a numbered gutter, like a real editor */}
          <div className="flex-1 bg-[#17171a] text-[#d4d4d8]">
            <div className="flex items-center border-b border-[#26262b] px-4 py-2 font-mono text-[11px] text-[#8a8a93]">
              <Code size={13} strokeWidth={1.5} />
              <span className="ml-1.5">Code</span>
              <span className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1 text-[#b8b8c0]">
                  Python3
                  <ChevronDown size={12} strokeWidth={1.5} />
                </span>
                <RotateCcw size={12} strokeWidth={1.5} className="opacity-60" />
                <Maximize2 size={12} strokeWidth={1.5} className="opacity-60" />
              </span>
            </div>
            <div className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed">
              {CODE_LINES.map((line, i) => (
                <div key={i} className="flex whitespace-pre">
                  <span className="w-6 shrink-0 select-none pr-3 text-right text-[#4c4c55]">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Launcher pill (nudges while waiting on step 1) */}
          <div className="absolute bottom-4 right-4 flex overflow-hidden rounded-full text-[12px] font-medium text-white shadow-lg">
            <span className="flex items-center gap-1.5 bg-accent px-3 py-1.5">
              <LogoMark size={15} stroke="#ffffff" knockout="#2563eb" />
              Un-Doomed
            </span>
            <span
              className={
                "bg-accent-dark px-3 py-1.5 " + (step === 0 ? "bd-nudge" : "")
              }
            >
              Review
            </span>
          </div>

          {/* Review panel */}
          <div
            className={
              "absolute inset-y-0 right-0 flex w-[62%] flex-col border-l border-line bg-card transition-transform duration-500 ease-out md:w-[46%] " +
              (panelOpen ? "translate-x-0" : "translate-x-[105%]")
            }
          >
            <div className="flex items-center gap-2.5 border-b border-line p-3.5">
              <LogoMark size={26} knockout="#faf9f2" />
              <div className="text-left leading-tight">
                <div className="text-[13px] font-semibold tracking-tight">
                  Un-
                  <span className="line-through decoration-accent decoration-2">
                    Doomed
                  </span>
                </div>
                <div className="font-mono text-[10px] text-muted">
                  Hints, not answers.
                </div>
              </div>
            </div>

            <div className="space-y-3 p-4 text-left">
              {/* loading row (collapses once the verdict lands) */}
              <div
                className={
                  "flex items-center gap-2 overflow-hidden transition-all duration-300 " +
                  (loading ? "max-h-8 opacity-100" : "max-h-0 opacity-0")
                }
              >
                <span className="bd-spin h-4 w-4 rounded-full border-2 border-line border-t-accent" />
                <span className="text-[12px] text-muted">
                  Reviewing your code…
                </span>
              </div>

              <Rise on={faultsOn}>
                <span className="inline-block rounded-full bg-ink px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-surface">
                  NEEDS REVISION
                </span>
              </Rise>

              <div className="space-y-2">
                <Rise on={faultsOn} delay={150}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    Edge-case faults
                  </p>
                </Rise>
                <Rise on={faultsOn} delay={300}>
                  <p className="text-[12px] leading-relaxed">
                    <span className="text-accent">→ </span>
                    nums = [3,3] — j can pick the same index twice.
                  </p>
                </Rise>
                <Rise on={faultsOn} delay={450}>
                  <p className="text-[12px] leading-relaxed">
                    <span className="text-accent">→ </span>
                    No pair sums to target? The function returns None.
                  </p>
                </Rise>
              </div>

              <div className="space-y-2">
                <Rise on={hintsOn}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    Socratic hints
                  </p>
                </Rise>
                <Rise on={hintsOn} delay={150}>
                  <p className="text-[12.5px] italic leading-relaxed">
                    What should j start from so a number can never pair with
                    itself?
                  </p>
                </Rise>
                <Rise on={hintsOn} delay={300}>
                  <p className="text-[12.5px] italic leading-relaxed">
                    Trace nums = [1, 2], target = 4 — where does your function
                    end?
                  </p>
                </Rise>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Step indicator: a progress rail — blue up to the current step,
              light beyond it — with clickable chips ---- */}
      <div className="relative mt-7">
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 top-1/2 hidden h-[2px] -translate-y-1/2 bg-line sm:block"
        />
        <div
          aria-hidden="true"
          style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
          className="absolute left-0 top-1/2 hidden h-[2px] -translate-y-1/2 bg-accent transition-[width] duration-500 ease-out sm:block"
        />
        <div className="relative flex flex-wrap items-center justify-center gap-2 sm:flex-nowrap sm:justify-between">
          {STEPS.map((s, i) => {
            const reached = i < step;
            const active = i === step;
            return (
              <button
                key={s.label}
                type="button"
                onClick={() => setStep(i)}
                aria-label={`Show demo step ${i + 1}: ${s.label}`}
                aria-current={active ? "step" : undefined}
                className={
                  "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors " +
                  (active
                    ? "border-ink bg-ink text-surface"
                    : reached
                      ? "border-accent/40 bg-card text-ink hover:border-accent"
                      : "border-line bg-card text-muted hover:border-ink/40 hover:text-ink")
                }
              >
                {active ? (
                  <span className="bd-blink h-1.5 w-1.5 rounded-full bg-[#8ab4f8]" />
                ) : (
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (reached ? "bg-accent" : "bg-muted/40")
                    }
                  />
                )}
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
