import { createClient } from "@/lib/supabase/server";

// Today（ホーム）。本実装はステップ6（全案件横断の今日やること＋放置アラート）。
// ここでは「セッション→RLS→データ取得」が通っているかを件数で確認する足場のみ。
export default async function TodayPage() {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">Today</h1>
        <p className="mt-1 text-sm text-muted">今日やること（ステップ6で実装）</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        {error ? (
          <p className="text-sm text-danger">
            データ取得エラー: {error.message}
          </p>
        ) : (
          <p className="text-sm text-muted">
            登録案件:{" "}
            <span className="text-2xl font-bold text-primary">
              {count ?? 0}
            </span>{" "}
            件
            <span className="ml-2 text-xs text-success">
              ✓ 認証・RLS 経由のDB接続 OK
            </span>
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">
        期限順の「今日やること」と放置案件アラートはステップ6で表示します。
      </div>
    </section>
  );
}
