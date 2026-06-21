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
    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      {/* 完了トグル（手動のみ） */}
      <form action={toggleTaskDone.bind(null, projectId, task.id, !done)}>
        <button
          type="submit"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          className={`flex h-5 w-5 items-center justify-center rounded-full border ${
            done
              ? "border-success bg-success text-white"
              : "border-muted/50 text-transparent hover:border-primary"
          }`}
        >
          ✓
        </button>
      </form>

      <span
        className={`flex-1 text-sm ${
          done ? "text-muted line-through" : "text-ink"
        }`}
      >
        {task.title}
        {task.due_date && (
          <span className="ml-2 text-xs text-muted">〆{task.due_date}</span>
        )}
      </span>

      {/* 優先度 */}
      <form action={setTaskPriority.bind(null, projectId, task.id)}>
        <select
          name="priority"
          defaultValue={task.priority}
          onChange={submitOnChange}
          className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${PRIORITY_META[task.priority].badge}`}
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
          className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${TASK_STATUS_META[task.status].badge}`}
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
      <div className="flex flex-col">
        <form action={moveTask.bind(null, projectId, task.id, task.phase_id ?? "", "up")}>
          <button
            type="submit"
            aria-label="上へ"
            className="text-xs leading-none text-muted hover:text-ink"
          >
            ▲
          </button>
        </form>
        <form
          action={moveTask.bind(null, projectId, task.id, task.phase_id ?? "", "down")}
        >
          <button
            type="submit"
            aria-label="下へ"
            className="text-xs leading-none text-muted hover:text-ink"
          >
            ▼
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
          className="text-muted hover:text-danger"
        >
          ✕
        </button>
      </form>
    </div>
  );
}
