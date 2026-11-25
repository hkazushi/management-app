import { NextResponse, type NextRequest } from "next/server";
import { todayJST } from "@/lib/format";
import { getMembers } from "@/lib/members";
import { buildMorning, fetchWeather } from "@/lib/morning";
import { pushReady, sendPush, type PushSub } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// 毎朝 Vercel の定期実行（vercel.json）から呼ばれ、通知を許可した端末すべてに「今日のまとめ」を送る。
// ログインの外にあるので、合言葉（CRON_SECRET）が合わなければ何もしない。
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushReady()) return NextResponse.json({ error: "通知の鍵が設定されていません" }, { status: 500 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("push_subscriptions").select("user_id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const subs = (data as unknown as (PushSub & { user_id: string })[] | null) ?? [];
  if (subs.length === 0) return NextResponse.json({ sent: 0 });

  const today = todayJST();
  const [weather, members] = await Promise.all([fetchWeather(), getMembers(supabase)]);

  // 中身は人ごとに1回だけ作り、その人の端末すべてに送る
  const users = [...new Set(subs.map((s) => s.user_id))];
  let sent = 0;
  const gone: string[] = [];
  for (const userId of users) {
    const msg = await buildMorning(supabase, userId, today, weather, members);
    for (const sub of subs.filter((s) => s.user_id === userId)) {
      const r = await sendPush(sub, msg);
      if (r === "ok") sent += 1;
      if (r === "gone") gone.push(sub.endpoint);
    }
  }
  if (gone.length > 0) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
  return NextResponse.json({ sent, removed: gone.length });
}
