import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・画像・favicon・マニフェスト・カレンダーの外部公開（api/ical）を除く全ルートで実行（アイコンは public/ の画像なので拡張子で除外される）
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|api/ical|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
