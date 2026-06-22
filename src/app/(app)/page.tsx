import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_META } from "@/lib/constants";
import { Icon } from "@/components/Icon";
import type { TaskPriority } from "@/types/database";

type TaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  priority: TaskPriority;
  project_id: string;
};
type ProjRow = { id: string; name: string; status: string; created_at: string };

const STALE_DAYS = 14;

type Tone = "primary" | "danger" | "warning" | "accent";
const toneText: Record<Tone, string> = {
  primary: "text-primary",
  danger: "text-danger",
  warning: "text-warning",
  accent: "text-accent",
};

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: "projects" | "alert" | "today" | "flag";
  tone: Tone;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className={toneText[tone]}>
          <Icon name={icon} size={16} />
        </span>
      </div>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${toneText[tone]}`}>
        {value}
      </p>
    </div>
  );
}

function TaskRowView({
  t,
  projectName,
  tone,
}: {
  t: TaskRow;
  projectName: string;
  tone: "danger" | "warning" | "muted";
}) {
  const toneCls =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : "text-faint";
  return (
    <Link
      href={`/projects/${t.project_id}`}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 transition hover:border-primary/30 hover:bg-white/[0.07]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{t.title}</p>
        <p className="truncate text-xs text-muted">{projectName}</p>
      </div>
      <span
        className={`chip ${PRIORITY_META[t.priority].badge}`}
      >
        {PRIORITY_META[t.priority].label}
      </span>
      <span className={`whitespace-nowrap text-xs font-semibold ${toneCls}`}>
        {t.due_date}
      </span>
    </Link>
  );
}

export default async function TodayPage() {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());

  const [tRes, pRes, aRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,title,due_date,priority,project_id")
      .neq("status", "done")
      .not("due_date", "is", null)
      .order("due_date"),
    supabase.from("projects").select("id,name,status,created_at"),
    supabase
      .from("activity_log")
      .select("project_id,created_at")
      .order("created_at", { ascending: false }),
  ]);
  const tasks = (tRes.data as TaskRow[] | null) ?? [];
  const projects = (pRes.data as ProjRow[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const activeCount = projects.filter((p) => p.status === "active").length;
  const acts =
    (aRes.data as { project_id: string | null; created_at: string }[] | null) ??
    [];
  const lastAct = new Map<string, string>();
  for (const a of acts) {
    if (a.project_id && !lastAct.has(a.project_id))
      lastAct.set(a.project_id, a.created_at);
  }

  const now = Date.now();
  const stale = projects
    .filter((p) => p.status === "active")
    .map((p) => {
      const last = lastAct.get(p.id) ?? p.created_at;
      const days = Math.floor((now - new Date(last).getTime()) / 86400000);
      return { id: p.id, name: p.name, days };
    })
    .filter((p) => p.days >= STALE_DAYS)
    .sort((a, b) => b.days - a.days);

  const overdue = tasks.filter((t) => (t.due_date ?? "") < today);
  const todayTasks = tasks.filter((t) => t.due_date === today);
  const upcoming = tasks.filter((t) => (t.due_date ?? "") > today);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Today</h1>
        <p className="mt-0.5 text-sm text-muted">{today}</p>
      </div>

      {/* 統計ダッシュボード */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="進行中の案件" value={activeCount} icon="projects" tone="primary" />
        <StatCard label="期限超過" value={overdue.length} icon="alert" tone="danger" />
        <StatCard label="今日が期限" value={todayTasks.length} icon="today" tone="warning" />
        <StatCard label="放置案件" value={stale.length} icon="flag" tone="accent" />
      </div>

      {/* 横断検索 */}
      <form action="/search" className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" size={17} />
        </span>
        <input name="q" placeholder="案件・タスクを検索" className="input pl-9" />
      </form>

      {/* 放置案件アラート */}
      {stale.length > 0 && (
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <Icon name="alert" size={16} />
            {STALE_DAYS}日以上動きのない案件（{stale.length}）
          </p>
          <div className="flex flex-wrap gap-2">
            {stale.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs text-ink"
              >
                {p.name}（{p.days}日）
              </Link>
            ))}
          </div>
        </div>
      )}

      {overdue.length > 0 && (
        <div className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-danger">
            <Icon name="alert" size={15} />
            期限超過（{overdue.length}）
          </h2>
          <div className="space-y-1.5">
            {overdue.map((t) => (
              <TaskRowView key={t.id} t={t} projectName={pName.get(t.project_id) ?? ""} tone="danger" />
            ))}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-warning">
            <Icon name="today" size={15} />
            今日が期限（{todayTasks.length}）
          </h2>
          <div className="space-y-1.5">
            {todayTasks.map((t) => (
              <TaskRowView key={t.id} t={t} projectName={pName.get(t.project_id) ?? ""} tone="warning" />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="section-label">今後の予定（{upcoming.length}）</h2>
          <div className="space-y-1.5">
            {upcoming.slice(0, 20).map((t) => (
              <TaskRowView key={t.id} t={t} projectName={pName.get(t.project_id) ?? ""} tone="muted" />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && stale.length === 0 && (
        <div className="card p-8 text-center text-sm text-muted">
          期限付きの未完了タスクはありません。案件のフェーズにタスクを追加すると、ここに期限順で出ます。
        </div>
      )}
    </section>
  );
}
