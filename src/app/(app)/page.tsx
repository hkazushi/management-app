import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PRIORITY_META } from "@/lib/constants";
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
        : "text-muted";
  return (
    <Link
      href={`/projects/${t.project_id}`}
      className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-ink">{t.title}</p>
        <p className="truncate text-xs text-muted">{projectName}</p>
      </div>
      <span
        className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${PRIORITY_META[t.priority].badge}`}
      >
        {PRIORITY_META[t.priority].label}
      </span>
      <span className={`whitespace-nowrap text-xs font-medium ${toneCls}`}>
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

  const { data: tRaw } = await supabase
    .from("tasks")
    .select("id,title,due_date,priority,project_id")
    .neq("status", "done")
    .not("due_date", "is", null)
    .order("due_date");
  const tasks = (tRaw as TaskRow[] | null) ?? [];

  const { data: pRaw } = await supabase
    .from("projects")
    .select("id,name,status,created_at");
  const projects = (pRaw as ProjRow[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));

  const { data: aRaw } = await supabase
    .from("activity_log")
    .select("project_id,created_at")
    .order("created_at", { ascending: false });
  const acts = (aRaw as { project_id: string | null; created_at: string }[] | null) ?? [];
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
        <h1 className="text-2xl font-bold text-ink">Today</h1>
        <p className="mt-0.5 text-sm text-muted">{today}</p>
      </div>

      {/* 横断検索 */}
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          placeholder="案件・タスクを検索"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button className="rounded-xl border border-border px-3 py-2 text-sm text-muted">
          検索
        </button>
      </form>

      {/* 放置案件アラート */}
      {stale.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/5 p-4">
          <p className="text-sm font-semibold text-warning">
            ⚠️ {STALE_DAYS}日以上動きのない案件（{stale.length}）
          </p>
          <div className="flex flex-wrap gap-2">
            {stale.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="rounded-full border border-warning/40 px-3 py-1 text-xs text-ink"
              >
                {p.name}（{p.days}日）
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 期限超過 */}
      {overdue.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-danger">
            期限超過（{overdue.length}）
          </h2>
          <div className="space-y-1.5">
            {overdue.map((t) => (
              <TaskRowView
                key={t.id}
                t={t}
                projectName={pName.get(t.project_id) ?? ""}
                tone="danger"
              />
            ))}
          </div>
        </div>
      )}

      {/* 今日 */}
      {todayTasks.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-warning">
            今日が期限（{todayTasks.length}）
          </h2>
          <div className="space-y-1.5">
            {todayTasks.map((t) => (
              <TaskRowView
                key={t.id}
                t={t}
                projectName={pName.get(t.project_id) ?? ""}
                tone="warning"
              />
            ))}
          </div>
        </div>
      )}

      {/* 今後 */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">
            今後の予定（{upcoming.length}）
          </h2>
          <div className="space-y-1.5">
            {upcoming.slice(0, 20).map((t) => (
              <TaskRowView
                key={t.id}
                t={t}
                projectName={pName.get(t.project_id) ?? ""}
                tone="muted"
              />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && stale.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          期限付きの未完了タスクはありません。案件のフェーズにタスクを追加すると、ここに期限順で出ます。
        </div>
      )}
    </section>
  );
}
