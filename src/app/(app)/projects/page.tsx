// 案件一覧。CRUD・カテゴリ色分け・絞り込み・draft薄表示はステップ3で実装。
export default function ProjectsPage() {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">案件</h1>
        <button
          type="button"
          disabled
          className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white opacity-50"
        >
          ＋新規
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        案件の一覧・追加・絞り込みはステップ3で実装します。
      </div>
    </section>
  );
}
