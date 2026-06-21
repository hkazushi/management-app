"use client";

import { useFormStatus } from "react-dom";
import { PROJECT_STATUS_OPTIONS, PROJECT_STATUS_META } from "@/lib/constants";
import type { ProjectStatus } from "@/types/database";

type Cat = { id: string; name: string; color: string };

type Defaults = {
  name?: string;
  client?: string | null;
  category_id?: string | null;
  status?: ProjectStatus;
  due_date?: string | null;
  note?: string | null;
};

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? "保存中…" : label}
    </button>
  );
}

export function ProjectForm({
  action,
  categories,
  defaultValues,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Cat[];
  defaultValues?: Defaults;
  submitLabel: string;
}) {
  const d = defaultValues ?? {};

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-muted">案件名 *</label>
        <input
          name="name"
          required
          defaultValue={d.name ?? ""}
          className={inputCls}
          placeholder="例: ○○商店 LP制作"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-muted">クライアント</label>
        <input
          name="client"
          defaultValue={d.client ?? ""}
          className={inputCls}
          placeholder="例: 株式会社○○"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-muted">カテゴリ</label>
          <select
            name="category_id"
            defaultValue={d.category_id ?? ""}
            className={inputCls}
          >
            <option value="">（なし）</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-muted">ステータス</label>
          <select
            name="status"
            defaultValue={d.status ?? "active"}
            className={inputCls}
          >
            {PROJECT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-muted">期限</label>
        <input
          name="due_date"
          type="date"
          defaultValue={d.due_date ?? ""}
          className={inputCls}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-muted">メモ</label>
        <textarea
          name="note"
          rows={4}
          defaultValue={d.note ?? ""}
          className={inputCls}
          placeholder="案件の概要・補足など"
        />
      </div>

      <SubmitButton label={submitLabel} />
    </form>
  );
}
