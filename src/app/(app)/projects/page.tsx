import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "./actions";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryChip } from "@/components/CategoryChip";
import type { ProjectStatus } from "@/types/database";

type CatLite = { id: string; name: string; color: string };
type ProjLite = {
  id: string;
  name: string;
  client: string | null;
  status: ProjectStatus;
  due_date: string | null;
  category_id: string | null;
};

// 案件一覧（spec §3.1 / §3.9）。
// 既定は作業中（draft/active/on_hold）。done/archived は /archive へ。draft は薄表示。
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const { status, category } = await searchParams;
  await ensureDefaultCategories();
  const supabase = await createClient();

  const { data: categoriesRaw } = await supabase
    .from("categories")
    .select("id,name,color")
    .order("created_at");
  const categories = (categoriesRaw as CatLite[] | null) ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  let q = supabase
    .from("projects")
    .select("id,name,client,status,due_date,category_id");
  q = status
    ? q.eq("status", status as ProjectStatus)
    : q.in("status", ACTIVE_STATUSES);
  if (category) q = q.eq("category_id", category);
  const { data: projectsRaw } = await q.order("created_at", {
    ascending: false,
  });
  const projects = (projectsRaw as ProjLite[] | null) ?? [];

  // フィルタチップの href を作る（指定パラメータを上書き、他方は保持）
  const hrefWith = (next: { status?: string; category?: string }) => {
    const p = new URLSearchParams();
    const s = next.status !== undefined ? next.status : status;
    const c = next.category !== undefined ? next.category : category;
    if (s) p.set("status", s);
    if (c) p.set("category", c);
    const qs = p.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };

  const statusChips: { label: string; value: string }[] = [
    { label: "作業中", value: "" },
    { label: "進行中", value: "active" },
    { label: "保留", value: "on_hold" },
    { label: "下書き", value: "draft" },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">案件</h1>
        <Link
          href="/projects/new"
          className="rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-white"
        >
          ＋新規
        </Link>
      </div>

      {/* ステータス絞り込み */}
      <div className="flex flex-wrap gap-2">
        {statusChips.map((chip) => {
          const active = (status ?? "") === chip.value;
          return (
            <Link
              key={chip.label}
              href={hrefWith({ status: chip.value })}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                active
                  ? "bg-ink text-bg"
                  : "border border-border text-muted hover:text-ink"
              }`}
            >
              {chip.label}
            </Link>
          );
        })}
        <Link
          href="/archive"
          className="rounded-full border border-border px-3 py-1 text-sm font-medium text-muted hover:text-ink"
        >
          アーカイブ →
        </Link>
      </div>

      {/* カテゴリ絞り込み */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={hrefWith({ category: "" })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !category
                ? "bg-ink text-bg"
                : "border border-border text-muted hover:text-ink"
            }`}
          >
            全カテゴリ
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={hrefWith({ category: c.id })}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={
                category === c.id
                  ? { backgroundColor: c.color, color: "#fff" }
                  : { backgroundColor: `${c.color}1f`, color: c.color }
              }
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* 一覧 */}
      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          該当する案件がありません。「＋新規」から追加できます。
        </div>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => {
            const cat = p.category_id ? catMap.get(p.category_id) : null;
            const isDraft = p.status === "draft";
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`block rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/50 ${
                    isDraft ? "opacity-55" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-ink">{p.name}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.client && (
                    <p className="mt-0.5 text-sm text-muted">{p.client}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {cat && <CategoryChip name={cat.name} color={cat.color} />}
                    {p.due_date && (
                      <span className="text-xs text-muted">
                        期限 {p.due_date}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
