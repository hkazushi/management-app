import { Manul } from "./Manul";
import { Meerkat } from "./Meerkat";

// 肉球のあしあと
function Paw({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="5" ry="4.2" fill="currentColor" />
      <ellipse cx="5.5" cy="10" rx="2.2" ry="2.8" fill="currentColor" />
      <ellipse cx="18.5" cy="10" rx="2.2" ry="2.8" fill="currentColor" />
      <ellipse cx="9.3" cy="6" rx="2" ry="2.6" fill="currentColor" />
      <ellipse cx="14.7" cy="6" rx="2" ry="2.6" fill="currentColor" />
    </svg>
  );
}

// 各ページのいちばん下の小さな舞台。マヌルネコは座ってしっぽをふり、ミーアキャットは端から端まで歩く。
export function MascotScene() {
  return (
    <div className="mt-10 select-none" aria-hidden="true">
      <div className="relative h-[92px] [container-type:inline-size]">
        {/* あしあと */}
        <div className="absolute inset-x-6 bottom-2 flex items-end justify-between text-sun/50">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Paw key={i} className={`h-3 w-3 ${i % 2 ? "-translate-y-1.5 rotate-12" : "-rotate-12"}`} />
          ))}
        </div>
        <Manul className="absolute bottom-[5px] left-3 h-[62px] w-auto" />
        <div className="mascot-walk absolute bottom-[5px] left-0 w-max">
          <Meerkat className="mascot-step h-[84px] w-auto" />
        </div>
      </div>
      <div className="rule" />
      <p className="mt-2 text-center font-display text-[10px] font-bold uppercase tracking-[0.34em] text-faint">Futari Techo</p>
    </div>
  );
}
