"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createTaskGlobal } from "@/app/(app)/projects/[id]/actions";
import { PRIORITY_META, PRIORITY_OPTIONS } from "@/lib/constants";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary shrink-0 px-4 py-2 text-sm"
    >
      追加
    </button>
  );
}

export function NewTaskForm({
  projects,
}: {
  projects: { id: string; name: string }[];
}) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createTaskGlobal(fd);
        ref.current?.reset();
      }}
      className="card space-y-2 p-3"
    >
      <div className="flex gap-2">
        <select
          name="project_id"
          required
          defaultValue=""
          className="shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-sm text-ink outline-none focus:border-primary"
          aria-label="案件"
        >
          <option value="" disabled>
            案件を選択
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          name="title"
          required
          placeholder="＋ タスク内容（必須）"
          className="input flex-1"
        />
      </div>
      <div className="flex gap-2">
        <input
          name="due_date"
          type="date"
          className="input flex-1"
          aria-label="期限"
        />
        <select
          name="priority"
          defaultValue="mid"
          className="shrink-0 rounded-lg border border-border bg-surface px-2 py-2 text-xs text-ink outline-none focus:border-primary"
          aria-label="優先度"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              優先度: {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
        <SubmitBtn />
      </div>
    </form>
  );
}
