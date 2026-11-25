import { Manul } from "@/components/Manul";
import { Meerkat } from "@/components/Meerkat";

// 画面遷移時に即表示される（体感の待ち時間を短くする）。2匹が縁からのぞいて待っている。
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="relative pt-11">
        <Manul variant="peek" className="mascot-peek absolute left-8 top-0 h-[64px] w-auto" />
        <Meerkat variant="peek" className="mascot-peek absolute right-8 top-0 h-[64px] w-auto [animation-delay:0.15s]" />
        <div className="relative z-10 flex h-24 items-center justify-center rounded-[24px] bg-primary">
          <p className="animate-pulse font-display text-[11px] font-bold uppercase tracking-[0.4em] text-sun">Loading</p>
        </div>
      </div>
      <div className="animate-pulse space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
