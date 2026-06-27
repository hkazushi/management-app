"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  toggleTaskDone,
  setTaskStatus,
  setTaskPriority,
  setTaskDueDate,
} from "@/app/(app)/projects/[id]/actions";
import {
  PRIORITY_META,
  PRIORITY_OPTIONS,
  TASK_STATUS_META,
  TASK_STATUS_OPTIONS,
} from "@/lib/constants";
import { Icon } from "./Icon";
import type { TaskPriority, TaskStatus } from "@/types/database";

export type Item = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project_id: string;
  project_name: string;
  phase_name: string | null;
};
type Filter = "open" | "today" | "overdue" | "week" | "all";
type Group = "due" | "project" | "priority";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "未完了", value: "open" },
  { label: "今日", value: "today" },
  { label: "期限超過", value: "overdue" },
  { label: "7日以内", value: "week" },
  { label: "すべて", value: "all" },
];

const GROUPS: { label: string; value: Group }[] = [
  { label: "期限", value: "due" },
  { label: "案件", value: "project" },
  { label: "優先度", value: "priority" },
];

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, mid: 1, low: 2 };

function jstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(
    new Date(),
  );
}
function addDays(s: string, n: number): string {
  const d = new Date(s + "T00:00:00+09:00");
  d.setDate(d.getDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(d);
}

const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
  e.currentTarget.form?.requestSubmit();

function TaskRow({ t }: { t: Item }) {
  const done = t.status === "done";
  const today = jstToday();
  const overdue = !!t.due_date && t.due_date < today && !done;
  const isToday = t.due_date === today && !done;

  return (
    <div className="group flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5 transition hover:border-primary/30 hover:bg-primary/5">
      <form action={toggleTaskDone.bind(null, t.project_id, t.id, !done)}>
        <button
          type="submit"
          aria-label={done ? "未完了に戻す" : "完了にする"}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
            done
              ? "border-success bg-success text-white"
              : "border-muted/40 text-transparent hover:border-primary"
          }`}
        >
          <Icon name="check" size={13} />
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${done ? "text-faint line-through" : "text-ink"}`}
        >
          {t.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
          <Link
            href={`/projects/${t.project_id}`}
            className="rounded bg-black/[0.05] px-1.5 py-0.5 font-medium text-muted hover:text-primary"
          >
            {t.project_name}
          </Link>
          {t.phase_name && (
            <span className="text-faint">{t.phase_name}</span>
          )}
          <form action={setTaskDueDate.bind(null, t.project_id, t.id)}>
            <label
              className={`inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 transition hover:bg-black/[0.05] ${
                overdue
                  ? "font-semibold text-danger"
                  : isToday
                    ? "font-semibold text-warning"
                    : t.due_date
                      ? "text-muted"
                      : "text-faint"
              }`}
            >
              <Icon name="calendar" size={10} />
              <input
                key={t.due_date ?? "none"}
                type="date"
                name="due_date"
                defaultValue={t.due_date ?? ""}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="w-[7.5rem] cursor-pointer border-0 bg-transparent p-0 text-[11px] outline-none"
                aria-label="期限"
              />
              {overdue && <span>超過</span>}
              {isToday && <span>今日</span>}
              {!t.due_date && <span>期限未設定</span>}
            </label>
          </form>
        </div>
      </div>

      <form action={setTaskPriority.bind(null, t.project_id, t.id)}>
        <select
          key={t.priority}
          name="priority"
          defaultValue={t.priority}
          onChange={submitOnChange}
          className={`cursor-pointer rounded-md border-0 px-1.5 py-1 text-xs font-semibold ${PRIORITY_META[t.priority].badge}`}
          aria-label="優先度"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </form>

      <form action={setTaskStatus.bind(null, t.project_id, t.id)}>
        <select
          key={t.status}
          name="status"
          defaultValue={t.status}
          onChange={submitOnChange}
          className={`cursor-pointer rounded-md border-0 px-1.5 py-1 text-xs font-semibold ${TASK_STATUS_META[t.status].badge}`}
          aria-label="状態"
        >
          {TASK_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </form>
    </div>
  );
}

export function TasksView({
  items,
  projects,
}: {
  items: Item[];
  projects: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [group, setGroup] = useState<Group>("due");
  const [projectId, setProjectId] = useState<string>("");

  const today = jstToday();
  const in7 = addDays(today, 7);

  const visible = useMemo(() => {
    let list = items.slice();
    if (projectId) list = list.filter((t) => t.project_id === projectId);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(s) ||
          t.project_name.toLowerCase().includes(s),
      );
    }
    if (filter === "open") list = list.filter((t) => t.status !== "done");
    if (filter === "today")
      list = list.filter((t) => t.status !== "done" && t.due_date === today);
    if (filter === "overdue")
      list = list.filter(
        (t) => t.status !== "done" && t.due_date && t.due_date < today,
      );
    if (filter === "week")
      list = list.filter(
        (t) =>
          t.status !== "done" &&
          t.due_date &&
          t.due_date >= today &&
          t.due_date <= in7,
      );
    return list;
  }, [items, q, filter, projectId, today, in7]);

  const counts = useMemo(() => {
    const open = items.filter((t) => t.status !== "done");
    return {
      open: open.length,
      overdue: open.filter((t) => t.due_date && t.due_date < today).length,
      today: open.filter((t) => t.due_date === today).length,
      done: items.filter((t) => t.status === "done").length,
    };
  }, [items, today]);

  // グルーピング
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    const keyOf = (t: Item): string => {
      if (group === "project") return t.project_name;
      if (group === "priority") return PRIORITY_META[t.priority].label;
      // due
      if (!t.due_date) return "期限なし";
      if (t.status !== "done" && t.due_date < today) return "期限超過";
      if (t.due_date === today) return "今日";
      if (t.due_date <= in7) return "7日以内";
      return t.due_date.slice(0, 7) + "（以降）";
    };
    for (const t of visible) {
      const k = keyOf(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    const order = (k: string): number => {
      if (group !== "due") return 0;
      const idx = ["期限超過", "今日", "7日以内"].indexOf(k);
      if (idx >= 0) return idx;
      if (k === "期限なし") return 9999;
      return 100 + k.localeCompare("0", "ja");
    };
    return Array.from(map.entries())
      .map(([key, arr]) => {
        arr.sort((a, b) => {
          // due 昇順 → priority → title
          const ad = a.due_date ?? "9999-12-31";
          const bd = b.due_date ?? "9999-12-31";
          if (ad !== bd) return ad < bd ? -1 : 1;
          if (a.priority !== b.priority)
            return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          return a.title.localeCompare(b.title, "ja");
        });
        return { key, items: arr };
      })
      .sort((a, b) => order(a.key) - order(b.key) || a.key.localeCompare(b.key, "ja"));
  }, [visible, group, today, in7]);

  return (
    <div className="space-y-3">
      {/* サマリ */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-border bg-surface px-2 py-2">
          <p className="text-[11px] text-muted">未完了</p>
          <p className="text-lg font-bold tabular-nums text-ink">{counts.open}</p>
        </div>
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-2 py-2">
          <p className="text-[11px] text-danger">期限超過</p>
          <p className="text-lg font-bold tabular-nums text-danger">
            {counts.overdue}
          </p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-2 py-2">
          <p className="text-[11px] text-warning">今日</p>
          <p className="text-lg font-bold tabular-nums text-warning">
            {counts.today}
          </p>
        </div>
      </div>

      {/* 検索 */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" size={16} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="タスク名・案件名で絞り込み"
          className="input pl-9"
        />
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f.value
                ? "bg-primary text-white"
                : "border border-border text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* グルーピング＋案件絞り込み */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-faint">グループ</span>
        <div className="flex gap-1">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setGroup(g.value)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                group === g.value
                  ? "bg-ink text-bg"
                  : "border border-border text-muted hover:text-ink"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="ml-auto rounded-lg border border-border bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-primary"
          aria-label="案件で絞り込み"
        >
          <option value="">全案件</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-faint">{visible.length} 件</p>

      {/* グループ別の一覧 */}
      {groups.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">
          該当するタスクがありません。
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="space-y-1.5">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-muted">
                <span>{g.key}</span>
                <span className="text-faint">({g.items.length})</span>
              </h2>
              {g.items.map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
