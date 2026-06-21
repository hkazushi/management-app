import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProject } from "../../actions";
import { ProjectForm } from "@/components/ProjectForm";
import type { Database } from "@/types/database";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default async function EditProjectPage({
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

  const { data: categories } = await supabase
    .from("categories")
    .select("id,name,color")
    .order("created_at");

  return (
    <section className="space-y-4">
      <Link
        href={`/projects/${id}`}
        className="text-sm text-muted hover:text-ink"
      >
        ← 案件詳細へ
      </Link>
      <h1 className="text-2xl font-bold text-ink">案件を編集</h1>

      <ProjectForm
        action={updateProject.bind(null, id)}
        categories={(categories as { id: string; name: string; color: string }[]) ?? []}
        defaultValues={project}
        submitLabel="保存する"
      />
    </section>
  );
}
