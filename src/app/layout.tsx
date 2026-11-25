import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Shippori_Mincho_B1, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";

// 見出しは明朝、本文は細身のゴシック、数字と英字はセリフ体。日本語の書体は大きいので先読みしない。
const display = Shippori_Mincho_B1({
  weight: ["600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  preload: false,
});
const body = Zen_Kaku_Gothic_New({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  preload: false,
});
const latin = Cormorant_Garamond({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ふたり手帖",
  description: "2人で使う、予定・欲しいもの・お金の手帖",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F1E7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable} ${latin.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
