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
type PhaseAgg = {
  project_id: string;
  name: string;
  status: string;
  position: number;
};
type ActAgg = { project_id: string | null; created_at: string };

// 案件一覧（spec §3.1 / §3.9）。検索・絞り込み・追加・ステータス変更は ProjectList。
export default async function ProjectsPage() {
  const supabase = await createClient();

  const [, catsRes, projRes, tasksRes, phasesRes, actsRes] = await Promise.all([
    ensureDefaultCategories(),
    supabase.from("categories").select("id,name,color").order("created_at"),
    supabase
      .from("projects")
      .select("id,name,client,status,category_id,due_date")
      .in("status", ACTIVE_STATUSES)
      .order("created_at", { ascending: false }),
    supabase.from("tasks").select("project_id,status,due_date"),
    supabase
      .from("phases")
      .select("project_id,name,status,position")
      .order("position"),
    supabase
      .from("activity_log")
      .select("project_id,created_at")
      .order("created_at", { ascending: false }),
  ]);

  const categories = (catsRes.data as Cat[] | null) ?? [];
  const projects = (projRes.data as Proj[] | null) ?? [];
  const tasks = (tasksRes.data as TaskAgg[] | null) ?? [];
  const phases = (phasesRes.data as PhaseAgg[] | null) ?? [];
  const acts = (actsRes.data as ActAgg[] | null) ?? [];

  // 案件ごとの大枠（進捗・次の期限・現在フェーズ・最終更新）を集計
  const overview: Overview = {};
  const ov = (pid: string) =>
    (overview[pid] ??= {
      total: 0,
      done: 0,
      nextDue: null,
      phase: null,
      lastActivity: null,
    });
  for (const t of tasks) {
    const o = ov(t.project_id);
    o.total += 1;
    if (t.status === "done") o.done += 1;
    else if (t.due_date && (!o.nextDue || t.due_date < o.nextDue))
      o.nextDue = t.due_date;
  }
  // 現在フェーズ = in_progress、無ければ未完了の先頭、全部done なら「完了」
  const byProjPhases = new Map<string, PhaseAgg[]>();
  for (const ph of phases) {
    if (!byProjPhases.has(ph.project_id)) byProjPhases.set(ph.project_id, []);
    byProjPhases.get(ph.project_id)!.push(ph);
  }
  for (const [pid, list] of byProjPhases) {
    const inProg = list.find((p) => p.status === "in_progress");
    const firstOpen = list.find((p) => p.status !== "done");
    ov(pid).phase = inProg?.name ?? firstOpen?.name ?? "完了";
  }
  // 最終更新（activity_log は created_at desc 済み）
  for (const a of acts) {
    if (!a.project_id) continue;
    const o = ov(a.project_id);
    if (!o.lastActivity) o.lastActivity = a.created_at;
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
