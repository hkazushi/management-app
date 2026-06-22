import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "../actions";
import { ensureDefaultPhases } from "./actions";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { PhaseStepper } from "@/components/PhaseStepper";
import { PhaseSection } from "@/components/PhaseSection";
import { AddResourceForm } from "@/components/AddResourceForm";
import { ResourceItem } from "@/components/ResourceItem";
import { SummaryButton } from "@/components/SummaryButton";
import { Icon } from "@/components/Icon";
import type {
  Database,
  PhaseStatus,
  TaskStatus,
  TaskPriority,
  ResourceType,
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
type Resource = {
  id: string;
  type: ResourceType;
  label: string;
  url: string | null;
  account: string | null;
  note: string | null;
};

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

  const { data: resRaw } = await supabase
    .from("project_resources")
    .select("id,type,label,url,account,note")
    .eq("project_id", id)
    .order("created_at");
  const resources = (resRaw as Resource[] | null) ?? [];

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
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <Icon name="back" size={15} />
        案件一覧へ
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
        <div className="card whitespace-pre-wrap p-4 text-sm leading-relaxed text-ink">
          {project.note}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link href={`/projects/${id}/edit`} className="btn-ghost">
          <Icon name="edit" size={15} />
          編集
        </Link>
        <DeleteProjectButton
          action={deleteProject.bind(null, id)}
          name={project.name}
        />
      </div>

      {/* AIサマリー（spec §3.4） */}
      <div className="space-y-2 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-accent/5 p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="sparkles" size={15} className="text-primary" filled />
            AIサマリー
          </h2>
          {project.summary_updated_at && (
            <span className="text-[11px] text-muted">
              更新 {String(project.summary_updated_at).slice(0, 10)}
            </span>
          )}
        </div>
        {project.summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {project.summary}
          </p>
        ) : (
          <p className="text-sm text-muted">
            ボタンで現状サマリーを生成します（フェーズ・タスク・活動ログを材料に）。
          </p>
        )}
        <SummaryButton projectId={id} hasSummary={!!project.summary} />
      </div>

      {/* フェーズ進捗 */}
      <PhaseStepper phases={stepperPhases} overallPct={overallPct} />

      {/* フェーズ別タスク（折りたたみ式） */}
      <div className="space-y-2.5">
        {phases.map((phase) => {
          const phaseTasks = tasks.filter((t) => t.phase_id === phase.id);
          const prog = progMap.get(phase.id);
          const doneN = phaseTasks.filter((t) => t.status === "done").length;
          return (
            <PhaseSection
              key={phase.id}
              projectId={id}
              phase={phase}
              tasks={phaseTasks}
              done={doneN}
              total={prog?.total_count ?? phaseTasks.length}
            />
          );
        })}
      </div>

      {/* 情報・リソース（spec §3.5） */}
      <div className="card space-y-2.5 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-ink">情報・リソース</h2>
          <span className="text-xs text-muted">リンク / アカウント / ツール</span>
        </div>
        {resources.length > 0 && (
          <div className="space-y-1.5">
            {resources.map((r) => (
              <ResourceItem key={r.id} projectId={id} resource={r} />
            ))}
          </div>
        )}
        <AddResourceForm projectId={id} />
        <p className="text-[11px] text-muted">
          パスワード本体は保存しません（パスワードマネージャーの所在をメモするだけ）。
        </p>
      </div>
    </section>
  );
}
