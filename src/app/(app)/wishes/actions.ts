"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fetchOgImage } from "@/lib/ogimage";

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
  // リンクがあれば、商品の写真を取りに行く（取れなければ写真なし）
  const image_url = row.url ? await fetchOgImage(row.url) : null;
  await supabase.from("wishes").insert({ ...row, image_url });
  revalidatePath("/", "layout");
}

export async function updateWish(id: string, formData: FormData) {
  const row = fields(formData);
  if (!row.title) return;
  const supabase = await createClient();
  // リンクが変わったときだけ、写真を取り直す
  const { data } = await supabase.from("wishes").select("url,image_url").eq("id", id).maybeSingle();
  const before = data as unknown as { url: string | null; image_url: string | null } | null;
  const image_url = !row.url ? null : before?.url === row.url && before.image_url ? before.image_url : await fetchOgImage(row.url);
  await supabase.from("wishes").update({ ...row, image_url }).eq("id", id);
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
