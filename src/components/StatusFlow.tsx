"use client";

import { setProjectStatus } from "@/app/(app)/projects/actions";
import { PROJECT_STATUS_FLOW } from "@/lib/constants";
import { Icon } from "./Icon";
import type { ProjectStatus } from "@/types/database";

// 案件の進行ステージのフロー図。現在地を強調し、タップで変更できる。
export function StatusFlow({
  projectId,
  current,
}: {
  projectId: string;
  current: ProjectStatus;
}) {
  const idx = PROJECT_STATUS_FLOW.indexOf(current);
  const archived = current === "アーカイブ";

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">進行ステージ</span>
        <span className="text-xs text-muted">
          {archived ? "アーカイブ済み" : current}
        </span>
      </div>

      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {PROJECT_STATUS_FLOW.map((s, i) => {
          const state =
            idx < 0
              ? "future"
              : i < idx
                ? "done"
                : i === idx
                  ? "current"
                  : "future";
          return (
            <div key={s} className="flex items-center">
              <form action={setProjectStatus.bind(null, projectId)}>
                <input type="hidden" name="status" value={s} />
                <button
                  type="submit"
                  className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    state === "current"
                      ? "bg-primary text-white shadow-card"
                      : state === "done"
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "bg-black/[0.04] text-muted hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {state === "done" && <Icon name="check" size={12} />}
                  {s}
                </button>
              </form>
              {i < PROJECT_STATUS_FLOW.length - 1 && (
                <span className="mx-0.5 text-faint">
                  <Icon name="back" size={12} className="rotate-180" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <p className="text-[11px] text-faint">ステージをタップで変更</p>
        <form action={setProjectStatus.bind(null, projectId)}>
          <input type="hidden" name="status" value="アーカイブ" />
          <button
            type="submit"
            className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
              archived ? "text-muted" : "text-faint hover:text-danger"
            }`}
          >
            {archived ? "アーカイブ中" : "アーカイブする"}
          </button>
        </form>
      </div>
    </div>
  );
}
