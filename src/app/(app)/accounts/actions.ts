"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VaultRow } from "@/lib/vault";

// 金庫を作る（最初の1回だけ）。鍵はブラウザで作り、ここでは保存するだけ。
// マスターパスワード自体はサーバーに送られてこない。
export async function saveVault(row: VaultRow): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("vaults").insert({
    public_key: row.public_key,
    enc_private_key: row.enc_private_key,
    salt: row.salt,
    iv: row.iv,
    iterations: row.iterations,
  });
  if (error) return { error: error.message };
  revalidatePath("/accounts");
  return {};
}

export type NewResource = {
  project_id: string | null;
  label: string;
  url: string;
  account: string;
  note: string;
  secret_enc: string | null; // ブラウザで暗号化済みの文字列
};

export async function addResource(input: NewResource): Promise<{ error?: string }> {
  const label = input.label.trim();
  if (!label) return { error: "名前を入れてください" };
  const supabase = await createClient();
  const { error } = await supabase.from("project_resources").insert({
    project_id: input.project_id || null,
    type: input.secret_enc || input.account.trim() ? "account" : "link",
    label,
    url: input.url.trim() || null,
    account: input.account.trim() || null,
    note: input.note.trim() || null,
    secret_enc: input.secret_enc,
    source: "manual",
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteResource(id: string) {
  const supabase = await createClient();
  await supabase.from("project_resources").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// 自動で拾ったものを「確認済み」にする
export async function confirmResource(id: string) {
  const supabase = await createClient();
  await supabase.from("project_resources").update({ needs_review: false }).eq("id", id);
  revalidatePath("/", "layout");
}
