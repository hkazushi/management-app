import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { logout } from "./actions";

// 認証済みエリアの共通シェル。未ログインは /login へ（middleware と二重で守る）。
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <span className="text-base font-bold text-ink">案件・タスク管理</span>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg px-2 py-1 text-xs font-medium text-muted hover:text-danger"
            >
              ロック
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-4">{children}</div>

      <AppNav />
    </div>
  );
}
