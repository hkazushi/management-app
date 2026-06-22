import { PHASE_STATUS_META } from "@/lib/constants";
import { Icon } from "./Icon";
import type { PhaseStatus } from "@/types/database";

type StepPhase = {
  id: string;
  name: string;
  status: PhaseStatus;
  progress_pct: number;
  total: number;
};

// フェーズの進捗ステッパー（spec §3.2）。横スクロールでモバイル対応。
export function PhaseStepper({
  phases,
  overallPct,
}: {
  phases: StepPhase[];
  overallPct: number;
}) {
  return (
    <div className="card p-4">
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">全体の進捗</span>
        <span className="text-lg font-bold text-primary">{overallPct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
        {phases.map((p, i) => {
          const meta = PHASE_STATUS_META[p.status];
          const isDone = p.status === "done";
          const isProg = p.status === "in_progress";
          return (
            <div
              key={p.id}
              className="flex min-w-[58px] flex-col items-center gap-1"
            >
              <div className="flex w-full items-center">
                <span className="h-0.5 flex-1 bg-transparent" />
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? "bg-success text-white"
                      : isProg
                        ? "bg-primary text-white"
                        : "border-2 border-border bg-surface text-faint"
                  }`}
                >
                  {isDone ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span
                  className={`h-0.5 flex-1 ${i < phases.length - 1 ? "bg-border" : "bg-transparent"}`}
                />
              </div>
              <span
                className={`whitespace-nowrap text-[11px] font-medium ${meta.text}`}
              >
                {p.name}
              </span>
              {p.total > 0 && (
                <span className="text-[10px] text-faint">{p.progress_pct}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
