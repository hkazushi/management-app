import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, todayJST } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ActionRow } from "@/components/ActionRow";
import { MeetingCard, type MeetingListItem } from "@/components/MeetingCard";
import { WorkLogCard, WORK_LOG_COLUMNS, type WorkLogRow } from "@/components/WorkLogCard";
import type { ActionItem, Project } from "@/types/database";

type MeetingWithNotes = MeetingListItem & { decisions: string[]; next_agenda: string[] };

// 案件ページ：次の打ち合わせ前に見る「前回のまとめ」と、これまでの議事録
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayJST();

  const [pRes, mRes, aRes, wRes] = await Promise.all([
    supabase.from("projects").select("id,name,client,status").eq("id", id).maybeSingle(),
    supabase
      .from("meetings")
      .select("id,project_id,title,status,started_at,duration_sec,summary,decisions,next_agenda")
      .eq("project_id", id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("action_items")
      .select("id,meeting_id,project_id,owner,content,due_date,done")
      .eq("project_id", id)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("activity_log")
      .select(WORK_LOG_COLUMNS)
      .eq("project_id", id)
      .eq("action", "session")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const project = pRes.data as unknown as Project | null;
  if (!project) notFound();
  const meetings = (mRes.data as unknown as MeetingWithNotes[] | null) ?? [];
  const actions = (aRes.data as unknown as ActionItem[] | null) ?? [];
  const workLogs = (wRes.data as unknown as WorkLogRow[] | null) ?? [];
  const last = meetings.find((m) => m.status === "done");
  const lastDecisions = last && Array.isArray(last.decisions) ? last.decisions : [];
  const lastAgenda = last && Array.isArray(last.next_agenda) ? last.next_agenda : [];

  return (
    <section className="space-y-5">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="back" size={15} />
        案件一覧へ
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{project.name}</h1>
          {project.client && <p className="mt-0.5 text-sm text-muted">{project.client}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/accounts?project=${id}`} className="btn-ghost">
            <Icon name="lock" size={15} />
            ログパス
          </Link>
          <Link href={`/record?project=${id}`} className="btn-primary">
            <Icon name="mic" size={16} />
            録音
          </Link>
        </div>
      </header>

      {last ? (
        <div className="card space-y-4 p-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">次の打ち合わせ前に</h2>
            <p className="text-xs text-muted">
              前回: {last.title}（{fmtDateTime(last.started_at)}）
            </p>
          </div>
          {lastAgenda.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold text-muted">今回確認すること</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
                {lastAgenda.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {lastDecisions.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold text-muted">前回決まったこと</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
                {lastDecisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
          {lastAgenda.length === 0 && lastDecisions.length === 0 && last.summary && (
            <p className="text-sm leading-relaxed text-ink">{last.summary}</p>
          )}
        </div>
      ) : (
        <p className="card p-4 text-sm text-muted">
          この案件の議事録はまだありません。「録音」から始めると、ここに前回のまとめが出ます。
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">未完了の宿題（{actions.length}）</h2>
        {actions.length === 0 ? (
          <p className="card p-4 text-sm text-muted">未完了の宿題はありません。</p>
        ) : (
          <div className="space-y-1.5">
            {actions.map((a) => (
              <ActionRow
                key={a.id}
                item={a}
                today={today}
                meetingHref={a.meeting_id ? `/meetings/${a.meeting_id}` : undefined}
                context={a.meeting_id ? "議事録を見る" : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">議事録（{meetings.length}）</h2>
        <div className="space-y-2">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      </div>

      {workLogs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-ink">Claude Code の作業ログ</h2>
          <div className="space-y-2">
            {workLogs.map((w) => (
              <WorkLogCard key={w.id} log={w} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
