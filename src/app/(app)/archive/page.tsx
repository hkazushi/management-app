// アーカイブ。done / archived 案件を畳む。実装はステップ6。
export default function ArchivePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-ink">アーカイブ</h1>
      <p className="mt-1 text-sm text-muted">完了・アーカイブ済みの案件</p>

      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        done / archived 案件の畳み込み表示はステップ6で実装します。
      </div>
    </section>
  );
}
