"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

type IconName = "today" | "projects" | "search" | "archive";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/projects", label: "案件", icon: "projects" },
  { href: "/search", label: "検索", icon: "search" },
  { href: "/archive", label: "アーカイブ", icon: "archive" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// モバイル前提の下部タブバー（spec §4）。
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-bg">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition ${
                  active ? "text-primary" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-9 w-12 items-center justify-center rounded-full transition ${
                    active ? "bg-primary/15" : ""
                  }`}
                >
                  <Icon name={item.icon} size={21} filled={active} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
