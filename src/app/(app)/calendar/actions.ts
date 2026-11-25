"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isColor } from "@/lib/colors";
import { isDate } from "@/lib/format";

export type EventInput = {
  title: string;
  start_time: string; // "HH:MM" か空
  end_time: string;
  member_id: string; // 空は「2人」
  color: string;
  memo: string;
};

const time = (s: string) => (/^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : null);

// 選んだ日すべてに同じ予定を入れる。2日以上なら batch_id でひとまとめにする
export async function addEvents(dates: string[], input: EventInput): Promise<{ error?: string }> {
  const title = input.title.trim();
  const days = [...new Set(dates)].filter(isDate).slice(0, 62);
  if (!title) return { error: "予定の名前を入れてください" };
  if (days.length === 0) return { error: "日付を選んでください" };
  const batch = days.length > 1 ? crypto.randomUUID() : null;
  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(
    days.map((date) => ({
      date,
      title,
      start_time: time(input.start_time),
      end_time: time(input.end_time),
      member_id: input.member_id || null,
      color: isColor(input.color) ? input.color : null,
      memo: input.memo.trim() || null,
      batch_id: batch,
    })),
  );
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

// 1件の予定を直す
export async function updateEvent(id: string, input: EventInput): Promise<{ error?: string }> {
  const title = input.title.trim();
  if (!title) return { error: "予定の名前を入れてください" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({
      title,
      start_time: time(input.start_time),
      end_time: time(input.end_time),
      member_id: input.member_id || null,
      color: isColor(input.color) ? input.color : null,
      memo: input.memo.trim() || null,
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// まとめて入れた予定を、ほかの日の分も含めて全部消す
export async function deleteBatch(batchId: string) {
  const supabase = await createClient();
  await supabase.from("events").delete().eq("batch_id", batchId);
  revalidatePath("/", "layout");
}

// TimeTree から読み取った予定を「消して」と頼む。
// ここでは印を付けるだけで、実際に TimeTree から消すのは Mac の同期スクリプト（最大30分後）。
// 何日かにまたがる予定は、同じ予定の全部の日に印を付ける。
export async function requestExternalDelete(id: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data } = await supabase.from("external_events").select("uid").eq("id", id).maybeSingle();
  const uid = (data as unknown as { uid: string } | null)?.uid;
  if (!uid) return { error: "予定が見つかりません" };
  const { data: updated, error } = await supabase
    .from("external_events")
    .update({ delete_requested_at: new Date().toISOString() })
    .like("uid", `${uid.split(":")[0]}:%`)
    .select("id");
  // 列や権限（0014）がまだ無いと、エラーになるか、1行も変わらない
  if (error || !updated || updated.length === 0) return { error: "まだ消せません（データベースの準備が必要です）" };
  revalidatePath("/", "layout");
  return {};
}
