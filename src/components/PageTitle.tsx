import { Meerkat } from "./Meerkat";

// ページの見出し。深い色の面に、明朝の大きな題と、金の細線の飾り。右上からミーアキャットがのぞく。
export function PageTitle({
  title,
  label,
  tone,
  children,
}: {
  title: string;
  label: string; // 小さな英字ラベル
  tone: string; // 色面のクラス（例: "bg-accent text-white"）
  children?: React.ReactNode; // 右側に置くもの（月の切り替えなど）
}) {
  return (
    <div className="relative pt-7">
      <Meerkat variant="peek" className="absolute right-5 top-0 z-0 h-[52px] w-auto" />
      <div className={`relative z-10 overflow-hidden rounded-[24px] px-5 pb-5 pt-5 shadow-hard-lg ${tone}`}>
        {/* 飾り：金の同心円 */}
        <svg className="pointer-events-none absolute -left-10 -top-12 h-44 w-44 text-sun opacity-40" viewBox="0 0 100 100" aria-hidden="true">
          {[18, 26, 34, 42, 50].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="0.5" />
          ))}
        </svg>
        <span className="pointer-events-none absolute inset-[5px] rounded-[20px] border border-sun/40" aria-hidden="true" />
        <span className="sticker relative opacity-80">{label}</span>
        <div className="relative mt-2 flex items-end justify-between gap-3">
          <h1 className="display text-[30px] leading-tight">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

// セクションの小見出し（金のひし形と細い線）
export function SectionTitle({ children, right }: { children: React.ReactNode; tone?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="display flex shrink-0 items-center gap-2 text-[18px] text-ink">
        <span className="h-2 w-2 shrink-0 rotate-45 bg-sun" aria-hidden="true" />
        {children}
      </h2>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      {right}
    </div>
  );
}
