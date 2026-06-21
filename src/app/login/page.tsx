"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Icon } from "@/components/Icon";

const initialState: LoginState = { error: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-glow">
            <Icon name="flag" size={26} filled />
          </span>
          <h1 className="text-xl font-bold text-ink">案件・タスク管理</h1>
          <p className="mt-1 text-sm text-muted">
            散らばった案件を1箇所に。
          </p>
        </div>

        <form action={formAction} className="card p-6">
          <label htmlFor="pin" className="text-sm font-medium text-muted">
            パスワード
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="input mt-2 text-center text-lg tracking-[0.4em]"
            placeholder="••••"
          />

          {state.error && (
            <p className="mt-3 text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-primary mt-5 w-full"
          >
            {pending ? "確認中…" : "ロックを解除"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-faint">自分専用アプリ</p>
      </div>
    </main>
  );
}
