import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { PRIORITY_META } from "@/lib/constants";
import type { TaskPriority, TaskStatus } from "@/types/database";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
};
type ProjRow = { id: string; name: string };
type NoteRow = { id: string; date: string; body: string };

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d);

function parseYM(sp: { y?: string; m?: string }): { year: number; month: number } {
  const today = new Date(fmtDate(new Date()));
  const year = Number(sp.y) || today.getFullYear();
  const month = Number(sp.m) || today.getMonth() + 1; // 1-12
  return { year, month };
}
const ymHref = (y: number, m: number) => `/calendar?y=${y}&m=${m}`;

function buildGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const firstDow = (first.getDay() + 6) % 7; // 月=0..日=6
  const start = new Date(first);
  start.setDate(1 - firstDow);
  const cells: { date: Date; inMonth: boolean; iso: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month - 1,
      iso: fmtDate(d),
    });
  }
  return cells;
}

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: "bg-danger",
  mid: "bg-warning",
  low: "bg-muted/50",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const sp = await searchParams;
  const { year, month } = parseYM(sp);

  // 月の前後を少しはみ出した範囲のメモ・タスクを取得
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const nextStart = `${next.y}-${String(next.m).padStart(2, "0")}-01`;

  const supabase = await createClient();
  const [tRes, pRes, nRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,project_id")
      .not("due_date", "is", null),
    supabase.from("projects").select("id,name"),
    supabase
      .from("calendar_notes")
      .select("id,date,body")
      .gte("date", monthStart)
      .lt("date", nextStart),
  ]);
  const tasks = (tRes.data as TaskRow[] | null) ?? [];
  const projects = (pRes.data as ProjRow[] | null) ?? [];
  const notes = (nRes.data as NoteRow[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  const tByDate = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    if (!tByDate.has(t.due_date)) tByDate.set(t.due_date, []);
    tByDate.get(t.due_date)!.push(t);
  }
  for (const [, arr] of tByDate) {
    arr.sort((a, b) => {
      const ad = a.status === "done" ? 1 : 0;
      const bd = b.status === "done" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const rank: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };
      if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
      return a.title.localeCompare(b.title, "ja");
    });
  }

  const nByDate = new Map<string, NoteRow[]>();
  for (const n of notes) {
    if (!nByDate.has(n.date)) nByDate.set(n.date, []);
    nByDate.get(n.date)!.push(n);
  }

  const cells = buildGrid(year, month);
  const todayIso = fmtDate(new Date());

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };

  const monthOpen = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date.startsWith(`${year}-${String(month).padStart(2, "0")}`) &&
      t.status !== "done",
  ).length;
  const monthOverdue = tasks.filter(
    (t) => t.due_date && t.due_date < todayIso && t.status !== "done",
  ).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">カレンダー</h1>
        <Link
          href={ymHref(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
          )}
          className="btn-ghost text-xs"
        >
          今日
        </Link>
      </div>

      <div className="card flex items-center justify-between gap-2 p-3">
        <Link href={ymHref(prev.y, prev.m)} className="btn-ghost" aria-label="前の月">
          <Icon name="back" size={16} />
        </Link>
        <div className="text-center">
          <p className="text-xl font-bold text-ink">
            {year}年 {month}月
          </p>
          <p className="text-[11px] text-muted">
            未完了 {monthOpen} 件 / 期限超過 {monthOverdue} 件
          </p>
        </div>
        <Link href={ymHref(next.y, next.m)} className="btn-ghost" aria-label="次の月">
          <Icon name="back" size={16} className="rotate-180" />
        </Link>
      </div>

      {/* 曜日ヘッダー（月始まり） */}
      <div className="grid grid-cols-7 gap-1.5 px-0.5 text-center text-xs font-semibold text-faint">
        {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => (
          <div
            key={w}
            className={
              i === 5 ? "text-accent" : i === 6 ? "text-danger" : undefined
            }
          >
            {w}
          </div>
        ))}
      </div>

      {/* 月グリッド（大きめ・タップで日詳細へ） */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell) => {
          const list = tByDate.get(cell.iso) ?? [];
          const notesHere = nByDate.get(cell.iso) ?? [];
          const isToday = cell.iso === todayIso;
          const dow = cell.date.getDay();
          return (
            <Link
              key={cell.iso}
              href={`/calendar/${cell.iso}`}
              className={`block min-h-[110px] rounded-lg border p-1.5 text-left transition sm:min-h-[124px] ${
                cell.inMonth
                  ? "border-border bg-surface hover:border-primary/30 hover:bg-primary/5"
                  : "border-transparent bg-transparent opacity-45"
              } ${isToday ? "ring-2 ring-primary/60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    isToday
                      ? "text-primary"
                      : dow === 0
                        ? "text-danger"
                        : dow === 6
                          ? "text-accent"
                          : "text-ink"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                <div className="flex items-center gap-1 text-[10px]">
                  {notesHere.length > 0 && (
                    <span className="rounded bg-warning/15 px-1 text-warning">
                      📝{notesHere.length}
                    </span>
                  )}
                  {list.length > 0 && (
                    <span className="tabular-nums text-faint">
                      {list.length}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-1 space-y-0.5">
                {list.slice(0, 3).map((t) => {
                  const done = t.status === "done";
                  const overdue =
                    !done && t.due_date && t.due_date < todayIso;
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px] leading-tight ${
                        overdue
                          ? "bg-danger/10 text-danger"
                          : done
                            ? "bg-black/[0.04] text-faint line-through"
                            : "bg-black/[0.05] text-ink"
                      }`}
                      title={`${pName.get(t.project_id) ?? ""}: ${t.title}（${PRIORITY_META[t.priority].label}）`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                      />
                      <span className="truncate">{t.title}</span>
                    </div>
                  );
                })}
                {list.length > 3 && (
                  <p className="px-1 text-[10px] text-muted">
                    +{list.length - 3}
                  </p>
                )}
                {notesHere[0] && (
                  <p className="truncate rounded bg-warning/10 px-1 py-0.5 text-[11px] italic text-warning">
                    📝 {notesHere[0].body}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-danger" />
          優先度 高
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warning" />中
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted/50" />低
        </span>
        <span className="ml-2 text-faint">日付タップで詳細・メモ追加</span>
      </div>
    </section>
  );
}
