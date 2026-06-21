"use client";

import { setPhaseStatus } from "@/app/(app)/projects/[id]/actions";
import { PHASE_STATUS_OPTIONS, PHASE_STATUS_META } from "@/lib/constants";
import type { PhaseStatus } from "@/types/database";

export function PhaseStatusSelect({
  projectId,
  phaseId,
  status,
}: {
  projectId: string;
  phaseId: string;
  status: PhaseStatus;
}) {
  return (
    <form action={setPhaseStatus.bind(null, projectId, phaseId)}>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs font-medium ${PHASE_STATUS_META[status].text}`}
        aria-label="フェーズ状態"
      >
        {PHASE_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {PHASE_STATUS_META[s].label}
          </option>
        ))}
      </select>
    </form>
  );
}
