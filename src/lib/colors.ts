// 予定や人に付ける色。画面の配色（globals.css）と同じ原色を使う。
export const PALETTE = [
  { value: "#FF4D2E", name: "トマト" },
  { value: "#2B4BFF", name: "コバルト" },
  { value: "#FFC83D", name: "からし" },
  { value: "#19C39A", name: "ミント" },
  { value: "#FF8FC7", name: "ピンク" },
  { value: "#B69CFF", name: "ライラック" },
  { value: "#78C8FF", name: "そら" },
  { value: "#14120F", name: "くろ" },
] as const;

export const DEFAULT_COLOR = "#FFC83D";

// 色面の上に置く文字の色（暗い色には白、明るい色には黒）
export function onColor(hex: string | null | undefined): string {
  const h = (hex ?? "").replace("#", "");
  if (h.length !== 6) return "#14120F";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#14120F" : "#FFFFFF";
}

export const isColor = (s: string | null | undefined): s is string => !!s && /^#[0-9A-Fa-f]{6}$/.test(s);
