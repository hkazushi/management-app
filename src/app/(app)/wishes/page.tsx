import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { WhoChip, WhoSelect } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { Manul } from "@/components/Manul";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { yen } from "@/lib/format";
import { getMembers, whoOf } from "@/lib/members";
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
// カードの地色は「誰の」で決める（その人の色を薄くのせる。ふたりのものは金）
const tint = (color: string) => ({
  backgroundColor: `color-mix(in srgb, ${color} 15%, #FBF7EE)`,
  borderColor: `color-mix(in srgb, ${color} 40%, #FBF7EE)`,
});

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
const SORTS = [
  { key: "", label: "新しい順" },
  { key: "cheap", label: "安い順" },
  { key: "high", label: "高い順" },
] as const;

// ?who=（人）で絞り込み、?sort=（並び）で並べ替える
export default async function WishesPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const [members, wRes] = await Promise.all([
    getMembers(supabase),
    supabase
      .from("wishes")
      .select("id,title,url,image_url,price,memo,member_id,done,done_at,created_at")
      .order("created_at", { ascending: false }),
  ]);
  const wishes = (wRes.data as unknown as Wish[] | null) ?? [];
  const allOpen = wishes.filter((w) => !w.done);
  const bought = wishes.filter((w) => w.done);

  // 絞り込みの条件。知らない値は「ぜんぶ」として扱う
  const who = sp.who === "shared" || members.some((m) => m.user_id === sp.who) ? (sp.who as string) : "";
  const sort = SORTS.some((x) => x.key === sp.sort) ? (sp.sort as string) : "";
  const filtered = allOpen.filter((w) => {
    if (who === "shared" ? w.member_id !== null : who && w.member_id !== who) return false;
    return true;
  });
  // 値段で並べるとき、値段の無いものは最後に回す
  const open = sort
    ? [...filtered].sort((a, b) => {
        if (a.price === null || b.price === null) return a.price === null ? (b.price === null ? 0 : 1) : -1;
        return sort === "cheap" ? a.price - b.price : b.price - a.price;
      })
    : filtered;
  const total = open.reduce((n, w) => n + (w.price ?? 0), 0);
  const filtering = !!who;

  // いまの条件を保ったまま、1つだけ変えたリンクを作る
  const href = (next: { who?: string; sort?: string }) => {
    const q = { who, sort, ...next };
    const qs = Object.entries(q)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return qs ? `/wishes?${qs}` : "/wishes";
  };
  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
      active ? "border-primary bg-primary text-[#FAF4E4]" : "border-line bg-surface text-muted"
    }`;

  return (
    <section className="stagger space-y-5">
      <PageTitle title="欲しいもの" label="WISH LIST" tone="bg-wine text-[#FAF4E4]" mascot="manul">
        {total > 0 && (
          <p className="shrink-0 text-right text-[11px] font-bold leading-tight text-[#FAF4E4]/80">
            {filtering ? "絞り込み中の合計" : "ぜんぶで"}
            <span className="display block text-2xl text-sun">{yen(total)}</span>
          </p>
        )}
      </PageTitle>

      {wRes.error && (
        <p className="card bg-danger p-4 text-sm font-bold text-white">
          データベースの準備が終わっていません。Supabase の SQL Editor で supabase/migrations/0008_home.sql を実行してください。
        </p>
      )}

      <ActionForm action={addWish} cheer="リストに入れました" className="card scroll-mt-20 space-y-2 p-4">
        <span id="add" />
        <WishFields members={members} compact />
        <button type="submit" className="btn-primary w-full !py-3">
          <Icon name="plus" size={16} />
          リストに追加
        </button>
      </ActionForm>

      <div className="space-y-3">
        <SectionTitle tone="bg-pink">
          まだ買ってない（{filtering ? `${open.length}/${allOpen.length}` : open.length}）
        </SectionTitle>

        {/* 絞り込みと並べ替え（横にスクロールできる） */}
        {allOpen.length > 0 && (
          <div className="space-y-2">
            <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="shrink-0 self-center text-[11px] font-bold text-muted">人</span>
              {[
                { value: "", label: "ぜんぶ", color: null as string | null },
                { value: "shared", label: "ふたり", color: "#C9A862" },
                ...members.map((m) => ({ value: m.user_id, label: m.name, color: m.color as string | null })),
              ].map((o) => (
                <Link key={o.value} href={href({ who: o.value })} className={chip(who === o.value)} scroll={false}>
                  {o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />}
                  {o.label}
                </Link>
              ))}
            </div>
            <div className="-mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
              <span className="shrink-0 self-center text-[11px] font-bold text-muted">並び</span>
              {SORTS.map((x) => (
                <Link key={x.key} href={href({ sort: x.key })} className={chip(sort === x.key)} scroll={false}>
                  {x.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        {open.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-3 py-6 text-center">
            <Manul className="h-24 w-auto" />
            <p className="text-sm text-muted">
              {filtering ? "この条件に合うものはありません" : "欲しいものを、上から教えてください"}
            </p>
            {filtering && (
              <Link href="/wishes" className="btn-ghost !py-1.5 !text-xs" scroll={false}>
                絞り込みをやめる
              </Link>
            )}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {open.map((w) => (
              <li
                key={w.id}
                className="rounded-2xl border p-3 shadow-hard"
                style={tint(whoOf(members, w.member_id).color)}
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
                  {w.image_url && (
                    // 外のサイトの画像をそのまま出す（next/image だと許可するサイトを先に決める必要がある）
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.image_url}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-[72px] w-[72px] shrink-0 rounded-xl border border-line bg-surface object-cover"
                    />
                  )}
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
