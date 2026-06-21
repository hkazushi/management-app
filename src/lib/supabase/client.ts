import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// ブラウザ（Client Component）用の Supabase クライアント。
// 公開しても安全な anon key のみを使う。RLS で本人のデータに限定される（spec §5.2）。
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
