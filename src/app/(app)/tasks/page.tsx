import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TasksView, type Item } from "@/components/TasksView";
import { Icon } from "@/components/Icon";
import type { TaskPriority, TaskStatus } from "@/types/database";

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
type ProjRow = { id: string; name: string };
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
    supabase.from("projects").select("id,name"),
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

  const projectOptions = Array.from(pName.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">タスク</h1>
        <Link href="/projects" className="btn-ghost">
          <Icon name="projects" size={14} />
          案件から追加
        </Link>
      </div>
      <p className="text-sm text-muted">
        全案件横断。期限順／グループ順で並べ替え、完了や優先度をその場で操作できます。
      </p>

      <TasksView items={items} projects={projectOptions} />
    </section>
  );
}
