"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  createQuickProject,
  setProjectStatus,
} from "@/app/(app)/projects/actions";
import { PROJECT_STATUS_META, PROJECT_STATUS_OPTIONS } from "@/lib/constants";
import { Icon } from "./Icon";
import type { ProjectStatus } from "@/types/database";

type Cat = { id: string; name: string; color: string };
type Proj = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  category_id: string | null;
  due_date: string | null;
};

const STATUS_TABS: { label: string; value: "" | ProjectStatus }[] = [
  { label: "作業中", value: "" },
  { label: "進行中", value: "active" },
  { label: "保留", value: "on_hold" },
  { label: "下書き", value: "draft" },
];

export function ProjectList({
  projects,
  categories,
}: {
  projects: Proj[];
  categories: Cat[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ProjectStatus>("");
  const [cat, setCat] = useState<string>("");
  const addRef = useRef<HTMLFormElement>(null);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const order: Record<string, number> = { active: 0, on_hold: 1, draft: 2 };
  const filtered = projects
    .filter((p) => (status ? p.status === status : true))
    .filter((p) => (cat ? p.category_id === cat : true))
    .filter((p) => {
      if (!q.trim()) return true;
      const s = (p.name + " " + (p.client ?? "")).toLowerCase();
      return s.includes(q.trim().toLowerCase());
    })
    .sort(
      (a, b) =>
        (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
        a.name.localeCompare(b.name, "ja"),
    );

  return (
    <div className="space-y-3">
      {/* クイック追加 */}
      <form
        ref={addRef}
        action={async (fd) => {
          await createQuickProject(fd);
          addRef.current?.reset();
        }}
        className="flex gap-2"
      >
        <input
          name="name"
          required
          placeholder="＋ 案件をすぐ追加（名前だけ）"
          className="input flex-1"
        />
        <button type="submit" className="btn-primary shrink-0">
          追加
        </button>
      </form>

      {/* 検索 */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="名前・クライアントで絞り込み"
          className="input pl-9"
        />
      </div>

      {/* ステータス＆カテゴリ絞り込み */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setStatus(t.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              status === t.value
                ? "bg-primary text-white"
                : "border border-white/12 text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-white/10" />
        <button
          onClick={() => setCat("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !cat ? "bg-ink/15 text-ink" : "border border-white/12 text-muted"
          }`}
        >
          全カテゴリ
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(cat === c.id ? "" : c.id)}
            className="rounded-full px-3 py-1 text-xs font-medium transition"
            style={
              cat === c.id
                ? { backgroundColor: c.color, color: "#0b0e18" }
                : { backgroundColor: `${c.color}22`, color: c.color }
            }
          >
            {c.name}
          </button>
        ))}
      </div>

      <p className="text-xs text-faint">{filtered.length} 件</p>

      {/* 一覧（コンパクト・スキャンしやすい） */}
      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          該当する案件がありません。
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-white/10">
          {filtered.map((p, i) => {
            const c = p.category_id ? catMap.get(p.category_id) : null;
            const isDraft = p.status === "draft";
            return (
              <li
                key={p.id}
                className={`flex items-center gap-3 bg-white/[0.03] px-3.5 py-3 transition hover:bg-white/[0.06] ${
                  i > 0 ? "border-t border-white/8" : ""
                }`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={
                    isDraft
                      ? { boxShadow: `inset 0 0 0 1.5px ${c?.color ?? "#6c7896"}` }
                      : { backgroundColor: c?.color ?? "rgb(245 124 52)" }
                  }
                />
                <Link
                  href={`/projects/${p.id}`}
                  className={`min-w-0 flex-1 ${isDraft ? "opacity-70" : ""}`}
                >
                  <p className="truncate text-sm font-medium text-ink">
                    {p.name}
                  </p>
                  {p.client && (
                    <p className="truncate text-xs text-muted">{p.client}</p>
                  )}
                </Link>
                <form action={setProjectStatus.bind(null, p.id)}>
                  <select
                    key={p.status}
                    name="status"
                    defaultValue={p.status}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    aria-label="ステータス変更"
                    className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold ${PROJECT_STATUS_META[p.status].badge}`}
                  >
                    {PROJECT_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {PROJECT_STATUS_META[s].label}
                      </option>
                    ))}
                  </select>
                </form>
                <Link href={`/projects/${p.id}`} className="shrink-0 text-faint">
                  <Icon name="back" size={16} className="rotate-180" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
