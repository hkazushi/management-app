// 追加や保存がうまくいったとき、画面の下でミーアキャットとマヌルネコに一言しゃべらせる。
// 表示は src/components/Cheer.tsx（レイアウトに1つだけ置いてある）が受け取る。
export const CHEER_EVENT = "mascot-cheer";

export function cheer(text: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string>(CHEER_EVENT, { detail: text }));
}
