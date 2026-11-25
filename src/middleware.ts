import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・画像・favicon・マニフェスト・カレンダーの外部公開（api/ical）・通知の受け口（sw.js）・毎朝の通知の送信（api/cron。合言葉で守る）を除く全ルートで実行（アイコンは public/ の画像なので拡張子で除外される）
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|api/ical|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
