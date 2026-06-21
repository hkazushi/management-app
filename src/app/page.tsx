// ステップ1の動作確認用の仮トップ。
// ステップ2でルーティング（Today / 案件一覧 / 案件詳細 / アーカイブ）に置き換える。
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <div className="rounded-2xl border border-border bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Step 1 — Scaffold OK
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">案件・タスク管理</h1>
        <p className="mt-3 leading-relaxed text-muted">
          散らばっている案件情報を1箇所に集めて、現状を可視化する。
          <br />
          記録は自動・判断は手動。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Next.js
          </span>
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            Supabase
          </span>
          <span className="rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
            Tailwind
          </span>
        </div>
      </div>

      <p className="text-center text-sm text-muted">
        次のステップで認証とルーティングを追加します。
      </p>
    </main>
  );
}
