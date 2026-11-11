import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { createProject } from "../meetings/actions";
import { Icon } from "@/components/Icon";
import type { Project } from "@/types/database";

// 案件の一覧。最後に動いた日（打ち合わせ・Claude Code の作業）、未完了の宿題が分かる。
export default async function ProjectsPage() {
  const supabase = await createClient();
  const [pRes, mRes, aRes, wRes] = await Promise.all([
    supabase.from("projects").select("id,name,client,status").neq("status", "アーカイブ"),
    supabase.from("meetings").select("project_id,started_at").order("started_at", { ascending: false }),
    supabase.from("action_items").select("project_id").eq("done", false),
    supabase
      .from("activity_log")
      .select("project_id,detail,created_at")
      .eq("action", "session")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const projects = (pRes.data as unknown as Project[] | null) ?? [];
  const meetings =
    (mRes.data as unknown as { project_id: string | null; started_at: string }[] | null) ?? [];
  const actions = (aRes.data as unknown as { project_id: string | null }[] | null) ?? [];

  const works =
    (wRes.data as unknown as { project_id: string | null; detail: string | null; created_at: string }[] | null) ?? [];

  type Stat = {
    count: number; // 打ち合わせの回数
    last: string | null; // 最後の打ち合わせ
    open: number; // 未完了の宿題
    workDays: number; // Claude Code で作業した日数
    lastWork: string | null;
    lastWorkTitle: string;
  };
  const stats = new Map<string, Stat>();
  const stat = (id: string) => {
    if (!stats.has(id)) {
      stats.set(id, { count: 0, last: null, open: 0, workDays: 0, lastWork: null, lastWorkTitle: "" });
    }
    return stats.get(id)!;
  };
  for (const w of works) {
    if (!w.project_id) continue;
    const s = stat(w.project_id);
    s.workDays += 1;
    if (!s.lastWork) {
      s.lastWork = w.created_at; // 新しい順に並んでいるので最初が最新
      try {
        const d = JSON.parse(w.detail ?? "") as { title?: unknown };
        if (typeof d.title === "string") s.lastWorkTitle = d.title;
      } catch {
        // 古い形式の行は題名なし
      }
    }
  }
  for (const m of meetings) {
    if (!m.project_id) continue;
    const s = stat(m.project_id);
    s.count += 1;
    if (!s.last) s.last = m.started_at; // 新しい順に並んでいるので最初が最新
  }
  for (const a of actions) if (a.project_id) stat(a.project_id).open += 1;

  // 最近動いた案件を上に、記録のない案件は名前順で下に
  const latest = (id: string) => {
    const s = stats.get(id);
    const a = s?.last ?? "";
    const b = s?.lastWork ?? "";
    return a > b ? a : b;
  };
  const sorted = [...projects].sort((a, b) => {
    const la = latest(a.id);
    const lb = latest(b.id);
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
                      {s?.lastWork && (!s.last || s.lastWork > s.last)
                        ? `${fmtDateTime(s.lastWork)} ${s.lastWorkTitle}`
                        : s?.last
                          ? `最後の打ち合わせ ${fmtDateTime(s.last)}`
                          : "記録なし"}
                    </p>
                  </div>
                  {s && s.open > 0 && (
                    <span className="chip shrink-0 bg-primary/10 text-primary">宿題 {s.open}</span>
                  )}
                  <span className="shrink-0 text-right text-xs tabular-nums text-muted">
                    {s && s.workDays > 0 && <span className="block">作業 {s.workDays}日</span>}
                    {s && s.count > 0 && <span className="block">打合せ {s.count}回</span>}
                  </span>
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
