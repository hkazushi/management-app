"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isColor } from "@/lib/colors";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const time = (v: FormDataEntryValue | null) => {
  const s = text(v);
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null;
};

// 自分の名前と色を変える（相手の分は変えられない。DB 側でも止めている）
export async function updateMe(formData: FormData) {
  const name = text(formData.get("name")).slice(0, 12);
  const color = text(formData.get("color"));
  if (!name) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("members")
    .update({ name, ...(isColor(color) ? { color } : {}) })
    .eq("user_id", user.id);
  revalidatePath("/", "layout");
}

function presetFields(formData: FormData) {
  const color = text(formData.get("color"));
  return {
    title: text(formData.get("title")),
    start_time: time(formData.get("start_time")),
    end_time: time(formData.get("end_time")),
    member_id: text(formData.get("member_id")) || null,
    color: isColor(color) ? color : null,
  };
}

export async function addPreset(formData: FormData) {
  const row = presetFields(formData);
  if (!row.title) return;
  const supabase = await createClient();
  await supabase.from("event_presets").insert({ ...row, sort: Math.floor(Date.now() / 1000) });
  revalidatePath("/", "layout");
}

export async function deletePreset(id: string) {
  const supabase = await createClient();
  await supabase.from("event_presets").delete().eq("id", id);
  revalidatePath("/", "layout");
}
