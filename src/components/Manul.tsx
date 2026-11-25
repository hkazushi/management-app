// もうひとりの案内役、マヌルネコ。ずんぐりした体、低く離れた耳、ほおの縞、むすっとした顔。
// sit: 座っている全身 / peek: 縁から顔と手だけ出している
const FUR = "#B7AC9C";
const FUR_DARK = "#8E8474";
const FUR_LIGHT = "#E9E2D4";
const STRIPE = "#4A4238";
const EYE = "#D9C25A";

// ふさふさの輪郭を、小さな山の連なりで描く
function Face({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* 耳（低く、横に離れている） */}
      <path d="M-40-12c-8-10-9-19-4-24 8 0 15 5 19 13Z" fill={FUR_DARK} />
      <path d="M40-12c8-10 9-19 4-24-8 0-15 5-19 13Z" fill={FUR_DARK} />
      <path d="M-38-16c-4-6-5-11-3-15 5 1 9 4 11 9Z" fill={FUR_LIGHT} />
      <path d="M38-16c4-6 5-11 3-15-5 1-9 4-11 9Z" fill={FUR_LIGHT} />
      {/* 顔（横に広い。ほおの毛がはねている） */}
      <path
        d="M0-32c22 0 38 10 42 26l7 4-6 5 6 6-8 4 3 8-9 1c-7 9-20 14-35 14s-28-5-35-14l-9-1 3-8-8-4 6-6-6-5 7-4C-38-22-22-32 0-32Z"
        fill={FUR}
      />
      {/* ひたいの斑点 */}
      <g fill={STRIPE}>
        <circle cx="-9" cy="-23" r="1.6" />
        <circle cx="0" cy="-25" r="1.6" />
        <circle cx="9" cy="-23" r="1.6" />
        <circle cx="-4.5" cy="-18.5" r="1.4" />
        <circle cx="4.5" cy="-18.5" r="1.4" />
      </g>
      {/* 目のまわりと口もとの白い毛 */}
      <ellipse cx="-15" cy="-4" rx="11" ry="9" fill={FUR_LIGHT} />
      <ellipse cx="15" cy="-4" rx="11" ry="9" fill={FUR_LIGHT} />
      <path d="M-13 12c0-7 6-10 13-10s13 3 13 10c0 6-6 11-13 11s-13-5-13-11Z" fill={FUR_LIGHT} />
      {/* ほおの縞 */}
      <path d="M-27 3c-6 1-11 4-15 8M-25 9c-5 2-9 5-12 9M27 3c6 1 11 4 15 8M25 9c5 2 9 5 12 9" fill="none" stroke={STRIPE} strokeWidth="2" strokeLinecap="round" />
      {/* 目（丸い瞳）と、むすっとした上まぶた */}
      <circle cx="-15" cy="-3" r="7" fill={EYE} />
      <circle cx="15" cy="-3" r="7" fill={EYE} />
      <circle cx="-15" cy="-3" r="3" fill="#15110D" />
      <circle cx="15" cy="-3" r="3" fill="#15110D" />
      <circle cx="-13.8" cy="-4.4" r="1" fill="#FFFDF8" />
      <circle cx="16.2" cy="-4.4" r="1" fill="#FFFDF8" />
      <path d="M-24-8c5-4 13-4 18 0M24-8c-5-4-13-4-18 0" fill="none" stroke={STRIPE} strokeWidth="2.4" strokeLinecap="round" />
      {/* 鼻と口（への字） */}
      <path d="M-4 6h8l-4 4.5Z" fill="#B0756A" />
      <path d="M0 10.5v3M0 13.5c-2 2.5-5.5 3-8 1.5M0 13.5c2 2.5 5.5 3 8 1.5" fill="none" stroke={STRIPE} strokeWidth="1.3" strokeLinecap="round" />
      {/* ひげ */}
      <path d="M-12 12-30 10M-12 15-29 17M12 12 30 10M12 15 29 17" stroke="#FFFDF8" strokeWidth="0.9" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

export function Manul({
  variant = "sit",
  className = "",
}: {
  variant?: "sit" | "peek";
  className?: string;
}) {
  if (variant === "peek") {
    return (
      <svg viewBox="0 0 120 70" className={className} aria-hidden="true">
        <Face cx={60} cy={40} />
        <ellipse cx="34" cy="65" rx="10" ry="7" fill={FUR_DARK} />
        <ellipse cx="86" cy="65" rx="10" ry="7" fill={FUR_DARK} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 170" className={className} aria-hidden="true">
      {/* しっぽ（太くて輪の模様） */}
      <path d="M112 142c22 6 38-4 36-22" fill="none" stroke={FUR} strokeWidth="18" strokeLinecap="round" />
      <path d="M128 143l3-17M141 136l-8-14" stroke={STRIPE} strokeWidth="4" strokeLinecap="round" />
      <path d="M146 122c1-3 1-6 0-8" fill="none" stroke={STRIPE} strokeWidth="18" strokeLinecap="round" />
      {/* 体（ずんぐり） */}
      <path d="M80 62c-34 0-52 24-52 56 0 26 18 44 52 44s52-18 52-44c0-32-18-56-52-56Z" fill={FUR} />
      {/* わき腹の縞 */}
      <path d="M34 112c5 2 9 6 11 11M32 126c5 1 9 4 12 9M126 112c-5 2-9 6-11 11M128 126c-5 1-9 4-12 9" fill="none" stroke={FUR_DARK} strokeWidth="3" strokeLinecap="round" />
      {/* 胸の明るい毛 */}
      <path d="M80 92c-16 0-24 14-24 32 0 18 9 32 24 32s24-14 24-32c0-18-8-32-24-32Z" fill={FUR_LIGHT} />
      {/* 前足 */}
      <ellipse cx="64" cy="158" rx="14" ry="8" fill={FUR_DARK} />
      <ellipse cx="96" cy="158" rx="14" ry="8" fill={FUR_DARK} />
      <Face cx={80} cy={56} />
    </svg>
  );
}
