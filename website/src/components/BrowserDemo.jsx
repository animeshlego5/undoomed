import { Lock } from "lucide-react";

export default function BrowserDemo() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-ink/15 bg-card ring-1 ring-ink/5"
    >
      <span className="sr-only">
        A looping demo: the Un-doomed extension reviews a Two Sum solution on
        LeetCode and returns edge-case faults and Socratic hints instead of the
        answer.
      </span>

      <style>{`
        .bd-launcher-review {
          animation: bd-click 16s ease-in-out infinite;
        }
        .bd-panel {
          transform: translateX(105%);
          animation: bd-panel 16s ease-in-out infinite;
        }
        .bd-loading {
          opacity: 0;
          max-height: 0;
          overflow: hidden;
          animation: bd-loading 16s ease-in-out infinite;
        }
        .bd-spin {
          animation: bd-spin 0.8s linear infinite;
        }
        .bd-rise {
          opacity: 0;
          transform: translateY(8px);
        }
        .bd-verdict { animation: bd-verdict 16s ease-in-out infinite; }
        .bd-faultlabel { animation: bd-faultlabel 16s ease-in-out infinite; }
        .bd-fault1 { animation: bd-fault1 16s ease-in-out infinite; }
        .bd-fault2 { animation: bd-fault2 16s ease-in-out infinite; }
        .bd-hintlabel { animation: bd-hintlabel 16s ease-in-out infinite; }
        .bd-hint1 { animation: bd-hint1 16s ease-in-out infinite; }
        .bd-hint2 { animation: bd-hint2 16s ease-in-out infinite; }

        @keyframes bd-click {
          0%, 5% { transform: scale(1); filter: brightness(1); }
          6% { transform: scale(0.94); filter: brightness(0.82); }
          8% { transform: scale(1); filter: brightness(1); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes bd-panel {
          0%, 8% { transform: translateX(105%); }
          11%, 90% { transform: translateX(0); }
          95%, 100% { transform: translateX(105%); }
        }
        @keyframes bd-loading {
          0%, 10% { opacity: 0; max-height: 0; }
          11%, 26% { opacity: 1; max-height: 2rem; }
          28%, 100% { opacity: 0; max-height: 0; }
        }
        @keyframes bd-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bd-verdict {
          0%, 27% { opacity: 0; transform: translateY(8px); }
          30%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-faultlabel {
          0%, 30% { opacity: 0; transform: translateY(8px); }
          33%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-fault1 {
          0%, 34% { opacity: 0; transform: translateY(8px); }
          37%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-fault2 {
          0%, 38% { opacity: 0; transform: translateY(8px); }
          41%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-hintlabel {
          0%, 46% { opacity: 0; transform: translateY(8px); }
          49%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-hint1 {
          0%, 51% { opacity: 0; transform: translateY(8px); }
          54%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }
        @keyframes bd-hint2 {
          0%, 56% { opacity: 0; transform: translateY(8px); }
          59%, 88% { opacity: 1; transform: translateY(0); }
          90%, 100% { opacity: 0; transform: translateY(8px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .bd-launcher-review,
          .bd-spin { animation: none; }
          .bd-panel { animation: none; transform: translateX(0); }
          .bd-loading { animation: none; opacity: 0; max-height: 0; }
          .bd-verdict, .bd-faultlabel, .bd-fault1, .bd-fault2,
          .bd-hintlabel, .bd-hint1, .bd-hint2 {
            animation: none; opacity: 1; transform: translateY(0);
          }
        }
      `}</style>

      {/* Title bar */}
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <div className="mx-auto flex items-center gap-1.5 rounded-md bg-surface px-3 py-1 font-mono text-[11px] text-muted">
          <Lock size={10} strokeWidth={1.5} />
          leetcode.com/problems/two-sum
        </div>
      </div>

      {/* Content area */}
      <div className="relative flex min-h-[430px]">
        {/* Left problem pane */}
        <div className="hidden w-[38%] border-r border-line p-5 text-left md:block">
          <div className="flex items-center gap-2">
            <span className="font-medium">1. Two Sum</span>
            <span className="rounded-full border border-line px-2 font-mono text-[10px] text-muted">
              Easy
            </span>
          </div>
          <div className="mt-3 space-y-1.5 text-[12px] leading-relaxed text-muted">
            <p>
              Given an array of integers nums and an integer target, return
              indices of the two numbers such that they add up to target.
            </p>
            <p>
              You may assume that each input would have exactly one solution.
            </p>
            <p>You may not use the same element twice.</p>
          </div>
          <div className="mt-4 rounded-md bg-surface p-3 font-mono text-[11px] leading-relaxed">
            <div>
              <span className="text-muted">Input:</span> nums = [2,7,11,15],
              target = 9
            </div>
            <div>
              <span className="text-muted">Output:</span> [0,1]
            </div>
          </div>
        </div>

        {/* Right editor pane */}
        <div className="flex-1 bg-[#17171a] text-[#d4d4d8]">
          <div className="border-b border-[#26262b] px-4 py-2 font-mono text-[11px] text-[#8a8a93]">
            solution.py
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed">
            <code>
              <span className="text-[#8ab4f8]">class</span> Solution:{"\n"}
              {"    "}
              <span className="text-[#8ab4f8]">def</span> twoSum(self, nums,
              target):{"\n"}
              {"        "}
              <span className="text-[#8ab4f8]">for</span> i{" "}
              <span className="text-[#8ab4f8]">in</span> range(len(nums)):{"\n"}
              {"            "}
              <span className="text-[#8ab4f8]">for</span> j{" "}
              <span className="text-[#8ab4f8]">in</span> range(len(nums)):{"\n"}
              {"                "}
              <span className="text-[#8ab4f8]">if</span> nums[i] + nums[j] =={" "}
              target:{"\n"}
              {"                    "}
              <span className="text-[#8ab4f8]">return</span> [i, j]
            </code>
          </pre>
        </div>

        {/* Launcher pill */}
        <div className="absolute bottom-4 right-4 flex overflow-hidden rounded-full text-[12px] font-medium text-white shadow-lg">
          <span className="flex items-center gap-1.5 bg-accent px-3 py-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
              ?
            </span>
            Un-doomed
          </span>
          <span className="bd-launcher-review bg-accent-dark px-3 py-1.5">
            Review
          </span>
        </div>

        {/* Review panel */}
        <div className="bd-panel absolute inset-y-0 right-0 flex w-[62%] flex-col border-l border-line bg-card md:w-[46%]">
          <div className="flex items-center gap-2.5 border-b border-line p-3.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm font-bold text-white">
              ?
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-medium">Un-doomed</div>
              <div className="font-mono text-[10px] text-muted">
                Hints, not answers.
              </div>
            </div>
          </div>

          <div className="space-y-3 p-4 text-left">
            {/* loading row */}
            <div className="bd-loading flex items-center gap-2">
              <span className="bd-spin h-4 w-4 rounded-full border-2 border-line border-t-accent" />
              <span className="text-[12px] text-muted">
                Reviewing your code…
              </span>
            </div>

            {/* verdict */}
            <div>
              <span className="bd-verdict inline-block rounded-full bg-ink px-2.5 py-1 font-mono text-[9px] tracking-[0.15em] text-surface">
                NEEDS REVISION
              </span>
            </div>

            {/* faults */}
            <div className="space-y-2">
              <p className="bd-faultlabel font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Edge-case faults
              </p>
              <p className="bd-fault1 text-[12px] leading-relaxed">
                <span className="text-accent">→ </span>
                nums = [3,3] — j can pick the same index twice.
              </p>
              <p className="bd-fault2 text-[12px] leading-relaxed">
                <span className="text-accent">→ </span>
                No pair sums to target? The function returns None.
              </p>
            </div>

            {/* hints */}
            <div className="space-y-2">
              <p className="bd-hintlabel font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Socratic hints
              </p>
              <p className="bd-hint1 text-[12.5px] italic leading-relaxed">
                What should j start from so a number can never pair with itself?
              </p>
              <p className="bd-hint2 text-[12.5px] italic leading-relaxed">
                Trace nums = [1, 2], target = 4 — where does your function end?
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
