import { PHASE_STATUS_META } from "@/lib/constants";
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
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-muted">全体の進捗</span>
        <span className="text-sm font-bold text-primary">{overallPct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
        {phases.map((p, i) => {
          const meta = PHASE_STATUS_META[p.status];
          return (
            <div key={p.id} className="flex min-w-[64px] flex-col items-center">
              <div className="flex items-center">
                <span className={`h-3 w-3 rounded-full ${meta.dot}`} />
                {i < phases.length - 1 && (
                  <span className="ml-3 h-px w-6 bg-border" />
                )}
              </div>
              <span className={`mt-1.5 whitespace-nowrap text-xs ${meta.text}`}>
                {p.name}
              </span>
              {p.total > 0 && (
                <span className="text-[10px] text-muted">{p.progress_pct}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
