"use client";

import { useRef, useTransition } from "react";

// サーバー処理を呼ぶフォーム。送信が終わったら入力を空に戻し、処理中はボタンを押せなくする。
export function ActionForm({
  action,
  children,
  className,
  keep = false,
  confirmText,
}: {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  keep?: boolean; // true なら送信後も入力を残す（編集フォーム用）
  confirmText?: string; // 入れると、送信前に確認を出す
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await action(fd);
          if (!keep) ref.current?.reset();
        });
      }}
    >
      <fieldset disabled={pending} className={`contents ${pending ? "opacity-60" : ""}`}>
        {children}
      </fieldset>
    </form>
  );
}
