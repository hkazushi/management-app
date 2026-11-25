"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

type IconName = "home" | "calendar" | "gift" | "coin";
// タブごとに色を変える（今いる場所が色で分かる）
const items: { href: string; label: string; icon: IconName; color: string }[] = [
  { href: "/", label: "ホーム", icon: "home", color: "bg-primary text-white" },
  { href: "/calendar", label: "カレンダー", icon: "calendar", color: "bg-accent text-white" },
  { href: "/wishes", label: "欲しいもの", icon: "gift", color: "bg-pink text-ink" },
  { href: "/money", label: "お金", icon: "coin", color: "bg-mint text-ink" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// 画面下に浮かぶ黒いタブバー
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1 rounded-[22px] border-2 border-ink bg-ink p-1.5 shadow-[4px_4px_0_rgb(var(--primary))]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-black transition ${
                  active ? item.color : "text-[#FFF4E0]/70 hover:text-[#FFF4E0]"
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
