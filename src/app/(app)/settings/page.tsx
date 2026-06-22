import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { disconnectGoogle } from "./actions";
import { Icon } from "@/components/Icon";

const ERR: Record<string, string> = {
  noconfig: "Google OAuth キーが未設定です（クライアントID/シークレットの登録が必要）。",
  denied: "連携がキャンセルされました。",
  token: "トークンの取得に失敗しました。もう一度お試しください。",
  server: "サーバー設定エラー。",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;

  type Conn = { google_email: string | null; expiry: string | null };
  const supabase = await createClient();
  let conn: Conn | null = null;
  try {
    const { data } = await supabase
      .from("google_connections")
      .select("google_email,expiry")
      .maybeSingle();
    conn = (data as unknown as Conn | null) ?? null;
  } catch {
    conn = null;
  }

  return (
    <section className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <Icon name="back" size={15} />
        ホームへ
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-ink">設定・連携</h1>

      {connected && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Google カレンダーと連携しました。
        </p>
      )}
      {error && ERR[error] && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {ERR[error]}
        </p>
      )}

      {/* Google カレンダー連携 */}
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name="calendar" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-ink">Google カレンダー</h2>
            {conn?.google_email ? (
              <p className="mt-0.5 text-sm text-success">
                連携済み：{conn.google_email}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted">
                未接続。連携すると、案件・タスクの期限をカレンダーに同期できます。
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          {conn?.google_email ? (
            <>
              <Link href="/api/google/connect" className="btn-ghost">
                別アカウントで再連携
              </Link>
              <form action={disconnectGoogle}>
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
                >
                  連携を解除
                </button>
              </form>
            </>
          ) : (
            <Link href="/api/google/connect" className="btn-primary">
              <Icon name="link" size={15} />
              Google と連携
            </Link>
          )}
        </div>
      </div>

      <p className="text-xs text-faint">
        ※ 連携ボタンを押すと Google のアカウント選択・同意画面に進みます。アカウントごと（ログインPINごと）に別の Google を繋げられます。
      </p>
    </section>
  );
}
