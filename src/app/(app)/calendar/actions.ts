"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 日付ごとのメモを追加
export async function addCalendarNote(date: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body || !date) return;
  const supabase = await createClient();
  await supabase.from("calendar_notes").insert({ date, body });
  revalidatePath("/calendar");
  revalidatePath(`/calendar/${date}`);
}

// メモを編集
export async function updateCalendarNote(id: string, formData: FormData) {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const supabase = await createClient();
  await supabase
    .from("calendar_notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/calendar");
}

// メモを削除
export async function deleteCalendarNote(id: string) {
  const supabase = await createClient();
  await supabase.from("calendar_notes").delete().eq("id", id);
  revalidatePath("/calendar");
}
