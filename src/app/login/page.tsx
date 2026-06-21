"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = { error: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            案件・タスク管理
          </p>
          <h1 className="mt-1 text-2xl font-bold text-ink">ロックを解除</h1>
        </div>

        <form
          action={formAction}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <label htmlFor="pin" className="block text-sm font-medium text-muted">
            パスワード
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="mt-2 w-full rounded-xl border border-border bg-bg px-4 py-3 text-lg tracking-widest text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="••••"
          />

          {state.error && (
            <p className="mt-3 text-sm text-danger">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-xl bg-primary px-4 py-3 font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {pending ? "確認中…" : "入る"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted">
          このアプリは自分専用です
        </p>
      </div>
    </main>
  );
}
