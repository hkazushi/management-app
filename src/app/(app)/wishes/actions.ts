"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 「https://」を省いて貼られても開けるようにする。http(s) 以外は保存しない
function cleanUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function fields(formData: FormData) {
  const price = String(formData.get("price") ?? "").replace(/[^\d]/g, "");
  return {
    title: String(formData.get("title") ?? "").trim(),
    url: cleanUrl(String(formData.get("url") ?? "")),
    price: price ? Number(price) : null,
    memo: String(formData.get("memo") ?? "").trim() || null,
    member_id: String(formData.get("member_id") ?? "") || null,
  };
}

export async function addWish(formData: FormData) {
  const row = fields(formData);
  if (!row.title) return;
  const supabase = await createClient();
  await supabase.from("wishes").insert(row);
  revalidatePath("/", "layout");
}

export async function updateWish(id: string, formData: FormData) {
  const row = fields(formData);
  if (!row.title) return;
  const supabase = await createClient();
  await supabase.from("wishes").update(row).eq("id", id);
  revalidatePath("/", "layout");
}

export async function toggleWish(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase.from("wishes").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteWish(id: string) {
  const supabase = await createClient();
  await supabase.from("wishes").delete().eq("id", id);
  revalidatePath("/", "layout");
}
