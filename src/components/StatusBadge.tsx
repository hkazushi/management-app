import { PROJECT_STATUS_META } from "@/lib/constants";
import type { ProjectStatus } from "@/types/database";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status] ?? {
    label: String(status),
    badge: "bg-muted/10 text-muted",
  };
  return <span className={`chip ${meta.badge}`}>{meta.label}</span>;
}
