"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isColor } from "@/lib/colors";
import { todayJST } from "@/lib/format";
import { currentUserId, getMembers } from "@/lib/members";
import { buildMorning, fetchWeather } from "@/lib/morning";
import { pushReady, sendPush, type PushSub } from "@/lib/push";

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

// カレンダーを外に出す URL を作る／作り直す（作り直すと、前の URL は使えなくなる）
export async function createFeed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("calendar_feeds").delete().eq("user_id", user.id);
  await supabase.from("calendar_feeds").insert({});
  revalidatePath("/settings");
}

// 外に出すのをやめる（URL が使えなくなる）
export async function deleteFeed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("calendar_feeds").delete().eq("user_id", user.id);
  revalidatePath("/settings");
}

// ---- 毎朝の通知 ----

// この端末を通知の届け先に登録する
export async function savePush(sub: { endpoint: string; p256dh: string; auth: string }): Promise<{ error?: string }> {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.p256dh || !sub.auth) return { error: "この端末では通知を登録できませんでした" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, { onConflict: "endpoint" });
  return error ? { error: "登録できませんでした（データベースの準備が必要です）" } : {};
}

// この端末への通知をやめる
export async function removePush(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

// 今日の内容で、自分の端末に試しに送る（毎朝届くものと同じ中身）
export async function testPush(): Promise<{ error?: string; sent?: number }> {
  if (!pushReady()) return { error: "通知の鍵がサーバーに設定されていません" };
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return { error: "ログインし直してください" };
  const { data } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth");
  const subs = (data as unknown as PushSub[] | null) ?? [];
  if (subs.length === 0) return { error: "通知がオンの端末がありません" };
  const [weather, members] = await Promise.all([fetchWeather(), getMembers(supabase)]);
  const msg = await buildMorning(supabase, userId, todayJST(), weather, members);
  let sent = 0;
  for (const sub of subs) {
    const r = await sendPush(sub, { ...msg, tag: "test" });
    if (r === "ok") sent += 1;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  }
  return sent > 0 ? { sent } : { error: "送れませんでした。いったんオフにして、もう一度オンにしてください" };
}
