import { fmtDateTime } from "@/lib/format";

// Claude Code の作業ログ1件（activity_log の action = 'session'）。
// detail には {title, done[], remaining[]} の JSON 文字列が入っている。
export type WorkLogRow = {
  id: string;
  project_id: string | null;
  detail: string | null;
  created_at: string;
};

export const WORK_LOG_COLUMNS = "id,project_id,detail,created_at";

type WorkLogDetail = { title: string; done: string[]; remaining: string[] };

function parseDetail(detail: string | null): WorkLogDetail {
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  try {
    const d = JSON.parse(detail ?? "") as Record<string, unknown>;
    return {
      title: typeof d.title === "string" ? d.title : "作業",
      done: strings(d.done),
      remaining: strings(d.remaining),
    };
  } catch {
    return { title: detail ?? "作業", done: [], remaining: [] };
  }
}

export function WorkLogCard({ log, projectName }: { log: WorkLogRow; projectName?: string }) {
  const d = parseDetail(log.detail);
  return (
    <div className="card p-4">
      <p className="font-semibold text-ink">{d.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {fmtDateTime(log.created_at)}
        {projectName ? `・${projectName}` : ""}
      </p>
      {d.done.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm leading-relaxed text-ink">
          {d.done.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
      {d.remaining.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted">残り</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm leading-relaxed text-muted">
            {d.remaining.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
