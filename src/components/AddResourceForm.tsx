"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createResource } from "@/app/(app)/projects/[id]/actions";
import { RESOURCE_TYPE_OPTIONS, RESOURCE_TYPE_META } from "@/lib/constants";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      追加
    </button>
  );
}

const inputCls = "input";

export function AddResourceForm({ projectId }: { projectId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-border py-2.5 text-sm font-medium text-muted transition hover:border-primary/40 hover:text-primary"
      >
        ＋ リソースを追加
      </button>
    );
  }

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createResource(projectId, fd);
        ref.current?.reset();
        setOpen(false);
      }}
      className="space-y-2 rounded-xl border border-white/10 bg-white/[0.04] p-3"
    >
      <div className="flex gap-2">
        <select name="type" defaultValue="link" className={inputCls} aria-label="種別">
          {RESOURCE_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {RESOURCE_TYPE_META[t].icon} {RESOURCE_TYPE_META[t].label}
            </option>
          ))}
        </select>
        <input name="label" required placeholder="名称（例: 本番サイト）" className={inputCls} />
      </div>
      <input name="url" placeholder="URL（任意）" className={inputCls} />
      <input
        name="account"
        placeholder="使用アカウント（例: client-xxx@gmail.com）"
        className={inputCls}
      />
      <input
        name="note"
        placeholder="メモ（例: パスワードは1Passwordの『○○』）"
        className={inputCls}
      />
      <p className="text-xs text-warning">
        ※ パスワード本体は保存しません。所在（パスワードマネージャー名など）だけメモしてください。
      </p>
      <div className="flex items-center gap-2">
        <SubmitBtn />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-muted hover:text-ink"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
