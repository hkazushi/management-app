import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { WhoChip, WhoSelect } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { yen } from "@/lib/format";
import { getMembers } from "@/lib/members";
import { addWish, deleteWish, toggleWish, updateWish } from "./actions";
import type { Member, Wish } from "@/types/database";

// リンクの行き先が分かるように、サイト名（ホスト）だけ出す
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "リンク";
  }
}

// カードごとに地の色を少しずつ変える
const TONES = ["bg-pink/60", "bg-mint/60", "bg-sky/60", "bg-lilac/60", "bg-sun/25"];

function WishFields({ members, wish, compact = false }: { members: Member[]; wish?: Wish; compact?: boolean }) {
  const more = (
    <>
      <input name="price" defaultValue={wish?.price ?? ""} placeholder="だいたいの値段" inputMode="numeric" className="input" />
      <WhoSelect members={members} defaultValue={wish?.member_id} />
      <input name="memo" defaultValue={wish?.memo ?? ""} placeholder="メモ（色・サイズなど）" className="input" />
    </>
  );
  return (
    <>
      <input name="title" required defaultValue={wish?.title} placeholder="欲しいもの" className="input" />
      <input name="url" defaultValue={wish?.url ?? ""} placeholder="リンクを貼る（商品ページのURL）" inputMode="url" autoCapitalize="none" className="input" />
      {compact ? (
        <details>
          <summary className="cursor-pointer text-xs font-bold text-muted">値段・誰の・メモも入れる</summary>
          <div className="mt-2 space-y-2">{more}</div>
        </details>
      ) : (
        more
      )}
    </>
  );
}

// 欲しいものリスト：手で足す。リンクも一緒に載せられる。買ったらチェック。
export default async function WishesPage() {
  const supabase = await createClient();
  const [members, wRes] = await Promise.all([
    getMembers(supabase),
    supabase
      .from("wishes")
      .select("id,title,url,price,memo,member_id,done,done_at,created_at")
      .order("created_at", { ascending: false }),
  ]);
  const wishes = (wRes.data as unknown as Wish[] | null) ?? [];
  const open = wishes.filter((w) => !w.done);
  const bought = wishes.filter((w) => w.done);
  const total = open.reduce((n, w) => n + (w.price ?? 0), 0);

  return (
    <section className="space-y-5">
      <PageTitle title="欲しいもの" label="WISH LIST" tone="bg-wine text-[#FAF4E4]" mascot="manul">
        {total > 0 && (
          <p className="shrink-0 text-right text-[11px] font-bold leading-tight text-[#FAF4E4]/80">
            ぜんぶで
            <span className="display block text-2xl text-sun">{yen(total)}</span>
          </p>
        )}
      </PageTitle>

      {wRes.error && (
        <p className="card bg-danger p-4 text-sm font-bold text-white">
          データベースの準備が終わっていません。Supabase の SQL Editor で supabase/migrations/0008_home.sql を実行してください。
        </p>
      )}

      <ActionForm action={addWish} className="card scroll-mt-20 space-y-2 p-4">
        <span id="add" />
        <WishFields members={members} compact />
        <button type="submit" className="btn-primary w-full !py-3">
          <Icon name="plus" size={16} />
          リストに追加
        </button>
      </ActionForm>

      <div className="space-y-3">
        <SectionTitle tone="bg-pink">まだ買ってない（{open.length}）</SectionTitle>
        {open.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-sm font-bold text-muted">
            欲しいものを上から足してみてください
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {open.map((w, i) => (
              <li
                key={w.id}
                className={`rounded-2xl border border-line p-3 shadow-hard ${TONES[i % TONES.length]}`}
              >
                <div className="flex items-start gap-2">
                  <form action={toggleWish.bind(null, w.id, true)}>
                    <button
                      type="submit"
                      aria-label="買った"
                      title="買ったらタップ"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/30 bg-surface text-transparent transition hover:text-ink/40"
                    >
                      <Icon name="check" size={16} />
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-snug text-ink">{w.title}</p>
                    {w.memo && <p className="mt-0.5 text-xs font-bold text-ink/70">{w.memo}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <WhoChip members={members} memberId={w.member_id} />
                      {w.price !== null && <span className="display text-sm">{yen(w.price)}</span>}
                    </div>
                  </div>
                </div>
                {w.url && (
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-[#FAF4E4]"
                  >
                    <Icon name="link" size={14} />
                    <span className="truncate">{hostOf(w.url)} を見る</span>
                  </a>
                )}
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-bold text-ink/60">直す・消す</summary>
                  <ActionForm action={updateWish.bind(null, w.id)} keep className="mt-2 space-y-2">
                    <WishFields members={members} wish={w} />
                    <button type="submit" className="btn-ghost w-full">
                      保存
                    </button>
                  </ActionForm>
                  <ActionForm action={deleteWish.bind(null, w.id)} confirmText={`「${w.title}」を消しますか？`} className="mt-2">
                    <button type="submit" className="w-full rounded-xl py-1.5 text-xs font-bold text-danger">
                      このカードを消す
                    </button>
                  </ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      {bought.length > 0 && (
        <details className="space-y-2">
          <summary className="display cursor-pointer text-sm text-muted">買ったもの（{bought.length}）</summary>
          <ul className="mt-2 space-y-2">
            {bought.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
                <form action={toggleWish.bind(null, w.id, false)}>
                  <button
                    type="submit"
                    aria-label="まだ買ってないに戻す"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sun"
                  >
                    <Icon name="check" size={16} />
                  </button>
                </form>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-muted line-through">{w.title}</span>
                {w.price !== null && <span className="text-xs font-bold text-muted">{yen(w.price)}</span>}
                <ActionForm action={deleteWish.bind(null, w.id)} confirmText={`「${w.title}」を消しますか？`}>
                  <button type="submit" aria-label="消す" className="p-1 text-faint hover:text-danger">
                    <Icon name="trash" size={15} />
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
