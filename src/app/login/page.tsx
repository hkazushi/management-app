"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Icon } from "@/components/Icon";
import { Manul } from "@/components/Manul";
import { Meerkat } from "@/components/Meerkat";

const initialState: LoginState = { error: "" };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-end justify-center gap-1 drop-shadow-[0_14px_14px_rgb(40_32_16/0.18)]">
            <Manul className="h-[104px] w-auto" />
            <Meerkat className="h-40 w-auto" />
          </div>
          <p className="mt-3 font-display text-[11px] font-bold uppercase tracking-[0.36em] text-sun">Futari Techo</p>
          <h1 className="display mt-1 text-[34px] leading-tight text-ink">ふたり手帖</h1>
          <div className="rule mt-3 w-40" />
          <p className="mt-3 text-sm text-muted">予定・欲しいもの・お金を、ふたりで。</p>
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
