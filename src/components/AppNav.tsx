"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

type IconName =
  | "today"
  | "projects"
  | "check"
  | "calendar"
  | "search"
  | "archive";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/projects", label: "案件", icon: "projects" },
  { href: "/tasks", label: "タスク", icon: "check" },
  { href: "/calendar", label: "カレンダー", icon: "calendar" },
  { href: "/search", label: "検索", icon: "search" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

// モバイル前提の下部タブバー（spec §4）。
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active ? "text-primary" : "text-muted hover:text-ink"
                }`}
              >
                <span
                  className={`flex h-8 w-10 items-center justify-center rounded-full transition ${
                    active ? "bg-primary/15" : ""
                  }`}
                >
                  <Icon name={item.icon} size={20} filled={active} />
                </span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
