"use client";

import {
  toggleTaskDone,
  setTaskStatus,
  setTaskPriority,
  deleteTask,
  moveTask,
} from "@/app/(app)/projects/[id]/actions";
import {
  TASK_STATUS_OPTIONS,
  TASK_STATUS_META,
  PRIORITY_OPTIONS,
  PRIORITY_META,
} from "@/lib/constants";
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

const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
  e.currentTarget.form?.requestSubmit();

export function TaskItem({
  projectId,
  task,
}: {
  projectId: string;
  task: Task;
}) {
  const done = task.status === "done";

  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-card transition hover:border-primary/30">
      {/* 完了トグル（手動のみ） */}
      <form action={toggleTaskDone.bind(null, projectId, task.id, !done)}>
        <button
          type="submit"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done
              ? "border-success bg-success text-white"
              : "border-border text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" size={13} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            done ? "text-faint line-through" : "text-ink"
          }`}
        >
          {task.title}
        </p>
        {task.due_date && (
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <Icon name="calendar" size={11} />
            {task.due_date}
          </span>
        )}
      </div>

      {/* 優先度 */}
      <form action={setTaskPriority.bind(null, projectId, task.id)}>
        <select
          name="priority"
          defaultValue={task.priority}
          onChange={submitOnChange}
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

      {/* 状態 */}
      <form action={setTaskStatus.bind(null, projectId, task.id)}>
        <select
          name="status"
          defaultValue={task.status}
          onChange={submitOnChange}
          className={`cursor-pointer rounded-md border-0 px-1.5 py-1 text-xs font-semibold ${TASK_STATUS_META[task.status].badge}`}
          aria-label="状態"
        >
          {TASK_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </form>

      {/* 並べ替え */}
      <div className="flex flex-col text-muted">
        <form action={moveTask.bind(null, projectId, task.id, task.phase_id ?? "", "up")}>
          <button type="submit" aria-label="上へ" className="block hover:text-ink">
            <Icon name="up" size={14} />
          </button>
        </form>
        <form action={moveTask.bind(null, projectId, task.id, task.phase_id ?? "", "down")}>
          <button type="submit" aria-label="下へ" className="block hover:text-ink">
            <Icon name="down" size={14} />
          </button>
        </form>
      </div>

      {/* 削除 */}
      <form
        action={deleteTask.bind(null, projectId, task.id)}
        onSubmit={(e) => {
          if (!confirm("このタスクを削除しますか？")) e.preventDefault();
        }}
      >
        <button
          type="submit"
          aria-label="削除"
          className="text-faint transition hover:text-danger"
        >
          <Icon name="trash" size={15} />
        </button>
      </form>
    </div>
  );
}
