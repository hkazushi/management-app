import { createClient } from "@/lib/supabase/server";
import { todayJST } from "@/lib/format";
import { ActionRow } from "@/components/ActionRow";
import { AddActionForm } from "@/components/AddActionForm";
import type { ActionItem } from "@/types/database";

// 宿題の一覧。自分の分と相手待ちを分け、期限の近い順に並べる。
export default async function ActionsPage() {
  const supabase = await createClient();
  const today = todayJST();
  const cols = "id,meeting_id,project_id,owner,content,due_date,done";

  const [openRes, doneRes, pRes] = await Promise.all([
    supabase
      .from("action_items")
      .select(cols)
      .eq("done", false)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("action_items")
      .select(cols)
      .eq("done", true)
      .order("done_at", { ascending: false })
      .limit(20),
    supabase.from("projects").select("id,name"),
  ]);
  const open = (openRes.data as unknown as ActionItem[] | null) ?? [];
  const finished = (doneRes.data as unknown as ActionItem[] | null) ?? [];
  const pName = new Map(
    ((pRes.data as unknown as { id: string; name: string }[] | null) ?? []).map((p) => [p.id, p.name]),
  );
  const mine = open.filter((a) => a.owner === "自分");
  const others = open.filter((a) => a.owner !== "自分");

  const rows = (items: ActionItem[]) =>
    items.map((a) => (
      <ActionRow
        key={a.id}
        item={a}
        today={today}
        context={a.project_id ? pName.get(a.project_id) : undefined}
        meetingHref={a.meeting_id ? `/meetings/${a.meeting_id}` : undefined}
      />
    ));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">宿題</h1>

      <AddActionForm meetingId={null} projectId={null} />

      <div className="space-y-2">
        <h2 className="font-semibold text-ink">自分の宿題（{mine.length}）</h2>
        {mine.length === 0 ? (
          <p className="card p-4 text-sm text-muted">未完了の宿題はありません。</p>
        ) : (
          <div className="space-y-1.5">{rows(mine)}</div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold text-ink">相手の対応待ち（{others.length}）</h2>
        {others.length === 0 ? (
          <p className="card p-4 text-sm text-muted">相手待ちの宿題はありません。</p>
        ) : (
          <div className="space-y-1.5">{rows(others)}</div>
        )}
      </div>

      {finished.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-muted">
            最近完了したもの（{finished.length}）
          </summary>
          <div className="mt-2 space-y-1.5">{rows(finished)}</div>
        </details>
      )}
    </section>
  );
}
