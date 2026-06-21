"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createTask } from "@/app/(app)/projects/[id]/actions";
import { PRIORITY_OPTIONS, PRIORITY_META } from "@/lib/constants";

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-primary-deep disabled:opacity-60"
    >
      追加
    </button>
  );
}

export function AddTaskForm({
  projectId,
  phaseId,
}: {
  projectId: string;
  phaseId: string;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createTask(projectId, phaseId, fd);
        ref.current?.reset();
      }}
      className="flex items-center gap-2"
    >
      <input
        name="title"
        required
        placeholder="＋ タスクを追加"
        className="input flex-1"
      />
      <select
        name="priority"
        defaultValue="mid"
        className="shrink-0 rounded-xl border border-border bg-surface px-2 py-2 text-xs text-ink outline-none focus:border-primary"
        aria-label="優先度"
      >
        {PRIORITY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_META[p].label}
          </option>
        ))}
      </select>
      <AddButton />
    </form>
  );
}
