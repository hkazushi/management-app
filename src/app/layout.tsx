import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "案件・タスク管理",
  description: "複数のクライアント案件をフェーズで可視化して一元管理する個人用アプリ",
};

// Today ビューはモバイル前提（spec §4）。端末幅に追従させる。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
