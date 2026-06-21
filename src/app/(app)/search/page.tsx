import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/StatusBadge";
import type { ProjectStatus } from "@/types/database";

type ProjLite = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
};
type TaskLite = { id: string; title: string; project_id: string };

// 横断検索（spec §3.8）。案件名・メモ・クライアント・タスク名を対象。
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  // PostgREST の or/ilike を壊す文字を除去
  const safe = query.replace(/[,()%*]/g, " ").trim();

  let projects: ProjLite[] = [];
  let tasks: TaskLite[] = [];
  let pName = new Map<string, string>();

  if (safe) {
    const supabase = await createClient();
    const { data: pRaw } = await supabase
      .from("projects")
      .select("id,name,client,status")
      .or(`name.ilike.%${safe}%,note.ilike.%${safe}%,client.ilike.%${safe}%`)
      .limit(50);
    projects = (pRaw as ProjLite[] | null) ?? [];

    const { data: tRaw } = await supabase
      .from("tasks")
      .select("id,title,project_id")
      .ilike("title", `%${safe}%`)
      .limit(50);
    tasks = (tRaw as TaskLite[] | null) ?? [];

    const { data: allP } = await supabase.from("projects").select("id,name");
    pName = new Map(
      ((allP as { id: string; name: string }[] | null) ?? []).map((p) => [
        p.id,
        p.name,
      ]),
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">検索</h1>

      <form action="/search" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="案件・タスクを検索"
          className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white">
          検索
        </button>
      </form>

      {!safe ? (
        <p className="text-sm text-muted">キーワードを入力してください。</p>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">
              案件（{projects.length}）
            </h2>
            {projects.length === 0 ? (
              <p className="text-sm text-muted">該当なし</p>
            ) : (
              <ul className="space-y-1.5">
                {projects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                    >
                      <span className="truncate text-sm text-ink">
                        {p.name}
                        {p.client && (
                          <span className="ml-2 text-xs text-muted">
                            {p.client}
                          </span>
                        )}
                      </span>
                      <StatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted">
              タスク（{tasks.length}）
            </h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">該当なし</p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/projects/${t.project_id}`}
                      className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
                    >
                      <span className="truncate text-sm text-ink">{t.title}</span>
                      <span className="ml-auto truncate text-xs text-muted">
                        {pName.get(t.project_id) ?? ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
