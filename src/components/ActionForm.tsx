"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { cheer as sayCheer } from "@/lib/cheer";

// 送信中は中の入力とボタンを押せなくする
function Body({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className={`contents ${pending ? "opacity-60" : ""}`}>
      {children}
    </fieldset>
  );
}

// サーバー処理を呼ぶフォーム。
// React のフォームアクションとして渡しているので、画面の準備（ハイドレーション）が終わる前に送信されても、
// 入力内容が URL に載る通常の GET 送信にはならない（準備が済んでから処理される）。
export function ActionForm({
  action,
  children,
  className,
  keep = false,
  confirmText,
  cheer,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  keep?: boolean; // true は編集フォーム。送信後、保存した値がそのまま入った状態に戻る
  confirmText?: string; // 入れると、送信前に確認を出す
  cheer?: string; // 入れると、終わったあと2匹がこの一言をしゃべる
}) {
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      className={className}
      data-keep={keep || undefined}
      action={async (fd) => {
        if (confirmText && !window.confirm(confirmText)) return;
        await action(fd);
        if (cheer) sayCheer(cheer);
      }}
    >
      <Body>{children}</Body>
    </form>
  );
}
