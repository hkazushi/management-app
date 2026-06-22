import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "./actions";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { ProjectList, type Overview } from "@/components/ProjectList";
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
type TaskAgg = {
  project_id: string;
  status: string;
  due_date: string | null;
};

// 案件一覧（spec §3.1 / §3.9）。検索・絞り込み・追加・ステータス変更は ProjectList。
export default async function ProjectsPage() {
  const supabase = await createClient();

  const [, catsRes, projRes, tasksRes] = await Promise.all([
    ensureDefaultCategories(),
    supabase.from("categories").select("id,name,color").order("created_at"),
    supabase
      .from("projects")
      .select("id,name,client,status,category_id,due_date")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("project_id,status,due_date"),
  ]);

  const categories = (catsRes.data as Cat[] | null) ?? [];
  const projects = (projRes.data as Proj[] | null) ?? [];
  const tasks = (tasksRes.data as TaskAgg[] | null) ?? [];

  // 案件ごとの大枠（進捗・次の期限）を集計
  const overview: Overview = {};
  for (const t of tasks) {
    const o = (overview[t.project_id] ??= { total: 0, done: 0, nextDue: null });
    o.total += 1;
    if (t.status === "done") o.done += 1;
    else if (t.due_date && (!o.nextDue || t.due_date < o.nextDue))
      o.nextDue = t.due_date;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">案件</h1>
        <Link href="/projects/new" className="btn-ghost">
          <Icon name="edit" size={14} />
          詳細追加
        </Link>
      </div>

      <ProjectList
        projects={projects}
        categories={categories}
        overview={overview}
      />

      <p className="pt-1 text-center">
        <Link href="/archive" className="text-xs text-muted hover:text-ink">
          完了・アーカイブを見る →
        </Link>
      </p>
    </section>
  );
}
