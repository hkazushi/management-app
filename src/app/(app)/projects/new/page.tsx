import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories, createProject } from "../actions";
import { ProjectForm } from "@/components/ProjectForm";
import { Icon } from "@/components/Icon";

export default async function NewProjectPage() {
  await ensureDefaultCategories();
  const supabase = await createClient();
  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id,name,color")
    .order("created_at");
  const categories =
    (categoriesRaw as { id: string; name: string; color: string }[] | null) ??
    [];

  return (
    <section className="space-y-4">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <Icon name="back" size={15} />
        案件一覧へ
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-ink">新規案件</h1>

      <ProjectForm
        action={createProject}
        categories={categories}
        submitLabel="作成する"
      />
    </section>
  );
}
