import { PROJECT_STATUS_META } from "@/lib/constants";
import type { ProjectStatus } from "@/types/database";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status] ?? PROJECT_STATUS_META.active;
  return <span className={`chip ${meta.badge}`}>{meta.label}</span>;
}
