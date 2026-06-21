import { createBrowserClient } from "@supabase/ssr";

// ブラウザ（Client Component）用の Supabase クライアント。
// 公開しても安全な anon/publishable key のみを使う。RLS で本人のデータに限定される（spec §5.2）。
// 型は手書き Database を generics に渡すと supabase-js の推論が never に落ちるため、
// クライアントは緩い型のまま使い、各クエリの結果は呼び出し側で型キャストする。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
