import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・画像・favicon・ホーム画面用のアイコンとマニフェスト・カレンダーの外部公開（api/ical）を除く全ルートで実行
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|manifest.webmanifest|api/ical|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
