import { createClient } from "@supabase/supabase-js";
import { toICal, type FeedEvent } from "@/lib/ical";

// このアプリの予定を iCal 形式で返す。iPhone のカレンダーなどが定期的に読みに来る。
// ログインは無く、URL に入っている合言葉（token）が合っていれば、共有の予定だけを返す（お金は返さない）。
// DB 側の関数 calendar_feed が token を確かめる。合っていなければ空のカレンダーになる。
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{64}$/.test(token)) return new Response("Not found", { status: 404 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.rpc("calendar_feed", { feed_token: token });
  if (error) return new Response("Calendar is not available", { status: 503 });

  return new Response(toICal((data as unknown as FeedEvent[] | null) ?? [], "ふたり手帖"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="futari-techo.ics"',
      "Cache-Control": "no-store",
    },
  });
}
