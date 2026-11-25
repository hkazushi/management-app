// アプリの案内役のミーアキャット。金の蝶ネクタイをしている。
// stand: 立って見張っている全身 / peek: 縁から顔と手だけ出している
// まばたき・首かしげ・しっぽの動きは globals.css の .mascot-* で付けている。
const FUR = "#C9A57A";
const FUR_DARK = "#A9865C";
const BELLY = "#F0E2C6";
const PATCH = "#3A2B22";
const GOLD = "#C9A862";

function Head({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <g className="mascot-tilt">
      {/* 耳 */}
      <ellipse cx="-21" cy="-9" rx="6" ry="5" fill={PATCH} />
      <ellipse cx="21" cy="-9" rx="6" ry="5" fill={PATCH} />
      {/* 頭 */}
      <path d="M-24 -4c0-14 10-22 24-22s24 8 24 22c0 13-9 25-24 27C-15 21-24 9-24-4Z" fill={FUR} />
      {/* 鼻先の明るい部分 */}
      <path d="M-11 6c0-8 5-12 11-12s11 4 11 12c0 8-5 14-11 15C-6 20-11 14-11 6Z" fill={BELLY} />
      {/* 目のまわりの黒い模様 */}
      <ellipse cx="-11" cy="-3" rx="7.5" ry="6" fill={PATCH} transform="rotate(-18 -11 -3)" />
      <ellipse cx="11" cy="-3" rx="7.5" ry="6" fill={PATCH} transform="rotate(18 11 -3)" />
      {/* 目（まばたきする） */}
      <g className="mascot-blink">
        <circle cx="-10.5" cy="-3" r="3" fill="#120D0A" />
        <circle cx="10.5" cy="-3" r="3" fill="#120D0A" />
        <circle cx="-9.4" cy="-4.2" r="1" fill="#FFFDF8" />
        <circle cx="11.6" cy="-4.2" r="1" fill="#FFFDF8" />
      </g>
      {/* 鼻と口 */}
      <path d="M-3.6 9.5c0-2 1.6-3 3.6-3s3.6 1 3.6 3c0 1.8-2 3.2-3.6 3.2S-3.6 11.3-3.6 9.5Z" fill={PATCH} />
      <path d="M0 12.5v3M0 15.5c-1.5 1.8-3.5 1.8-4.8.6M0 15.5c1.5 1.8 3.5 1.8 4.8.6" fill="none" stroke={PATCH} strokeWidth="1.1" strokeLinecap="round" />
      </g>
    </g>
  );
}

function BowTie({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path d="M0 0-11-6.5v13ZM0 0 11-6.5v13Z" fill={GOLD} stroke="#8E7436" strokeWidth="0.8" strokeLinejoin="round" />
      <circle r="2.6" fill="#B3924A" stroke="#8E7436" strokeWidth="0.8" />
    </g>
  );
}

export function Meerkat({
  variant = "stand",
  className = "",
}: {
  variant?: "stand" | "peek";
  className?: string;
}) {
  if (variant === "peek") {
    return (
      <svg viewBox="0 0 120 70" className={className} aria-hidden="true">
        <Head cx={60} cy={34} />
        {/* 縁にかけた手 */}
        <ellipse cx="34" cy="64" rx="9" ry="7" fill={FUR_DARK} />
        <ellipse cx="86" cy="64" rx="9" ry="7" fill={FUR_DARK} />
        <path d="M30 62v5M34 61.5v6M38 62v5M82 62v5M86 61.5v6M90 62v5" stroke={PATCH} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden="true">
      {/* しっぽ（ゆれる） */}
      <g className="mascot-tail">
        <path d="M78 168c14 2 26-2 30-14" fill="none" stroke={FUR_DARK} strokeWidth="7" strokeLinecap="round" />
        <path d="M103 160c2-2 4-4 5-6" fill="none" stroke={PATCH} strokeWidth="7" strokeLinecap="round" />
      </g>
      {/* 足 */}
      <ellipse cx="48" cy="187" rx="11" ry="6" fill={FUR_DARK} />
      <ellipse cx="72" cy="187" rx="11" ry="6" fill={FUR_DARK} />
      {/* 胴 */}
      <path d="M60 58c-17 0-25 26-25 62 0 38 9 66 25 66s25-28 25-66c0-36-8-62-25-62Z" fill={FUR} />
      {/* おなか */}
      <path d="M60 80c-10 0-14 20-14 44 0 28 5 50 14 50s14-22 14-50c0-24-4-44-14-44Z" fill={BELLY} />
      {/* 手（胸の前でそろえる） */}
      <path d="M40 92c-5 14-2 28 12 32" fill="none" stroke={FUR_DARK} strokeWidth="8" strokeLinecap="round" />
      <path d="M80 92c5 14 2 28-12 32" fill="none" stroke={FUR_DARK} strokeWidth="8" strokeLinecap="round" />
      <circle cx="53" cy="124" r="5" fill={PATCH} />
      <circle cx="67" cy="124" r="5" fill={PATCH} />
      <Head cx={60} cy={40} />
      <BowTie cx={60} cy={68} />
    </svg>
  );
}
