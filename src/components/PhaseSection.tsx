"use client";

import { useState } from "react";
import { PhaseStatusSelect } from "./PhaseStatusSelect";
import { AddTaskForm } from "./AddTaskForm";
import { TaskItem } from "./TaskItem";
import { Icon } from "./Icon";
import type { PhaseStatus, TaskStatus, TaskPriority } from "@/types/database";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  phase_id: string | null;
};

export function PhaseSection({
  projectId,
  phase,
  tasks,
  done,
  total,
}: {
  projectId: string;
  phase: { id: string; name: string; status: PhaseStatus };
  tasks: Task[];
  done: number;
  total: number;
}) {
  const [open, setOpen] = useState(tasks.length > 0);
  const isDone = phase.status === "done";
  const isProg = phase.status === "in_progress";
  const pct = total ? Math.round((100 * done) / total) : 0;

  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              isDone
                ? "bg-success text-white"
                : isProg
                  ? "bg-primary text-white"
                  : "border-2 border-border text-faint"
            }`}
          >
            {isDone ? <Icon name="check" size={13} /> : total ? `${pct}` : "·"}
          </span>
          <span className="truncate font-semibold text-ink">{phase.name}</span>
          {total > 0 && (
            <span className="shrink-0 text-xs text-muted">
              {done}/{total}
            </span>
          )}
          <span
            className={`ml-auto text-faint transition-transform ${open ? "" : "-rotate-90"}`}
          >
            <Icon name="down" size={16} />
          </span>
        </button>
        <PhaseStatusSelect
          projectId={projectId}
          phaseId={phase.id}
          status={phase.status}
        />
      </div>

      {open && (
        <div className="space-y-1.5 border-t border-border p-3">
          {tasks.map((t) => (
            <TaskItem key={t.id} projectId={projectId} task={t} />
          ))}
          <AddTaskForm projectId={projectId} phaseId={phase.id} />
        </div>
      )}
    </div>
  );
}
