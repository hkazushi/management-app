import type { SupabaseClient } from "@supabase/supabase-js";
import { dueDate, fmtDay, fmtTime, yen } from "@/lib/format";
import { whoOf } from "@/lib/members";
import type { PushMessage } from "@/lib/push";
import type { EventRow, ExternalEvent, FixedCost, FixedPayment, Member, OneOff } from "@/types/database";

// 毎朝の通知の中身：今日の天気と気温、今日の予定、今日が期限の支払い。

// 天気は東京（都心）。Open-Meteo（無料・登録不要）
const PLACE = { name: "東京", lat: 35.6812, lon: 139.7671 };

export type Weather = { label: string; max: number; min: number; rain: number | null };

// WMO の天気コードを日本語にする
function weatherLabel(code: number): string {
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "晴れ時々くもり";
  if (code === 3) return "くもり";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 57) return "霧雨";
  if (code >= 61 && code <= 67) return code >= 65 ? "強い雨" : "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code === 85 || code === 86) return "にわか雪";
  if (code >= 95) return "雷雨";
  return "—";
}

// 取れなければ null（天気なしで通知する）
export async function fetchWeather(): Promise<Weather | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${PLACE.lat}&longitude=${PLACE.lon}` +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo&forecast_days=1";
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return null;
    const d = ((await res.json()) as { daily?: Record<string, (number | null)[]> }).daily;
    const code = d?.weather_code?.[0];
    const max = d?.temperature_2m_max?.[0];
    const min = d?.temperature_2m_min?.[0];
    if (code == null || max == null || min == null) return null;
    return { label: weatherLabel(code), max: Math.round(max), min: Math.round(min), rain: d?.precipitation_probability_max?.[0] ?? null };
  } catch {
    return null;
  }
}

// その人あての通知を組み立てる。
// supabase はサービスキーのこともあるので、お金と TimeTree の予定は必ず userId で絞る（相手のお金を混ぜない）。
export async function buildMorning(
  supabase: SupabaseClient,
  userId: string,
  today: string,
  weather: Weather | null,
  members: Member[],
): Promise<PushMessage> {
  const month = today.slice(0, 7);
  const [eRes, xRes, cRes, pRes, oRes] = await Promise.all([
    supabase.from("events").select("id,date,title,start_time,end_time,member_id,color,memo,batch_id").eq("date", today),
    supabase.from("external_events").select("*").eq("date", today).or(`user_id.eq.${userId},shared.eq.true`),
    supabase.from("fixed_costs").select("id,name,amount,due_day,memo,active").eq("user_id", userId).eq("active", true),
    supabase.from("fixed_payments").select("id,fixed_cost_id,month,amount,paid_at").eq("user_id", userId).eq("month", month),
    supabase.from("one_offs").select("id,kind,name,amount,date,paid_at,memo").eq("user_id", userId).eq("kind", "expense").eq("date", today).is("paid_at", null),
  ]);

  type Line = { time: string | null; text: string };
  const lines: Line[] = [];
  for (const e of (eRes.data as unknown as EventRow[] | null) ?? []) {
    const who = e.member_id ? `（${whoOf(members, e.member_id).name}）` : "";
    lines.push({ time: e.start_time, text: `${e.start_time ? `${fmtTime(e.start_time)} ` : ""}${e.title}${who}` });
  }
  for (const x of (xRes.data as unknown as ExternalEvent[] | null) ?? []) {
    if (x.delete_requested_at) continue;
    const who = x.author_name ? `（${x.author_name}）` : "";
    lines.push({ time: x.start_time, text: `${x.start_time ? `${fmtTime(x.start_time)} ` : ""}${x.title}${who}` });
  }
  // 時間のあるものを早い順に、終日のものは先頭に
  lines.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));

  const paid = new Set(((pRes.data as unknown as FixedPayment[] | null) ?? []).map((p) => p.fixed_cost_id));
  const pays: string[] = [];
  for (const c of (cRes.data as unknown as FixedCost[] | null) ?? []) {
    if (dueDate(month, c.due_day) === today && !paid.has(c.id)) pays.push(`${c.name} ${yen(c.amount)}`);
  }
  for (const o of (oRes.data as unknown as OneOff[] | null) ?? []) pays.push(`${o.name} ${yen(o.amount)}`);

  const title = weather
    ? `${fmtDay(today)} ${PLACE.name} ${weather.label} ${weather.max}°/${weather.min}°`
    : `${fmtDay(today)} の予定`;
  const body = [
    weather?.rain != null ? `降水確率 ${weather.rain}%` : null,
    lines.length > 0 ? `予定：${lines.map((l) => l.text).join("、")}` : "予定：なし",
    pays.length > 0 ? `今日が支払い日：${pays.join("、")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { title, body, url: "/", tag: `morning-${today}` };
}
