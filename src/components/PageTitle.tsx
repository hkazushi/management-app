// ページの見出し。色面の上に太い文字と、傾けたラベル・飾りの図形を置く。
export function PageTitle({
  title,
  label,
  tone,
  children,
}: {
  title: string;
  label: string; // 傾けて貼る短い英字ラベル
  tone: string; // 色面のクラス（例: "bg-accent text-white"）
  children?: React.ReactNode; // 右側に置くもの（月の切り替えなど）
}) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] border-2 border-ink px-4 pb-4 pt-5 shadow-hard ${tone}`}>
      {/* 飾り：ギザギザの星と半円 */}
      <svg className="pointer-events-none absolute -right-5 -top-6 h-24 w-24 opacity-25" viewBox="0 0 100 100" aria-hidden="true">
        <path
          fill="currentColor"
          d="M50 2l9 19 20-8-4 21 21 6-16 14 13 17-21 2 1 21-18-11-13 17-6-20-21 3 10-19L7 54l19-9-9-19 21 3z"
        />
      </svg>
      <span className="pointer-events-none absolute -bottom-7 left-1/2 h-14 w-14 rounded-full border-2 border-ink bg-sun" aria-hidden="true" />
      <span className="sticker bg-surface text-ink">{label}</span>
      <div className="relative mt-1.5 flex items-end justify-between gap-3">
        <h1 className="display text-[28px] leading-tight">{title}</h1>
        {children}
      </div>
    </div>
  );
}

// セクションの小見出し（左に色の四角）
export function SectionTitle({ children, tone = "bg-primary", right }: { children: React.ReactNode; tone?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="display flex items-center gap-2 text-[17px] text-ink">
        <span className={`h-3.5 w-3.5 shrink-0 rotate-12 border-2 border-ink ${tone}`} aria-hidden="true" />
        {children}
      </h2>
      {right}
    </div>
  );
}
