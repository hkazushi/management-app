import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayJST } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ActionRow } from "@/components/ActionRow";
import { MeetingCard, MEETING_LIST_COLUMNS, type MeetingListItem } from "@/components/MeetingCard";
import { WorkLogCard, WORK_LOG_COLUMNS, type WorkLogRow } from "@/components/WorkLogCard";
import type { ActionItem } from "@/types/database";

// ホーム：録音の入口と、いま抱えている宿題、最近の議事録、Claude Code の作業ログ
export default async function HomePage() {
  const supabase = await createClient();
  const today = todayJST();

  const [aRes, mRes, pRes, wRes] = await Promise.all([
    supabase
      .from("action_items")
      .select("id,meeting_id,project_id,owner,content,due_date,done")
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(50),
    supabase
      .from("meetings")
      .select(MEETING_LIST_COLUMNS)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase.from("projects").select("id,name"),
    supabase
      .from("activity_log")
      .select(WORK_LOG_COLUMNS)
      .eq("action", "session")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const actions = (aRes.data as unknown as ActionItem[] | null) ?? [];
  const meetings = (mRes.data as unknown as MeetingListItem[] | null) ?? [];
  const workLogs = (wRes.data as unknown as WorkLogRow[] | null) ?? [];
  const pName = new Map(
    ((pRes.data as unknown as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]),
  );
  const mine = actions.filter((a) => a.owner === "自分");
  const others = actions.filter((a) => a.owner !== "自分");

  return (
    <section className="space-y-6">
      {(aRes.error || mRes.error) && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          データベースの準備が終わっていません。Supabase の SQL Editor で
          supabase/migrations/0006_meetings.sql を実行してください。
        </p>
      )}

      <Link
        href="/record"
        className="flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-7 text-xl font-bold text-white shadow-glow transition hover:bg-primary-deep active:scale-[0.99]"
      >
        <Icon name="mic" size={26} />
        打ち合わせを録音する
      </Link>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">自分の宿題（{mine.length}）</h2>
          <Link href="/actions" className="text-xs text-muted hover:text-ink">
            すべて見る →
          </Link>
        </div>
        {mine.length === 0 ? (
          <p className="card p-4 text-sm text-muted">未完了の宿題はありません。</p>
        ) : (
          <div className="space-y-1.5">
            {mine.slice(0, 6).map((a) => (
              <ActionRow
                key={a.id}
                item={a}
                today={today}
                context={a.project_id ? pName.get(a.project_id) : undefined}
                meetingHref={a.meeting_id ? `/meetings/${a.meeting_id}` : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {others.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-ink">相手の対応待ち（{others.length}）</h2>
          <div className="space-y-1.5">
            {others.slice(0, 4).map((a) => (
              <ActionRow
                key={a.id}
                item={a}
                today={today}
                context={a.project_id ? pName.get(a.project_id) : undefined}
                meetingHref={a.meeting_id ? `/meetings/${a.meeting_id}` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">最近の議事録</h2>
          <Link href="/meetings" className="text-xs text-muted hover:text-ink">
            すべて見る →
          </Link>
        </div>
        {meetings.length === 0 ? (
          <p className="card p-4 text-sm text-muted">
            まだ議事録がありません。上のボタンから録音を始めてください。
          </p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                projectName={m.project_id ? pName.get(m.project_id) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {workLogs.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-ink">最近の作業（Claude Code）</h2>
          <div className="space-y-2">
            {workLogs.map((w) => (
              <WorkLogCard
                key={w.id}
                log={w}
                projectName={w.project_id ? pName.get(w.project_id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
