import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { createProject } from "../meetings/actions";
import { Icon } from "@/components/Icon";
import type { Project } from "@/types/database";

// 案件の一覧。打ち合わせの回数・未完了の宿題・最後に話した日が分かる。
export default async function ProjectsPage() {
  const supabase = await createClient();
  const [pRes, mRes, aRes] = await Promise.all([
    supabase.from("projects").select("id,name,client,status").neq("status", "アーカイブ"),
    supabase.from("meetings").select("project_id,started_at").order("started_at", { ascending: false }),
    supabase.from("action_items").select("project_id").eq("done", false),
  ]);
  const projects = (pRes.data as unknown as Project[] | null) ?? [];
  const meetings =
    (mRes.data as unknown as { project_id: string | null; started_at: string }[] | null) ?? [];
  const actions = (aRes.data as unknown as { project_id: string | null }[] | null) ?? [];

  const stats = new Map<string, { count: number; last: string | null; open: number }>();
  const stat = (id: string) => {
    if (!stats.has(id)) stats.set(id, { count: 0, last: null, open: 0 });
    return stats.get(id)!;
  };
  for (const m of meetings) {
    if (!m.project_id) continue;
    const s = stat(m.project_id);
    s.count += 1;
    if (!s.last) s.last = m.started_at; // 新しい順に並んでいるので最初が最新
  }
  for (const a of actions) if (a.project_id) stat(a.project_id).open += 1;

  // 最近話した案件を上に、打ち合わせのない案件は名前順で下に
  const sorted = [...projects].sort((a, b) => {
    const la = stats.get(a.id)?.last ?? "";
    const lb = stats.get(b.id)?.last ?? "";
    if (la !== lb) return la < lb ? 1 : -1;
    return a.name.localeCompare(b.name, "ja");
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-ink">案件</h1>

      <form action={createProject} className="flex flex-wrap gap-2">
        <input name="name" required placeholder="案件名を追加" className="input min-w-[10rem] flex-1" />
        <input name="client" placeholder="クライアント（任意）" className="input w-44" />
        <button type="submit" className="btn-ghost shrink-0">
          <Icon name="plus" size={15} />
          追加
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">案件がまだありません。</p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {sorted.map((p, i) => {
            const s = stats.get(p.id);
            return (
              <li key={p.id} className={i > 0 ? "border-t border-border" : ""}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 bg-surface px-4 py-3 transition hover:bg-primary/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="truncate text-xs text-muted">
                      {p.client ? `${p.client}・` : ""}
                      {s?.last ? `最後の打ち合わせ ${fmtDateTime(s.last)}` : "打ち合わせの記録なし"}
                    </p>
                  </div>
                  {s && s.open > 0 && (
                    <span className="chip shrink-0 bg-primary/10 text-primary">宿題 {s.open}</span>
                  )}
                  <span className="shrink-0 text-xs tabular-nums text-muted">{s?.count ?? 0}回</span>
                  <Icon name="back" size={15} className="shrink-0 rotate-180 text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
