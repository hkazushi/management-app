"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

// 画面で打たれた PIN をサーバー側で検証し、一致したアカウントで自動サインインする。
// 複数アカウント対応（PIN ごとに別の Supabase アカウント＝別ワークスペース／RLSで分離）。
// PIN もアカウント情報もクライアント JS には一切露出しない。
type Account = { pin?: string; email?: string; password?: string };

function accounts(): Required<Account>[] {
  return [
    {
      pin: process.env.APP_PIN,
      email: process.env.APP_AUTH_EMAIL,
      password: process.env.APP_AUTH_PASSWORD,
    },
    {
      pin: process.env.APP_PIN_2,
      email: process.env.APP_AUTH_EMAIL_2,
      password: process.env.APP_AUTH_PASSWORD_2,
    },
  ].filter(
    (a): a is Required<Account> => !!(a.pin && a.email && a.password),
  );
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");
  const match = accounts().find((a) => a.pin === pin);
  if (!match) {
    return { error: "パスワードが違います" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: match.email,
    password: match.password,
  });

  if (error) {
    return { error: "サインインに失敗しました: " + error.message };
  }

  redirect("/");
}
