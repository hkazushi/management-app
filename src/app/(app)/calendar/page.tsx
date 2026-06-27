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

// JST 基準で YYYY-MM-DD を整形
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d);

function parseYM(sp: { y?: string; m?: string }): { year: number; month: number } {
  const today = new Date(fmtDate(new Date()));
  const year = Number(sp.y) || today.getFullYear();
  const month = Number(sp.m) || today.getMonth() + 1; // 1-12
  return { year, month };
}

function ymHref(y: number, m: number): string {
  return `/calendar?y=${y}&m=${m}`;
}

// 月のセル群（前後の月でグリッドを埋める）を生成
function buildGrid(year: number, month: number) {
  // 月初の曜日（0=日）。日本では月曜始まりにする
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

  const supabase = await createClient();
  const [tRes, pRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,status,priority,due_date,project_id")
      .not("due_date", "is", null),
    supabase.from("projects").select("id,name"),
  ]);
  const tasks = (tRes.data as TaskRow[] | null) ?? [];
  const projects = (pRes.data as ProjRow[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  // 日付→タスク配列
  const byDate = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    if (!byDate.has(t.due_date)) byDate.set(t.due_date, []);
    byDate.get(t.due_date)!.push(t);
  }
  for (const [, arr] of byDate) {
    arr.sort((a, b) => {
      // 未完了優先 → 高優先度 → タイトル
      const ad = a.status === "done" ? 1 : 0;
      const bd = b.status === "done" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      const rank: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };
      if (a.priority !== b.priority) return rank[a.priority] - rank[b.priority];
      return a.title.localeCompare(b.title, "ja");
    });
  }

  const cells = buildGrid(year, month);
  const todayIso = fmtDate(new Date());

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const monthOpen = tasks.filter(
    (t) =>
      t.due_date &&
      t.due_date.startsWith(
        `${year}-${String(month).padStart(2, "0")}`,
      ) &&
      t.status !== "done",
  ).length;
  const monthOverdue = tasks.filter(
    (t) => t.due_date && t.due_date < todayIso && t.status !== "done",
  ).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">カレンダー</h1>
        <Link href={ymHref(new Date().getFullYear(), new Date().getMonth() + 1)}
          className="btn-ghost text-xs">
          今日
        </Link>
      </div>

      <div className="card flex items-center justify-between gap-2 p-3">
        <Link href={ymHref(prev.y, prev.m)} className="btn-icon" aria-label="前の月">
          <Icon name="back" size={16} />
        </Link>
        <div className="text-center">
          <p className="text-lg font-bold text-ink">
            {year}年 {month}月
          </p>
          <p className="text-[11px] text-muted">
            未完了 {monthOpen} 件 / 期限超過 {monthOverdue} 件
          </p>
        </div>
        <Link href={ymHref(next.y, next.m)} className="btn-icon" aria-label="次の月">
          <Icon name="back" size={16} className="rotate-180" />
        </Link>
      </div>

      {/* 曜日ヘッダー（月始まり） */}
      <div className="grid grid-cols-7 gap-1 px-0.5 text-center text-[11px] font-semibold text-faint">
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

      {/* 月グリッド */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const list = byDate.get(cell.iso) ?? [];
          const isToday = cell.iso === todayIso;
          const dow = cell.date.getDay(); // 0=日, 6=土
          return (
            <div
              key={cell.iso}
              className={`min-h-[78px] rounded-lg border p-1 text-left transition ${
                cell.inMonth
                  ? "border-border bg-surface"
                  : "border-transparent bg-transparent opacity-50"
              } ${isToday ? "ring-2 ring-primary/60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
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
                {list.length > 0 && (
                  <span className="text-[10px] tabular-nums text-faint">
                    {list.length}
                  </span>
                )}
              </div>
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 2).map((t) => {
                  const done = t.status === "done";
                  const overdue =
                    !done && t.due_date && t.due_date < todayIso;
                  return (
                    <Link
                      key={t.id}
                      href={`/projects/${t.project_id}`}
                      className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px] leading-tight ${
                        overdue
                          ? "bg-danger/10 text-danger"
                          : done
                            ? "bg-black/[0.04] text-faint line-through"
                            : "bg-black/[0.04] text-ink hover:bg-primary/10"
                      }`}
                      title={`${pName.get(t.project_id) ?? ""}: ${t.title}（${PRIORITY_META[t.priority].label}）`}
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`}
                      />
                      <span className="truncate">{t.title}</span>
                    </Link>
                  );
                })}
                {list.length > 2 && (
                  <p className="px-1 text-[10px] text-muted">
                    +{list.length - 2}
                  </p>
                )}
              </div>
            </div>
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
        <span className="ml-2 text-faint">タップで案件に移動</span>
      </div>
    </section>
  );
}
