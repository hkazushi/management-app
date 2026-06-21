"use client";

import { deleteResource } from "@/app/(app)/projects/[id]/actions";
import { RESOURCE_TYPE_META } from "@/lib/constants";
import type { ResourceType } from "@/types/database";

type Resource = {
  id: string;
  type: ResourceType;
  label: string;
  url: string | null;
  account: string | null;
  note: string | null;
};

export function ResourceItem({
  projectId,
  resource,
}: {
  projectId: string;
  resource: Resource;
}) {
  const meta = RESOURCE_TYPE_META[resource.type] ?? RESOURCE_TYPE_META.link;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2">
      <span className="text-base leading-6">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
        </div>
        {resource.account && (
          <p className="truncate text-xs text-muted">👤 {resource.account}</p>
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
        <button type="submit" aria-label="削除" className="text-muted hover:text-danger">
          ✕
        </button>
      </form>
    </div>
  );
}
