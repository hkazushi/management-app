import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { Icon } from "@/components/Icon";
import { Cheer } from "@/components/Cheer";
import { MascotScene } from "@/components/MascotScene";
import { Meerkat } from "@/components/Meerkat";
import { logout } from "./actions";

// 認証済みエリアの共通シェル。未ログインの遮断は middleware が担うため、
// ここでは getUser を呼ばず（往復を減らして高速化）、レイアウトのみ提供する。
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh overflow-x-clip pb-28">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Meerkat variant="peek" className="h-8 w-auto" />
            <span className="leading-none">
              <span className="display block text-[18px] text-ink">ふたり手帖</span>
              <span className="mt-0.5 block font-display text-[9px] font-bold uppercase tracking-[0.3em] text-sun">Futari Techo</span>
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link
              href="/settings"
              aria-label="設定"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink active:scale-95"
            >
              <Icon name="settings" size={17} />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                aria-label="ロックする"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink active:scale-95"
              >
                <Icon name="lock" size={17} />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-5">
        {children}
        <MascotScene />
      </main>

      <Cheer />

      <AppNav />
    </div>
  );
}
