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
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-bg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 -rotate-6 items-center justify-center rounded-lg border-2 border-ink bg-sun text-ink shadow-hard-sm">
              <span className="display text-[15px] leading-none">ふ</span>
            </span>
            <span className="display text-[17px] text-ink">ふたり手帖</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/settings"
              aria-label="設定"
              className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink bg-surface text-ink shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <Icon name="settings" size={17} />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                aria-label="ロックする"
                className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-ink bg-surface text-ink shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <Icon name="lock" size={17} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5">{children}</main>

      <AppNav />
    </div>
  );
}
