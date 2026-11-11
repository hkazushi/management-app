import { createClient } from "@/lib/supabase/server";
import { Vault, type ResourceItem } from "@/components/Vault";
import type { VaultRow } from "@/lib/vault";

// ログパス：案件ごとの URL・ログインID・パスワード
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const supabase = await createClient();

  const [vRes, rRes, pRes] = await Promise.all([
    supabase.from("vaults").select("public_key,enc_private_key,salt,iv,iterations").maybeSingle(),
    supabase
      .from("project_resources")
      .select("id,project_id,type,label,url,account,note,secret_enc,source,needs_review")
      .order("label", { ascending: true }),
    supabase.from("projects").select("id,name,status").order("name", { ascending: true }),
  ]);

  const notReady = !!vRes.error || !!rRes.error;
  const vault = vRes.data as unknown as VaultRow | null;
  const items = (rRes.data as unknown as ResourceItem[] | null) ?? [];
  const allProjects =
    (pRes.data as unknown as { id: string; name: string; status: string }[] | null) ?? [];
  // アーカイブ済みでも、登録があるものは選べるようにする
  const used = new Set(items.map((i) => i.project_id));
  const projects = allProjects.filter((p) => p.status !== "アーカイブ" || used.has(p.id));

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">ログパス</h1>
        <p className="mt-0.5 text-sm text-muted">案件ごとの URL・ログインID・パスワード</p>
      </div>

      {notReady ? (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          データベースの準備が終わっていません。Supabase の SQL Editor で
          supabase/migrations/0007_vault.sql を実行してください。
        </p>
      ) : (
        <Vault vault={vault} items={items} projects={projects} initialProject={project ?? ""} />
      )}
    </section>
  );
}
