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
      className="rounded-lg bg-primary/90 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
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
        className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-ink outline-none focus:border-primary"
      />
      <select
        name="priority"
        defaultValue="mid"
        className="rounded-lg border border-border bg-bg px-1.5 py-1.5 text-xs text-ink"
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
