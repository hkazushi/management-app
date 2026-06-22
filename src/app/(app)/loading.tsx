// 画面遷移時に即表示されるスケルトン（体感ローディング短縮）
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-28 rounded-lg bg-black/5" />
      <div className="h-11 rounded-xl bg-black/5" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-xl bg-black/5" />
        <div className="h-20 rounded-xl bg-black/5" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-black/5" />
        ))}
      </div>
    </div>
  );
}
