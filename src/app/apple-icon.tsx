import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// ホーム画面のアイコン：深緑の地に、ミーアキャットの顔と金の輪。
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#14463A" }}>
        <svg width="150" height="150" viewBox="-40 -40 80 80">
          <circle cx="0" cy="0" r="37" fill="none" stroke="#C9A862" strokeWidth="1.5" />
          <ellipse cx="-21" cy="-9" rx="6" ry="5" fill="#3A2B22" />
          <ellipse cx="21" cy="-9" rx="6" ry="5" fill="#3A2B22" />
          <path d="M-24 -4c0-14 10-22 24-22s24 8 24 22c0 13-9 25-24 27C-15 21-24 9-24-4Z" fill="#C9A57A" />
          <path d="M-11 6c0-8 5-12 11-12s11 4 11 12c0 8-5 14-11 15C-6 20-11 14-11 6Z" fill="#F0E2C6" />
          <ellipse cx="-11" cy="-3" rx="7.5" ry="6" fill="#3A2B22" />
          <ellipse cx="11" cy="-3" rx="7.5" ry="6" fill="#3A2B22" />
          <circle cx="-10.5" cy="-3" r="3" fill="#120D0A" />
          <circle cx="10.5" cy="-3" r="3" fill="#120D0A" />
          <circle cx="-9.4" cy="-4.2" r="1" fill="#FFFDF8" />
          <circle cx="11.6" cy="-4.2" r="1" fill="#FFFDF8" />
          <ellipse cx="0" cy="9.5" rx="3.6" ry="3" fill="#3A2B22" />
        </svg>
      </div>
    ),
    size,
  );
}
