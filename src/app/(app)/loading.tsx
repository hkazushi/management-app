// 画面遷移時に即表示される骨組み（体感の待ち時間を短くする）
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 rounded-[22px] border-2 border-ink/20 bg-ink/5" />
      <div className="h-11 rounded-2xl border-2 border-ink/20 bg-ink/5" />
      <div className="space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl border-2 border-ink/20 bg-ink/5" />
        ))}
      </div>
    </div>
  );
}
