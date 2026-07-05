import { useEffect, useRef, useState } from "react";
import { Crosshair, MessageCircleQuestion, Braces } from "lucide-react";

// =============================================================================
// How it works — an auxia-style journey: a vertical rail that fills with blue
// as you scroll, three stages pinned to it (one per reviewer), each with a
// small self-playing demo card showing what that agent actually does.
// =============================================================================

/* ---- Stage demo 1: the Executioner sweeps edge cases ---------------------- */
function ExecutionerDemo() {
  const rows = [
    ["nums = []", "returns None", false],
    ["nums = [3, 3]", "same index twice", false],
    ["no valid pair", "returns nothing", false],
    ["nums = [2, 7, 11, 15]", "[0, 1]", true],
  ];
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-card p-5"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <span className="hiw-blink h-1.5 w-1.5 rounded-full bg-accent" />
        Edge-case sweep
      </p>
      <div className="mt-4 space-y-2 font-mono text-[11.5px]">
        {rows.map(([input, result, ok], i) => (
          <div
            key={input}
            className={`hiw-rise hx-r${i + 1} flex items-baseline justify-between gap-3`}
          >
            <span className="truncate">{input}</span>
            <span
              className={
                "shrink-0 " + (ok ? "text-accent" : "font-semibold text-ink")
              }
            >
              {ok ? "✓ " : "✗ "}
              <span className="font-normal text-muted">{result}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="hiw-rise hx-chip mt-4">
        <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-surface">
          3 FAULTS FOUND
        </span>
      </div>
    </div>
  );
}

/* ---- Stage demo 2: the Tutor asks, never answers -------------------------- */
function TutorDemo() {
  const Dots = ({ className }) => (
    <div className={`${className} flex w-fit gap-1 rounded-full border border-line bg-surface px-3 py-2`}>
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="hiw-dot h-1.5 w-1.5 rounded-full bg-muted"
          style={{ animationDelay: `${d * 0.18}s` }}
        />
      ))}
    </div>
  );
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-card p-5"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <span className="hiw-blink h-1.5 w-1.5 rounded-full bg-accent" />
        Socratic hints
      </p>
      <div className="mt-4 space-y-2.5 text-[12.5px]">
        <Dots className="ht-t1" />
        <p className="hiw-rise ht-b1 w-fit max-w-[90%] rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 italic leading-relaxed">
          What does your function return when nums is empty?
        </p>
        <Dots className="ht-t2" />
        <p className="hiw-rise ht-b2 w-fit max-w-[90%] rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 italic leading-relaxed">
          Which values of j can collide with i — and what rules that out?
        </p>
        <p className="hiw-rise ht-note font-mono text-[10px] uppercase tracking-[0.15em] text-accent">
          Zero code handed over
        </p>
      </div>
    </div>
  );
}

