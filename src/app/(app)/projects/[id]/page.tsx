import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "../actions";
import { ensureDefaultPhases } from "./actions";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { PhaseStepper } from "@/components/PhaseStepper";
import { PhaseStatusSelect } from "@/components/PhaseStatusSelect";
import { AddTaskForm } from "@/components/AddTaskForm";
import { TaskItem } from "@/components/TaskItem";
import type {
  Database,
  PhaseStatus,
  TaskStatus,
  TaskPriority,
} from "@/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type CategoryLite = { name: string; color: string };
type Phase = {
  id: string;
  name: string;
  status: PhaseStatus;
  position: number;
};
type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  phase_id: string | null;
  sort_order: number;
};
type Prog = { phase_id: string; total_count: number; progress_pct: number };

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureDefaultPhases(id);
  const supabase = await createClient();

  const { data: projRaw } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  const project = projRaw as Project | null;
  if (!project) notFound();

  let category: CategoryLite | null = null;
  if (project.category_id) {
    const res = await supabase
      .from("categories")
      .select("name,color")
      .eq("id", project.category_id)
      .single();
    category = (res.data as CategoryLite | null) ?? null;
  }

  const { data: phasesRaw } = await supabase
    .from("phases")
    .select("id,name,status,position")
    .eq("project_id", id)
    .order("position");
  const phases = (phasesRaw as Phase[] | null) ?? [];

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("id,title,status,priority,due_date,phase_id,sort_order")
    .eq("project_id", id)
    .order("sort_order");
  const tasks = (tasksRaw as Task[] | null) ?? [];

  const { data: progRaw } = await supabase
    .from("phase_progress")
    .select("phase_id,total_count,progress_pct")
    .eq("project_id", id);
  const progMap = new Map(
    ((progRaw as Prog[] | null) ?? []).map((p) => [p.phase_id, p]),
  );

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const overallPct = totalTasks
    ? Math.round((100 * doneTasks) / totalTasks)
    : 0;

  const stepperPhases = phases.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    progress_pct: progMap.get(p.id)?.progress_pct ?? 0,
    total: progMap.get(p.id)?.total_count ?? 0,
  }));

  return (
    <section className="space-y-5">
      <Link href="/projects" className="text-sm text-muted hover:text-ink">
        ← 案件一覧へ
      </Link>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-ink">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        {project.client && (
          <p className="text-sm text-muted">{project.client}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {category && (
            <CategoryChip name={category.name} color={category.color} />
          )}
          {project.due_date && (
            <span className="text-xs text-muted">期限 {project.due_date}</span>
          )}
        </div>
      </header>

      {project.note && (
        <div className="whitespace-pre-wrap rounded-2xl border border-border bg-surface p-4 text-sm leading-relaxed text-ink">
          {project.note}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link
          href={`/projects/${id}/edit`}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink hover:border-primary/50"
        >
          編集
        </Link>
        <DeleteProjectButton
          action={deleteProject.bind(null, id)}
          name={project.name}
        />
      </div>

      {/* フェーズ進捗 */}
      <PhaseStepper phases={stepperPhases} overallPct={overallPct} />

      {/* フェーズ別タスク */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const phaseTasks = tasks.filter((t) => t.phase_id === phase.id);
          const prog = progMap.get(phase.id);
          return (
            <div
              key={phase.id}
              className="rounded-2xl border border-border bg-surface/60 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-ink">{phase.name}</h2>
                  {prog && prog.total_count > 0 && (
                    <span className="text-xs text-muted">
                      {prog.progress_pct}%（{phaseTasks.filter((t) => t.status === "done").length}/{prog.total_count}）
                    </span>
                  )}
                </div>
                <PhaseStatusSelect
                  projectId={id}
                  phaseId={phase.id}
                  status={phase.status}
                />
              </div>

              <div className="space-y-1.5">
                {phaseTasks.map((task) => (
                  <TaskItem key={task.id} projectId={id} task={task} />
                ))}
              </div>

              <div className="mt-2.5">
                <AddTaskForm projectId={id} phaseId={phase.id} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
