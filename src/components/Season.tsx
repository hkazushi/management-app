// 季節の飾り（いまはクリスマス）。
// <html> に class="xmas" が付いているあいだだけ見える（付け外しは SeasonScript が日付で行う）。
// 見た目の定義は globals.css の「クリスマス」の節。

// クリスマスの飾りを出す期間（日本時間。月日だけで判定する）
const XMAS_FROM = "11-25";
const XMAS_TO = "12-25";

// 画面を描く前に、今日の日付で <html> に class を付ける。
// ログイン画面のように作り置きされるページでも、開いた日の日付で決まるようにするため、ブラウザ側で動かす。
export function SeasonScript() {
  const code = `(function(){try{var p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo"}).format(new Date()).slice(5);if(p>="${XMAS_FROM}"&&p<="${XMAS_TO}")document.documentElement.classList.add("xmas")}catch(e){}})()`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

// 雪。粒の位置・大きさ・速さは決め打ち（毎回同じ並びにして、描き直しでちらつかないように）
const FLAKES = Array.from({ length: 42 }, (_, i) => {
  // 0〜1 の決まった値。粒どうしが一直線に並ばないよう、よく散る式にする
  const r = (n: number) => {
    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return {
    left: `${(r(1) * 100).toFixed(2)}%`,
    size: `${(3 + r(2) * 6).toFixed(1)}px`,
    duration: `${(9 + r(3) * 12).toFixed(1)}s`,
    delay: `${(-r(4) * 20).toFixed(1)}s`,
    sway: `${(r(5) * 60 - 30).toFixed(0)}px`,
    opacity: (0.55 + r(6) * 0.45).toFixed(2),
  };
});

export function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <i
          key={i}
          style={
            {
              left: f.left,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: f.duration,
              animationDelay: f.delay,
              "--sway": f.sway,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

// ヘッダーの下に下げる電飾。2色の層を交互に光らせて、またたいて見せる
export function Garland() {
  return (
    <div className="garland" aria-hidden="true">
      <span className="garland-a" />
      <span className="garland-b" />
    </div>
  );
}

// 見出しの上に積もった雪
export function SnowCap() {
  return (
    <svg className="snowcap" viewBox="0 0 400 18" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 0h400v7c-10 5-18-2-28 1s-14 9-26 5-12-7-24-4-16 8-28 5-10-8-24-6-14 8-26 6-14-9-28-6-12 8-26 5-12-8-24-6-16 9-28 6-12-7-24-5-14 8-26 6-12-7-22-4-12 6-16 2Z"
        fill="#FFFDF8"
      />
    </svg>
  );
}

// 小さなクリスマスツリー（ページ下の舞台に置く）
export function Tree({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 84" className={`xmas-only ${className}`} aria-hidden="true">
      <rect x="26" y="68" width="8" height="12" rx="1.5" fill="#6B4A2E" />
      <path d="M30 8 12 34h10L8 54h12L4 72h52L40 54h12L38 34h10Z" fill="#14463A" />
      <path d="M12 34h36M8 54h44" stroke="#0C3229" strokeWidth="1" opacity="0.5" />
      <path d="m30 1 2.2 4.6 5 .7-3.6 3.5.9 5L30 12.4 25.5 14.8l.9-5L22.8 6.3l5-.7Z" fill="#C9A862" className="twinkle" />
      <g className="twinkle">
        <circle cx="24" cy="30" r="2.2" fill="#B3263A" />
        <circle cx="38" cy="46" r="2.2" fill="#C9A862" />
        <circle cx="20" cy="62" r="2.2" fill="#FFFDF8" />
      </g>
      <g className="twinkle twinkle-late">
        <circle cx="34" cy="26" r="2.2" fill="#C9A862" />
        <circle cx="22" cy="46" r="2.2" fill="#FFFDF8" />
        <circle cx="40" cy="64" r="2.2" fill="#B3263A" />
        <circle cx="30" cy="56" r="2.2" fill="#B3263A" />
      </g>
    </svg>
  );
}
