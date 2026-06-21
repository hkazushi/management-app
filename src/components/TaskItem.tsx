"use client";

import {
  toggleTaskDone,
  setTaskStatus,
  setTaskPriority,
  deleteTask,
  moveTask,
} from "@/app/(app)/projects/[id]/actions";
import { PRIORITY_OPTIONS, PRIORITY_META } from "@/lib/constants";
import { Icon } from "./Icon";
import type { TaskStatus, TaskPriority } from "@/types/database";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  phase_id: string | null;
};

const menuItem =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-ink hover:bg-white/10";

export function TaskItem({
  projectId,
  task,
}: {
  projectId: string;
  task: Task;
}) {
  const done = task.status === "done";
  const doing = task.status === "doing";
  const phaseId = task.phase_id ?? "";

  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-primary/30 hover:bg-white/[0.07]">
      {/* 完了トグル（手動のみ） */}
      <form action={toggleTaskDone.bind(null, projectId, task.id, !done)}>
        <button
          type="submit"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done
              ? "border-success bg-success text-white"
              : "border-white/25 text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" size={13} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${done ? "text-faint line-through" : "text-ink"}`}
        >
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {doing && (
            <span className="rounded px-1 text-[10px] font-semibold text-primary">
              ● 作業中
            </span>
          )}
          {task.due_date && (
            <span className="flex items-center gap-0.5 text-[11px] text-muted">
              <Icon name="calendar" size={10} />
              {task.due_date}
            </span>
          )}
        </div>
      </div>

      {/* 優先度 */}
      <form action={setTaskPriority.bind(null, projectId, task.id)}>
        <select
          name="priority"
          defaultValue={task.priority}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className={`cursor-pointer rounded-md border-0 px-1.5 py-1 text-xs font-semibold ${PRIORITY_META[task.priority].badge}`}
          aria-label="優先度"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </form>

      {/* その他操作（メニュー集約） */}
      <details className="relative">
        <summary className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted [&::-webkit-details-marker]:hidden hover:bg-white/10 hover:text-ink">
          ⋯
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-white/10 bg-elevated p-1 shadow-pop">
          <form action={setTaskStatus.bind(null, projectId, task.id)}>
            <input type="hidden" name="status" value={doing ? "todo" : "doing"} />
            <button type="submit" className={menuItem}>
              {doing ? "未着手に戻す" : "作業中にする"}
            </button>
          </form>
          <form action={moveTask.bind(null, projectId, task.id, phaseId, "up")}>
            <button type="submit" className={menuItem}>
              <Icon name="up" size={13} /> 上へ
            </button>
          </form>
          <form action={moveTask.bind(null, projectId, task.id, phaseId, "down")}>
            <button type="submit" className={menuItem}>
              <Icon name="down" size={13} /> 下へ
            </button>
          </form>
          <form
            action={deleteTask.bind(null, projectId, task.id)}
            onSubmit={(e) => {
              if (!confirm("このタスクを削除しますか？")) e.preventDefault();
            }}
          >
            <button type="submit" className={`${menuItem} text-danger`}>
              <Icon name="trash" size={13} /> 削除
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}
