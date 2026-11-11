import Link from "next/link";
import { fmtDateTime, fmtDuration } from "@/lib/format";

export type MeetingListItem = {
  id: string;
  project_id: string | null;
  title: string;
  status: string;
  started_at: string;
  duration_sec: number | null;
  summary: string | null;
};

export const MEETING_LIST_COLUMNS = "id,project_id,title,status,started_at,duration_sec,summary";

export function MeetingCard({
  meeting,
  projectName,
}: {
  meeting: MeetingListItem;
  projectName?: string;
}) {
  const unfinished = meeting.status !== "done";
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="card block p-4 transition hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold text-ink">{meeting.title}</p>
        {unfinished && <span className="chip shrink-0 bg-warning/15 text-warning">未作成</span>}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {fmtDateTime(meeting.started_at)}
        {meeting.duration_sec ? `・${fmtDuration(meeting.duration_sec)}` : ""}
        {projectName ? `・${projectName}` : ""}
      </p>
      {meeting.summary && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">{meeting.summary}</p>
      )}
    </Link>
  );
}
