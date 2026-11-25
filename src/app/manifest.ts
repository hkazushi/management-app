import type { MetadataRoute } from "next";

// スマホの「ホーム画面に追加」用。アプリのように全画面で開く。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ふたり手帖",
    short_name: "ふたり手帖",
    description: "2人で使う、予定・欲しいもの・お金の手帖",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F1E7",
    theme_color: "#14463A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
