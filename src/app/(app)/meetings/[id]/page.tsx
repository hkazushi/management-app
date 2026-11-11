import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, fmtDuration, todayJST } from "@/lib/format";
import { updateMeeting } from "../actions";
import { Icon } from "@/components/Icon";
import { ActionRow } from "@/components/ActionRow";
import { AddActionForm } from "@/components/AddActionForm";
import { CopyButton, DeleteMeetingButton, FinalizeButton } from "@/components/MeetingButtons";
import type { ActionItem, Meeting } from "@/types/database";

export default async function MeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [mRes, aRes, pRes, sRes] = await Promise.all([
    supabase
      .from("meetings")
      .select(
        "id,project_id,title,status,started_at,duration_sec,transcript,summary,decisions,next_agenda,email_draft",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("action_items")
      .select("id,meeting_id,project_id,owner,content,due_date,done")
      .eq("meeting_id", id)
      .order("created_at"),
    supabase.from("projects").select("id,name").order("name"),
    supabase
      .from("meeting_segments")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", id),
  ]);

  const meeting = mRes.data as unknown as Meeting | null;
  if (!meeting) notFound();
  const actions = (aRes.data as unknown as ActionItem[] | null) ?? [];
  const projects = (pRes.data as unknown as { id: string; name: string }[] | null) ?? [];
  const projectName = projects.find((p) => p.id === meeting.project_id)?.name;
  const today = todayJST();
  const done = meeting.status === "done";
  const decisions = Array.isArray(meeting.decisions) ? meeting.decisions : [];
  const nextAgenda = Array.isArray(meeting.next_agenda) ? meeting.next_agenda : [];

  return (
    <section className="space-y-5">
      <Link href="/meetings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <Icon name="back" size={15} />
        議事録一覧へ
      </Link>

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{meeting.title}</h1>
        <p className="mt-1 text-sm text-muted">
          {fmtDateTime(meeting.started_at)}
          {meeting.duration_sec ? `・${fmtDuration(meeting.duration_sec)}` : ""}
          {projectName && meeting.project_id && (
            <>
              ・
              <Link href={`/projects/${meeting.project_id}`} className="text-primary hover:underline">
                {projectName}
              </Link>
            </>
          )}
        </p>
      </header>

      {!done && (
        <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm text-ink">
            この打ち合わせは議事録がまだ作られていません（録音が途中で終わった可能性があります）。
            文字起こしは {sRes.count ?? 0} 分ぶん保存されています。
          </p>
          <FinalizeButton meetingId={id} label="ここまでの内容で議事録を作る" primary />
        </div>
      )}

      {meeting.summary && (
        <div className="card p-4">
          <h2 className="mb-1.5 text-sm font-semibold text-ink">要約</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{meeting.summary}</p>
        </div>
      )}

      {decisions.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-1.5 text-sm font-semibold text-ink">決まったこと</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
            {decisions.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-ink">宿題（{actions.length}）</h2>
        {actions.length > 0 && (
          <div className="space-y-1.5">
            {actions.map((a) => (
              <ActionRow key={a.id} item={a} today={today} />
            ))}
          </div>
        )}
        <AddActionForm meetingId={id} projectId={meeting.project_id} />
      </div>

      {nextAgenda.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-1.5 text-sm font-semibold text-ink">次回確認すること</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink">
            {nextAgenda.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {meeting.email_draft && (
        <div className="card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">相手に送るメールの下書き</h2>
            <CopyButton text={meeting.email_draft} label="コピー" />
          </div>
          <p className="whitespace-pre-wrap rounded-lg bg-bg p-3 text-sm leading-relaxed text-ink">
            {meeting.email_draft}
          </p>
        </div>
      )}

      {meeting.transcript && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">文字起こし全文</summary>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{meeting.transcript}</p>
        </details>
      )}

      <details className="card p-4">
        <summary className="cursor-pointer text-sm font-semibold text-ink">編集・作り直し・削除</summary>
        <div className="mt-4 space-y-4">
          <form action={updateMeeting.bind(null, id)} className="space-y-3">
            <div>
              <label htmlFor="m-title" className="text-sm font-medium text-muted">
                タイトル
              </label>
              <input id="m-title" name="title" defaultValue={meeting.title} className="input mt-1" />
            </div>
            <div>
              <label htmlFor="m-project" className="text-sm font-medium text-muted">
                案件
              </label>
              <select
                id="m-project"
                name="project_id"
                key={meeting.project_id ?? ""}
                defaultValue={meeting.project_id ?? ""}
                className="input mt-1"
              >
                <option value="">案件なし</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-ghost">
              保存
            </button>
          </form>
          <div className="flex flex-wrap items-start gap-2 border-t border-border pt-4">
            {done && (
              <FinalizeButton
                meetingId={id}
                label="議事録を作り直す"
                confirmText="文字起こしから議事録を作り直します。この打ち合わせの宿題も作り直されます（手で直した内容は消えます）。よろしいですか？"
              />
            )}
            <DeleteMeetingButton meetingId={id} />
          </div>
        </div>
      </details>
    </section>
  );
}
