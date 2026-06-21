import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "./actions";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { ProjectList } from "@/components/ProjectList";
import { Icon } from "@/components/Icon";
import type { ProjectStatus } from "@/types/database";

type Cat = { id: string; name: string; color: string };
type Proj = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  category_id: string | null;
  due_date: string | null;
};

// 案件一覧（spec §3.1 / §3.9）。作業中（draft/active/on_hold）を表示。検索・絞り込み・追加は ProjectList。
export default async function ProjectsPage() {
  await ensureDefaultCategories();
  const supabase = await createClient();

  const { data: catsRaw } = await supabase
    .from("categories")
    .select("id,name,color")
    .order("created_at");
  const categories = (catsRaw as Cat[] | null) ?? [];

  const { data: pRaw } = await supabase
    .from("projects")
    .select("id,name,client,status,category_id,due_date")
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false });
  const projects = (pRaw as Proj[] | null) ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">案件</h1>
        <Link href="/projects/new" className="btn-ghost">
          <Icon name="edit" size={14} />
          詳細追加
        </Link>
      </div>

      <ProjectList projects={projects} categories={categories} />

      <p className="pt-1 text-center">
        <Link href="/archive" className="text-xs text-muted hover:text-ink">
          完了・アーカイブを見る →
        </Link>
      </p>
    </section>
  );
}
