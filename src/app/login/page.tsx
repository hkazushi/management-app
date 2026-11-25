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
        <div className="mb-7 flex flex-col items-center text-center">
          <span className="mb-4 flex h-20 w-20 -rotate-6 items-center justify-center rounded-3xl border-2 border-ink bg-sun text-ink shadow-hard">
            <span className="display text-4xl leading-none">ふ</span>
          </span>
          <h1 className="display text-3xl text-ink">ふたり手帖</h1>
          <p className="mt-2 text-sm font-bold text-muted">予定・欲しいもの・お金を、ふたりで。</p>
        </div>

        <form action={formAction} className="card p-6">
          <label htmlFor="pin" className="display text-sm text-ink">
            あいことば
          </label>
          <input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            className="input mt-2 text-center !text-xl tracking-[0.4em]"
            placeholder="••••"
          />

          {state.error && <p className="mt-3 text-sm font-bold text-danger">{state.error}</p>}

          <button type="submit" disabled={pending} className="btn-primary mt-5 w-full !py-3 !text-base">
            <Icon name="lock" size={17} />
            {pending ? "確認中…" : "ひらく"}
          </button>
        </form>
      </div>
    </main>
  );
}
