// 予定や人に付ける色。深みのある色でそろえる（画面の配色は globals.css）。
export const PALETTE = [
  { value: "#14463A", name: "深緑" },
  { value: "#1E2F52", name: "紺" },
  { value: "#C9A862", name: "金" },
  { value: "#9B2C3A", name: "ワイン" },
  { value: "#C4704F", name: "テラコッタ" },
  { value: "#8FA98C", name: "セージ" },
  { value: "#7C97B5", name: "くすみ青" },
  { value: "#6E4A6E", name: "プラム" },
] as const;

export const DEFAULT_COLOR = "#C9A862";

// 色面の上に置く文字の色（暗い色には生成り、明るい色には黒）
export function onColor(hex: string | null | undefined): string {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return "#1B2420";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1B2420" : "#FAF4E4";
}

export const isColor = (s: string | null | undefined): s is string => !!s && /^#[0-9A-Fa-f]{6}$/.test(s);
