import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { NoteList } from "@/components/NoteList";
import { PRIORITY_META } from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/types/database";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string;
};
type ProjRow = { id: string; name: string };
type Note = { id: string; body: string; updated_at: string | null };

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const WDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default async function CalendarDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isYmd(date)) notFound();

  const supabase = await createClient();
  const [tRes, pRes, nRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,project_id")
      .eq("due_date", date)
      .order("status"),
    supabase.from("projects").select("id,name"),
    supabase
      .from("calendar_notes")
      .select("id,body,updated_at")
      .eq("date", date)
      .order("created_at", { ascending: false }),
  ]);
  const tasks = (tRes.data as TaskRow[] | null) ?? [];
  const projects = (pRes.data as ProjRow[] | null) ?? [];
  const notes = (nRes.data as Note[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  const d = new Date(date + "T00:00:00+09:00");
  const todayIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
  const isToday = date === todayIso;

  const ym = `${d.getFullYear()}-${d.getMonth() + 1}`;
  const back = `/calendar?y=${d.getFullYear()}&m=${d.getMonth() + 1}`;

  return (
    <section className="space-y-5">
      <Link
        href={back}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <Icon name="back" size={15} />
        {ym} カレンダーへ
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.getMonth() + 1}/{d.getDate()}（{WDAYS[d.getDay()]}）
          {isToday && (
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-xs text-primary">
              今日
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-sm text-muted">{date}</p>
      </div>

      {/* 期限がこの日のタスク */}
      <div className="space-y-2">
        <h2 className="section-label">期限のタスク</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted">この日が期限のタスクはありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {tasks.map((t) => {
              const done = t.status === "done";
              return (
                <li key={t.id}>
                  <Link
                    href={`/projects/${t.project_id}`}
                    className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span
                      className={`h-5 w-5 shrink-0 rounded-full border-2 ${
                        done
                          ? "border-success bg-success"
                          : "border-muted/40"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${done ? "text-faint line-through" : "text-ink"}`}
                      >
                        {t.title}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {pName.get(t.project_id) ?? ""}
                      </p>
                    </div>
                    <span
                      className={`chip ${PRIORITY_META[t.priority].badge}`}
                    >
                      {PRIORITY_META[t.priority].label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 日付メモ */}
      <div className="space-y-2">
        <h2 className="section-label">メモ</h2>
        <NoteList date={date} notes={notes} />
      </div>
    </section>
  );
}
