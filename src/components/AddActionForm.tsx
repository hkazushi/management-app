"use client";

import { useRef } from "react";
import { addAction } from "@/app/(app)/meetings/actions";

// 宿題を手で足すフォーム（AIが拾い漏らしたとき用）
export function AddActionForm({
  meetingId,
  projectId,
}: {
  meetingId: string | null;
  projectId: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await addAction(meetingId, projectId, fd);
        ref.current?.reset();
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input name="content" required placeholder="宿題を追加" className="input min-w-[10rem] flex-1" />
      <input name="owner" placeholder="担当（空欄は自分）" className="input w-36" />
      <input name="due_date" type="date" aria-label="期限" className="input w-40" />
      <button type="submit" className="btn-ghost shrink-0">
        追加
      </button>
    </form>
  );
}
