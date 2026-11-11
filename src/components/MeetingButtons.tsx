"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteMeeting } from "@/app/(app)/meetings/actions";
import { Icon } from "./Icon";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="btn-ghost"
    >
      <Icon name={copied ? "check" : "copy"} size={15} />
      {copied ? "コピーしました" : label}
    </button>
  );
}

// 議事録を作る／作り直す。録音が途中で切れた打ち合わせの救済にも使う。
export function FinalizeButton({
  meetingId,
  label,
  confirmText,
  primary = false,
}: {
  meetingId: string;
  label: string;
  confirmText?: string;
  primary?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "議事録の作成に失敗しました");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "議事録の作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={run} disabled={busy} className={primary ? "btn-primary" : "btn-ghost"}>
        <Icon name="sparkles" size={15} />
        {busy ? "作成中…（1分ほど）" : label}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}

export function DeleteMeetingButton({ meetingId }: { meetingId: string }) {
  return (
    <form
      action={deleteMeeting.bind(null, meetingId)}
      onSubmit={(e) => {
        if (!confirm("この議事録を削除します。文字起こしと宿題も消えます。よろしいですか？")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-lg px-3 py-2 text-sm font-medium text-danger transition hover:bg-danger/10"
      >
        削除
      </button>
    </form>
  );
}
