"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string };

// 画面で打たれた PIN(0408) をサーバー側で検証し、一致したら
// 環境変数に隠した本物の Supabase アカウントで自動サインインする。
// PIN もアカウント情報もクライアント JS には一切露出しない。
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const pin = String(formData.get("pin") ?? "");

  if (!process.env.APP_PIN || pin !== process.env.APP_PIN) {
    return { error: "パスワードが違います" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.APP_AUTH_EMAIL ?? "",
    password: process.env.APP_AUTH_PASSWORD ?? "",
  });

  if (error) {
    return {
      error:
        "サインインに失敗しました（Supabase 側のユーザー未作成 / 未確認かもしれません）: " +
        error.message,
    };
  }

  redirect("/");
}
