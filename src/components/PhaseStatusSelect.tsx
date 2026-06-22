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
        key={status}
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`cursor-pointer rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-xs font-semibold ${PHASE_STATUS_META[status].text}`}
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
