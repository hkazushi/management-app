import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { MeetingCard, MEETING_LIST_COLUMNS, type MeetingListItem } from "@/components/MeetingCard";

// 議事録の一覧。タイトル・要約・文字起こしを横断して検索できる。
export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  // PostgREST の or/ilike を壊す文字を除く
  const safe = query.replace(/[,()%*]/g, " ").trim();

  const supabase = await createClient();
  let mq = supabase.from("meetings").select(MEETING_LIST_COLUMNS);
  if (safe) {
    mq = mq.or(`title.ilike.%${safe}%,summary.ilike.%${safe}%,transcript.ilike.%${safe}%`);
  }
  const [mRes, pRes] = await Promise.all([
    mq.order("started_at", { ascending: false }).limit(100),
    supabase.from("projects").select("id,name"),
  ]);
  const meetings = (mRes.data as unknown as MeetingListItem[] | null) ?? [];
  const pName = new Map(
    ((pRes.data as unknown as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]),
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-ink">議事録</h1>
        <Link href="/record" className="btn-primary">
          <Icon name="mic" size={16} />
          録音
        </Link>
      </div>

      <form action="/meetings" className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" size={16} />
        </span>
        <input
          name="q"
          defaultValue={query}
          placeholder="話した内容で検索（例: ロゴ、見積もり）"
          className="input pl-9"
        />
      </form>

      {meetings.length === 0 ? (
        <p className="card p-8 text-center text-sm text-muted">
          {safe ? "該当する議事録がありません。" : "まだ議事録がありません。"}
        </p>
      ) : (
        <div className="space-y-2">
          {meetings.map((m) => (
            <MeetingCard
              key={m.id}
              meeting={m}
              projectName={m.project_id ? pName.get(m.project_id) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
