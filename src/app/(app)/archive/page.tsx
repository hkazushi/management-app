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

// アーカイブ（spec §3.9）。done / archived を畳む。
export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from("projects")
    .select("id,name,client,status")
    .in("status", ["done", "archived"])
    .order("created_at", { ascending: false });
  const projects = (raw as ProjLite[] | null) ?? [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">アーカイブ</h1>
        <Link href="/projects" className="text-sm text-muted hover:text-ink">
          ← 案件へ
        </Link>
      </div>
      <p className="text-sm text-muted">完了・アーカイブ済みの案件</p>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          完了・アーカイブ済みの案件はまだありません。
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="card block p-4 opacity-80 transition hover:opacity-100 hover:shadow-pop"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-ink">{p.name}</span>
                  <StatusBadge status={p.status} />
                </div>
                {p.client && (
                  <p className="mt-0.5 text-sm text-muted">{p.client}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
