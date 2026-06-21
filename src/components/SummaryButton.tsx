"use client";

import { useActionState } from "react";
import {
  generateSummary,
  type SummaryState,
} from "@/app/(app)/projects/[id]/actions";
import { Icon } from "./Icon";

const initial: SummaryState = { error: "" };

export function SummaryButton({
  projectId,
  hasSummary,
}: {
  projectId: string;
  hasSummary: boolean;
}) {
  const [state, action, pending] = useActionState(
    generateSummary.bind(null, projectId),
    initial,
  );

  return (
    <div>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-surface px-3.5 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:opacity-60"
        >
          <Icon name="sparkles" size={15} filled={!pending} />
          {pending ? "生成中…" : hasSummary ? "サマリーを更新" : "AIサマリーを生成"}
        </button>
      </form>
      {state.error && <p className="mt-1.5 text-xs text-danger">{state.error}</p>}
    </div>
  );
}
