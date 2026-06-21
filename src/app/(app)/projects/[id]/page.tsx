import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "../actions";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryChip } from "@/components/CategoryChip";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import type { Database } from "@/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type CategoryLite = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "name" | "color"
>;

// 案件詳細。基本情報＋編集/削除（ステップ3）。
// フェーズ進捗・タスク・AIサマリー・リソースはステップ4〜7で追加。
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  const project = data as Project | null;
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

      {/* ステップ4以降 */}
      <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
        フェーズの進捗バー・タスク・AIサマリー・リソースはステップ4〜7で表示します。
      </div>
    </section>
  );
}
