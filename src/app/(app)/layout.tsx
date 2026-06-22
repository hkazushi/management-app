import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { Icon } from "@/components/Icon";
import { logout } from "./actions";

// 認証済みエリアの共通シェル。未ログインの遮断は middleware が担うため、
// ここでは getUser を呼ばず（往復を減らして高速化）、レイアウトのみ提供する。
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-bg">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <Icon name="flag" size={16} filled />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-ink">
              案件・タスク管理
            </span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-white/5 hover:text-danger"
            >
              <Icon name="lock" size={15} />
              ロック
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5">{children}</main>

      <AppNav />
    </div>
  );
}
