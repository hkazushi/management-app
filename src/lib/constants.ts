import type {
  ProjectStatus,
  PhaseStatus,
  TaskStatus,
  TaskPriority,
  ResourceType,
} from "@/types/database";

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

// 案件作成時に自動生成するデフォルトフェーズ（spec §3.2）
export const DEFAULT_PHASES: string[] = [
  "ヒアリング",
  "設計",
  "デザイン",
  "実装",
  "テスト",
  "公開",
  "保守",
];

// フェーズ状態（spec §3.2）
export const PHASE_STATUS_META: Record<
  PhaseStatus,
  { label: string; dot: string; text: string }
> = {
  not_started: { label: "未着手", dot: "bg-muted/40", text: "text-muted" },
  in_progress: { label: "進行中", dot: "bg-primary", text: "text-primary" },
  done: { label: "完了", dot: "bg-success", text: "text-success" },
};
export const PHASE_STATUS_OPTIONS: PhaseStatus[] = [
  "not_started",
  "in_progress",
  "done",
];

// タスク状態（spec §3.3）
export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; badge: string }
> = {
  todo: { label: "未着手", badge: "bg-muted/10 text-muted" },
  doing: { label: "作業中", badge: "bg-primary/10 text-primary" },
  done: { label: "完了", badge: "bg-success/10 text-success" },
};
export const TASK_STATUS_OPTIONS: TaskStatus[] = ["todo", "doing", "done"];

// タスク優先度（spec §3.3）
export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; badge: string }
> = {
  low: { label: "低", badge: "bg-muted/10 text-muted" },
  mid: { label: "中", badge: "bg-warning/15 text-warning" },
  high: { label: "高", badge: "bg-danger/10 text-danger" },
};
export const PRIORITY_OPTIONS: TaskPriority[] = ["low", "mid", "high"];

// リソース種別（spec §3.5）。パスワード本体は保存しない。
export const RESOURCE_TYPE_META: Record<
  ResourceType,
  { label: string; icon: string }
> = {
  link: { label: "リンク", icon: "🔗" },
  account: { label: "アカウント", icon: "👤" },
  tool: { label: "ツール", icon: "🛠" },
};
export const RESOURCE_TYPE_OPTIONS: ResourceType[] = ["link", "account", "tool"];
