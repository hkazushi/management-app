"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

type IconName = "home" | "calendar" | "gift" | "coin";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "ホーム", icon: "home" },
  { href: "/calendar", label: "カレンダー", icon: "calendar" },
  { href: "/wishes", label: "欲しいもの", icon: "gift" },
  { href: "/money", label: "お金", icon: "coin" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// 画面下に浮かぶ深緑のタブバー。今いる場所は金色になる。
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between rounded-full border border-sun/50 bg-primary-deep px-2 py-1.5 shadow-[0_18px_36px_-14px_rgb(12_50_41/0.7)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                // 先に中身まで取っておく。押した瞬間に切り替わる
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-bold tracking-wider transition ${
                  active ? "bg-sun/15 text-sun" : "text-[#FAF4E4]/60 hover:text-[#FAF4E4]"
                }`}
              >
                <Icon name={item.icon} size={21} />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
