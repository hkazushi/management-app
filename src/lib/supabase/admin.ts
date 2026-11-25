import { createClient } from "@supabase/supabase-js";

// サービスキーで読む（RLS を通らない）。毎朝の通知の送信だけが使う。
// 本人の行に絞る条件は、呼ぶ側が必ず自分で付けること。
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY がありません");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
