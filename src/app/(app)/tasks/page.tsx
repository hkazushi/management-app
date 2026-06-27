import { createClient } from "@/lib/supabase/server";
import { TasksView, type Item } from "@/components/TasksView";
import { NewTaskForm } from "@/components/NewTaskForm";
import { ACTIVE_STATUSES } from "@/lib/constants";
import type { TaskPriority, TaskStatus, ProjectStatus } from "@/types/database";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
  phase_id: string | null;
  created_at: string;
};
type ProjRow = { id: string; name: string; status: ProjectStatus };
type PhaseRow = { id: string; name: string };

// 全案件横断のタスクビュー。何のプロジェクトの何の作業をいつまでに、を一望する。
export default async function TasksPage() {
  const supabase = await createClient();
  const [tRes, pRes, phRes] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id,title,status,priority,due_date,project_id,phase_id,created_at",
      ),
    supabase.from("projects").select("id,name,status"),
    supabase.from("phases").select("id,name"),
  ]);

  const tasks = (tRes.data as TaskRow[] | null) ?? [];
  const projects = (pRes.data as ProjRow[] | null) ?? [];
  const phases = (phRes.data as PhaseRow[] | null) ?? [];
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const phName = new Map(phases.map((p) => [p.id, p.name]));

  const items: Item[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    due_date: t.due_date,
    project_id: t.project_id,
    project_name: pName.get(t.project_id) ?? "（不明）",
    phase_name: t.phase_id ? (phName.get(t.phase_id) ?? null) : null,
  }));

  // 新規追加先の案件は「作業中（完了/アーカイブ以外）」を優先表示
  const working = new Set<string>(ACTIVE_STATUSES);
  const projectOptions = projects
    .map((p) => ({ id: p.id, name: p.name, status: p.status }))
    .sort(
      (a, b) =>
        Number(!working.has(a.status)) - Number(!working.has(b.status)) ||
        a.name.localeCompare(b.name, "ja"),
    );

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">タスク</h1>
        <p className="mt-0.5 text-sm text-muted">
          全案件横断。何の案件の何の作業をいつまでに。
        </p>
      </div>

      {/* 新規追加（案件＋タイトル＋期限＋優先度） */}
      <NewTaskForm projects={projectOptions} />

      <TasksView items={items} projects={projectOptions} />
    </section>
  );
}
