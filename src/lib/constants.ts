import type { ProjectStatus, TaskPriority } from "@/types/database";

// 案件ステータスの表示メタ（spec §3.1）
export const PROJECT_STATUS_META: Record<
  ProjectStatus,
  { label: string; badge: string }
> = {
  draft: { label: "下書き", badge: "bg-muted/10 text-muted" },
  active: { label: "進行中", badge: "bg-primary/10 text-primary" },
  on_hold: { label: "保留", badge: "bg-warning/15 text-warning" },
  done: { label: "完了", badge: "bg-success/10 text-success" },
  archived: { label: "アーカイブ", badge: "bg-muted/10 text-muted" },
};

// 案件作成/編集フォームで選べるステータス
export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "draft",
  "active",
  "on_hold",
  "done",
  "archived",
];

// 一覧（/projects）で既定表示する「作業中」ステータス。done/archived は /archive へ。
export const ACTIVE_STATUSES: ProjectStatus[] = ["draft", "active", "on_hold"];

// 初回に自動生成するカテゴリ（warm/vibrant・spec §3.1 の例）
export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: "クライアント案件", color: "#FF8C42" },
  { name: "補助金", color: "#F0A929" },
  { name: "自社開発", color: "#E94E77" },
];

// タスク優先度（ステップ4で使用）
export const PRIORITY_META: Record<TaskPriority, { label: string }> = {
  low: { label: "低" },
  mid: { label: "中" },
  high: { label: "高" },
};