/* ---- Stage demo 3: the Critic polishes complexity + style ----------------- */
function CriticDemo() {
  const checks = ["single pass", "clear naming", "early return"];
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-line bg-card p-5"
    >
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        <span className="hiw-blink h-1.5 w-1.5 rounded-full bg-accent" />
        Style review
      </p>
      <div className="mt-4 flex items-center gap-3 font-mono text-[15px]">
        <span className="relative inline-block text-muted">
          O(n²)
          <span className="hc-strike absolute left-0 top-1/2 h-[2px] w-full origin-left bg-ink" />
        </span>
        <span className="hiw-rise hc-arrow text-muted">→</span>
        <span className="hiw-rise hc-on font-semibold text-accent">O(n)</span>
      </div>
      <div className="mt-4 space-y-2 font-mono text-[11.5px]">
        {checks.map((c, i) => (
          <div key={c} className={`hiw-rise hc-c${i + 1} flex items-center gap-2`}>
            <span className="text-accent">✓</span>
            <span className="text-muted">{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STAGES = [
  {
    tag: "01 · Hunts faults",
    Icon: Crosshair,
    title: "Edge-Case Executioner",
    body: (
      <>
        A ruthless auditor that checks correctness first — empty inputs,
        duplicates, "no solution", off-by-ones. Style comes later.
      </>
    ),
    Demo: ExecutionerDemo,
  },
  {
    tag: "02 · Asks questions",
    Icon: MessageCircleQuestion,
    title: "Socratic Tutor",
    body: (
      <>
        Turns each bug into a question that leads you to the fix yourself — zero
        code handed over (until you're truly stuck).
      </>
    ),
    Demo: TutorDemo,
  },
  {
    tag: "03 · Polishes style",
    Icon: Braces,
    title: "Clean-Code Critic",
    body: (
      <>
        Once your logic is sound, it reviews Big-O complexity and style — so you
        ship code that's correct <em>and</em> clean.
      </>
    ),
    Demo: CriticDemo,
  },
];

export default function HowItWorks() {
  const railRef = useRef(null);
  const fillRef = useRef(null);
  const dashRef = useRef(null);
  const stageEls = useRef([]);
  const [seen, setSeen] = useState([false, false, false]);
  // Geometry of the snaking connector, measured from the real layout:
  // { w, h, d (SVG path), mids: [y between 1&2, y between 2&3] }
  const [geo, setGeo] = useState(null);

  // Measure the stages and build the zig-zag path: down the left edge of
  // stage 1, a rounded turn across the page, down the right edge of stage 2,
  // and back across to the left for stage 3.
  useEffect(() => {
    const measure = () => {
      const rail = railRef.current;
      const els = stageEls.current.filter(Boolean);
      if (!rail || els.length < 3) return;
      const w = rail.clientWidth;
      const h = rail.clientHeight;
      const tops = els.map((el) => el.offsetTop);
      const bots = els.map((el) => el.offsetTop + el.offsetHeight);
      const m0 = (bots[0] + tops[1]) / 2;
      const m1 = (bots[1] + tops[2]) / 2;
      const xL = 9;
      const xR = w - 9;
      const r = 24;
      const y0 = Math.max(tops[0] - 8, 0);
      const d =
        `M ${xL} ${y0} V ${m0 - r} Q ${xL} ${m0} ${xL + r} ${m0} ` +
        `H ${xR - r} Q ${xR} ${m0} ${xR} ${m0 + r} V ${m1 - r} ` +
        `Q ${xR} ${m1} ${xR - r} ${m1} H ${xL + r} ` +
        `Q ${xL} ${m1} ${xL} ${m1 + r} V ${bots[2]}`;
      setGeo({ w, h, d, mids: [m0, m1] });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (railRef.current) ro.observe(railRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // As the section scrolls through the viewport the connector draws itself:
  // the mobile straight rail via scaleY, the desktop snake via dash offset.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rail = railRef.current;
        if (!rail) return;
        const r = rail.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const total = Math.max(r.height - vh * 0.35, 1);
        const p = Math.min(1, Math.max(0, (vh * 0.7 - r.top) / total));
        if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
        if (dashRef.current)
          dashRef.current.style.strokeDashoffset = String(1 - p);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Stages fade up (once) as they enter the viewport.
  useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSeen([true, true, true]);
        return;
      }
    } catch (_) {
      /* ignore */
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const i = Number(e.target.dataset.idx);
          setSeen((prev) =>
            prev[i] ? prev : prev.map((v, j) => (j === i ? true : v))
          );
        });
      },
      { threshold: 0.3 }
    );
    stageEls.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="how"
      className="mx-auto max-w-6xl border-t border-line px-5 py-20 md:py-28"
    >
      <span className="sr-only">
        The three reviewers each demonstrate their role: the Executioner sweeps
        edge cases and finds faults, the Tutor asks Socratic questions, and the
        Critic reviews complexity and style.
      </span>

      <style>{`
        .hiw-rise { opacity: 0; transform: translateY(6px); animation: none 9s ease-in-out infinite; }
        .hiw-blink { animation: hiw-blink 1.2s ease-in-out infinite; }
        .hiw-dot { animation: hiw-dot 1s ease-in-out infinite; }
        .hc-strike { transform: scaleX(0); animation: kf-strike 9s ease-in-out infinite; }
        .ht-t1, .ht-t2 { opacity: 0; }
        @keyframes hiw-blink { 0%, 100% { opacity: 1; } 45% { opacity: .15; } }
        @keyframes hiw-dot { 0%, 100% { opacity: .25; } 40% { opacity: 1; } }

        /* All demos share one 9s clock; every element has an explicit window
           so the whole card resets together at the loop boundary. */
        @keyframes kf-r7  { 0%, 7%  { opacity: 0; transform: translateY(6px); } 11%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r19 { 0%, 19% { opacity: 0; transform: translateY(6px); } 23%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r31 { 0%, 31% { opacity: 0; transform: translateY(6px); } 35%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r43 { 0%, 43% { opacity: 0; transform: translateY(6px); } 47%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r56 { 0%, 56% { opacity: 0; transform: translateY(6px); } 60%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r24 { 0%, 24% { opacity: 0; transform: translateY(6px); } 28%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r36 { 0%, 36% { opacity: 0; transform: translateY(6px); } 40%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r49 { 0%, 49% { opacity: 0; transform: translateY(6px); } 53%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r58 { 0%, 58% { opacity: 0; transform: translateY(6px); } 62%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r67 { 0%, 67% { opacity: 0; transform: translateY(6px); } 71%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-r73 { 0%, 73% { opacity: 0; transform: translateY(6px); } 77%, 88% { opacity: 1; transform: translateY(0); } 93%, 100% { opacity: 0; transform: translateY(6px); } }
        @keyframes kf-t1 { 0%, 4%  { opacity: 0; } 7%, 20%  { opacity: 1; } 24%, 100% { opacity: 0; } }
        @keyframes kf-t2 { 0%, 40% { opacity: 0; } 43%, 56% { opacity: 1; } 60%, 100% { opacity: 0; } }
        @keyframes kf-strike { 0%, 24% { transform: scaleX(0); } 32%, 88% { transform: scaleX(1); } 93%, 100% { transform: scaleX(0); } }

        /* Executioner: rows sweep in, verdict chip lands */
        .hx-r1 { animation-name: kf-r7; }
        .hx-r2 { animation-name: kf-r19; }
        .hx-r3 { animation-name: kf-r31; }
        .hx-r4 { animation-name: kf-r43; }
        .hx-chip { animation-name: kf-r56; }
        /* Tutor: typing… question… typing… question… principle */
        .ht-t1 { animation: kf-t1 9s ease-in-out infinite; }
        .ht-b1 { animation-name: kf-r24; }
        .ht-t2 { animation: kf-t2 9s ease-in-out infinite; }
        .ht-b2 { animation-name: kf-r58; }
        .ht-note { animation-name: kf-r73; }
        /* Critic: complexity improves, checklist lands */
        .hc-arrow { animation-name: kf-r31; }
        .hc-on { animation-name: kf-r36; }
        .hc-c1 { animation-name: kf-r49; }
        .hc-c2 { animation-name: kf-r58; }
        .hc-c3 { animation-name: kf-r67; }

        @media (prefers-reduced-motion: reduce) {
          .hiw-rise, .hc-strike, .ht-t1, .ht-t2, .hiw-blink, .hiw-dot { animation: none; }
          .hiw-rise { opacity: 1; transform: translateY(0); }
          .hc-strike { transform: scaleX(1); }
          .ht-t1, .ht-t2 { display: none; }
        }
      `}</style>

      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent">/ 01</span> HOW IT WORKS
      </p>

      <div className="mt-6 max-w-2xl">
        <h2 className="text-3xl font-medium tracking-tight md:text-5xl">
          Three reviewers, one rule:{" "}
          <span className="italic text-accent">make you think.</span>
        </h2>
        <p className="mt-4 text-muted">
          Un-Doomed never just hands over the answer. It reviews in the order a
          great mentor would.
        </p>
      </div>

      {/* The journey: a connector that snakes down the page — beside stage 1
          on the left, a rounded turn across to stage 2 on the right, and back
          to the left for stage 3 — drawing itself in blue as you scroll.
          On mobile it collapses to a straight left rail. */}
      <div ref={railRef} className="relative mt-16 md:mt-20">
        {/* mobile: straight rail */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-[7px] top-0 w-[2px] bg-line md:hidden"
        />
        <div
          ref={fillRef}
          aria-hidden="true"
          style={{ transform: "scaleY(0)" }}
          className="absolute bottom-0 left-[7px] top-0 w-[2px] origin-top bg-accent md:hidden"
        />

        {/* desktop: the measured snake */}
        {geo && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block"
            width="100%"
            height="100%"
            viewBox={`0 0 ${geo.w} ${geo.h}`}
            preserveAspectRatio="none"
            fill="none"
          >
            <path d={geo.d} stroke="#dcd9c8" strokeWidth="2" />
            <path
              ref={dashRef}
              d={geo.d}
              stroke="#2563eb"
              strokeWidth="2"
              pathLength="1"
              strokeDasharray="1"
              strokeLinecap="round"
              style={{ strokeDashoffset: 1 }}
            />
          </svg>
        )}

        {/* captions sitting on the horizontal runs, auxia-style */}
        {geo &&
          ["Faults become questions", "Logic sound — style next"].map(
            (t, i) => (
              <span
                key={t}
                style={{ top: geo.mids[i] }}
                className="absolute left-1/2 hidden -translate-x-1/2 -translate-y-1/2 bg-surface px-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted md:block"
              >
                {t}
              </span>
            )
          )}

        <div className="space-y-20 md:space-y-32">
          {STAGES.map(({ tag, Icon, title, body, Demo }, i) => {
            const flip = i % 2 === 1; // odd stages sit on the right
            return (
              <div
                key={title}
                data-idx={i}
                ref={(el) => (stageEls.current[i] = el)}
                className="relative pl-10 md:pl-0"
              >
                {/* node on the rail (mobile only — the snake replaces it) */}
                <span
                  aria-hidden="true"
                  className={
                    "absolute left-0 top-2 h-4 w-4 rounded-full border-2 transition-colors duration-500 md:hidden " +
                    (seen[i]
                      ? "border-accent bg-accent"
                      : "border-line bg-card")
                  }
                />

                <div
                  className={
                    "grid items-start gap-8 transition-all duration-700 md:grid-cols-2 " +
                    (seen[i]
                      ? "translate-y-0 opacity-100"
                      : "translate-y-6 opacity-0")
                  }
                >
                  <div
                    className={
                      "md:max-w-sm " +
                      (flip
                        ? "md:order-2 md:justify-self-end md:pr-12"
                        : "md:justify-self-start md:pl-12")
                    }
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                      {tag}
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2.5 rounded-full bg-ink px-5 py-2.5 text-surface">
                      <Icon
                        size={16}
                        strokeWidth={1.75}
                        className="text-[#8ab4f8]"
                      />
                      <span className="text-sm font-medium">{title}</span>
                    </div>
                    <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
                      {body}
                    </p>
                  </div>
                  <div
                    className={
                      "w-full max-w-md " +
                      (flip
                        ? "md:order-1 md:justify-self-end md:pr-14"
                        : "md:justify-self-start md:pl-14")
                    }
                  >
                    <Demo />
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
