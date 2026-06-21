"use client";

import { deleteResource } from "@/app/(app)/projects/[id]/actions";
import { Icon } from "./Icon";
import type { ResourceType } from "@/types/database";

type Resource = {
  id: string;
  type: ResourceType;
  label: string;
  url: string | null;
  account: string | null;
  note: string | null;
};

const typeIcon: Record<ResourceType, "link" | "user" | "tool"> = {
  link: "link",
  account: "user",
  tool: "tool",
};

export function ResourceItem({
  projectId,
  resource,
}: {
  projectId: string;
  resource: Resource;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-card">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon name={typeIcon[resource.type] ?? "link"} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        {resource.url ? (
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate font-medium text-primary hover:underline"
          >
            {resource.label}
          </a>
        ) : (
          <span className="truncate font-medium text-ink">{resource.label}</span>
        )}
        {resource.account && (
          <p className="truncate text-xs text-muted">{resource.account}</p>
        )}
        {resource.note && (
          <p className="text-xs text-muted">{resource.note}</p>
        )}
      </div>
      <form
        action={deleteResource.bind(null, projectId, resource.id)}
        onSubmit={(e) => {
          if (!confirm("このリソースを削除しますか？")) e.preventDefault();
        }}
      >
        <button type="submit" aria-label="削除" className="text-faint hover:text-danger">
          <Icon name="trash" size={15} />
        </button>
      </form>
    </div>
  );
}
