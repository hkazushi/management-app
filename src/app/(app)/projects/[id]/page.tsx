import Link from "next/link";

// 案件詳細。フェーズ進捗バー・タスク・AIサマリー・リソースはステップ4〜7で実装。
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <section className="space-y-4">
      <Link href="/projects" className="text-sm text-muted hover:text-ink">
        ← 案件一覧へ
      </Link>

      <h1 className="text-2xl font-bold text-ink">案件詳細</h1>
      <p className="text-xs text-muted">ID: {id}</p>

      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        フェーズ進捗・タスク・AIサマリー・リソースはステップ4〜7で実装します。
      </div>
    </section>
  );
}
