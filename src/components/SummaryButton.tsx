"use client";

import { useActionState } from "react";
import {
  generateSummary,
  type SummaryState,
} from "@/app/(app)/projects/[id]/actions";

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
          className="rounded-lg border border-primary/40 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {pending
            ? "生成中…"
            : hasSummary
              ? "🔄 サマリーを更新"
              : "✨ AIサマリーを生成"}
        </button>
      </form>
      {state.error && <p className="mt-1.5 text-xs text-danger">{state.error}</p>}
    </div>
  );
}
