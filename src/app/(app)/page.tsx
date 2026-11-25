import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { WhoChip } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { Meerkat } from "@/components/Meerkat";
import { SectionTitle } from "@/components/PageTitle";
import { DEFAULT_COLOR } from "@/lib/colors";
import { addDays, diffDays, fmtDay, fmtDayLong, fmtTimeRange, todayJST, yen } from "@/lib/format";
import { getMembers, whoOf } from "@/lib/members";
import { fixedLines, monthSummary, statusLabel } from "@/lib/money";
import { payFixed } from "./money/actions";
import type { EventRow, FixedCost, FixedPayment, Income, IncomeActual, SavingsGoal, Wish } from "@/types/database";

// ホーム：今日からの予定、近い支払い、今月使えるお金、欲しいもの
export default async function HomePage() {
  const supabase = await createClient();
  const today = todayJST();
  const month = today.slice(0, 7);
  const weekEnd = addDays(today, 7);

  const [
    members,
    {
      data: { user },
    },
    eRes,
    cRes,
    pRes,
    iRes,
    aRes,
    gRes,
    wRes,
  ] = await Promise.all([
    getMembers(supabase),
    supabase.auth.getUser(),
    supabase
      .from("events")
      .select("id,date,title,start_time,end_time,member_id,color,memo,batch_id")
      .gte("date", today)
      .lte("date", weekEnd)
      .order("date", { ascending: true }),
    supabase.from("fixed_costs").select("id,name,amount,due_day,member_id,memo,active"),
    supabase.from("fixed_payments").select("id,fixed_cost_id,month,amount,paid_at").eq("month", month),
    supabase.from("incomes").select("id,name,amount,member_id,active").eq("active", true),
    supabase.from("income_actuals").select("id,income_id,month,amount").eq("month", month),
    supabase.from("savings_goals").select("id,name,target,monthly,member_id,active").eq("active", true),
    supabase
      .from("wishes")
      .select("id,title,url,price,memo,member_id,done,done_at,created_at")
      .eq("done", false)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const events = (eRes.data as unknown as EventRow[] | null) ?? [];
  const lines = fixedLines(
    (cRes.data as unknown as FixedCost[] | null) ?? [],
    (pRes.data as unknown as FixedPayment[] | null) ?? [],
    month,
    today,
  );
  const incomes = (iRes.data as unknown as Income[] | null) ?? [];
  const goals = (gRes.data as unknown as SavingsGoal[] | null) ?? [];
  const sum = monthSummary(lines, incomes, (aRes.data as unknown as IncomeActual[] | null) ?? [], goals, month);
  const wishes = (wRes.data as unknown as Wish[] | null) ?? [];
  const me = members.find((m) => m.user_id === user?.id);

  // 期限が7日以内、または過ぎているのに払っていないもの
  const urgent = lines.filter((l) => l.status === "overdue" || l.status === "today" || l.status === "soon");
  const unpaid = lines.filter((l) => !l.payment);
  const hasMoney = lines.length > 0 || incomes.length > 0 || goals.length > 0;

  const byDate = new Map<string, EventRow[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  for (const list of byDate.values()) list.sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  const todays = byDate.get(today) ?? [];
  const later = [...byDate.entries()].filter(([d]) => d !== today);
  const colorOf = (e: EventRow) => e.color ?? (e.member_id ? whoOf(members, e.member_id).color : DEFAULT_COLOR);
  const dayWord = (d: string) => (diffDays(d, today) === 1 ? "あした" : fmtDay(d));

  return (
    <section className="space-y-6">
      {eRes.error && (
        <p className="card bg-danger p-4 text-sm font-bold text-white">
          データベースの準備が終わっていません。Supabase の SQL Editor で supabase/migrations/0008_home.sql を実行してください。
        </p>
      )}

      {/* 今日 */}
      <div className="relative overflow-hidden rounded-[26px] bg-primary px-5 pb-5 pt-6 text-[#FAF4E4] shadow-hard-lg">
        <svg className="pointer-events-none absolute -right-14 -top-16 h-64 w-64 text-sun opacity-35" viewBox="0 0 100 100" aria-hidden="true">
          {[14, 22, 30, 38, 46].map((r) => (
            <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="0.4" />
          ))}
        </svg>
        <span className="pointer-events-none absolute inset-[6px] rounded-[21px] border border-sun/40" aria-hidden="true" />
        <Meerkat className="pointer-events-none absolute -bottom-3 right-4 h-[132px] w-auto" />

        <div className="relative pr-24">
          <span className="sticker text-sun">Today</span>
          <p className="display mt-2 text-[36px] leading-none">{fmtDayLong(today)}</p>
          <p className="mt-2 text-sm text-[#FAF4E4]/80">{me ? `${me.name}さん、おつかれさまです。` : "おつかれさまです。"}</p>
        </div>

        <div className="relative mt-5 space-y-2 pr-24">
          {todays.length === 0 ? (
            <p className="rounded-2xl bg-[#FAF4E4]/10 px-3.5 py-3 text-sm text-[#FAF4E4]/90">今日の予定はありません。</p>
          ) : (
            todays.map((e) => (
              <div key={e.id} className="flex items-stretch overflow-hidden rounded-2xl bg-surface text-ink">
                <span className="w-1.5 shrink-0" style={{ background: colorOf(e) }} />
                <div className="min-w-0 flex-1 px-3 py-2">
                  <p className="text-[15px] font-bold leading-snug">{e.title}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
                    {e.start_time && <span>{fmtTimeRange(e.start_time, e.end_time)}</span>}
                    <span>{whoOf(members, e.member_id).name}</span>
                    {e.memo && <span>{e.memo}</span>}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* よく使う入口 */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { href: `/calendar?d=${today}`, icon: "calendar" as const, label: "予定を入れる" },
          { href: "/wishes#add", icon: "gift" as const, label: "欲しいもの" },
          { href: "/money", icon: "coin" as const, label: "支払いを見る" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-3.5 text-xs font-bold text-ink shadow-hard-sm transition active:scale-95"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sun">
              <Icon name={a.icon} size={19} />
            </span>
            {a.label}
          </Link>
        ))}
      </div>

      {/* 支払い */}
      {urgent.length > 0 && (
        <div className="space-y-3">
          <SectionTitle tone="bg-danger">そろそろ支払い</SectionTitle>
          <ul className="space-y-2">
            {urgent.map((l) => (
              <li
                key={l.cost.id}
                className={`flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 shadow-hard-sm ${
                  l.status === "overdue" ? "bg-danger text-white" : l.status === "today" ? "bg-sun/40" : "bg-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{l.cost.name}</p>
                  <p className={`text-xs font-bold ${l.status === "overdue" ? "text-white/90" : "text-muted"}`}>
                    {fmtDay(l.due)}まで・{statusLabel(l)}
                  </p>
                </div>
                <p className="display shrink-0 text-base">{yen(l.cost.amount)}</p>
                <form action={payFixed.bind(null, l.cost.id, month, l.cost.amount)}>
                  <button type="submit" className="btn-ghost !px-3 !py-1.5 !text-xs">
                    払った
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* お金 */}
      {hasMoney && (
        <Link href="/money" className="block overflow-hidden rounded-[22px] border border-line shadow-hard">
          <div className={`px-5 py-4 ${sum.free < 0 ? "bg-danger text-white" : "bg-accent text-[#FAF4E4]"}`}>
            <p className="text-xs font-bold opacity-80">今月、自由に使えるお金</p>
            <p className="display mt-1 text-[36px] leading-none text-sun">{yen(sum.free)}</p>
          </div>
          <p className="flex items-center justify-between border-t border-line bg-surface px-4 py-2 text-xs font-bold text-ink">
            <span>
              {unpaid.length > 0 ? `固定費 のこり${unpaid.length}件（${yen(sum.unpaid)}）` : lines.length > 0 ? "今月の固定費はぜんぶ支払い済み" : "固定費は未登録"}
            </span>
            <Icon name="right" size={15} />
          </p>
        </Link>
      )}

      {/* これからの予定 */}
      <div className="space-y-3">
        <SectionTitle
          tone="bg-accent"
          right={
            <Link href="/calendar" className="text-xs font-bold text-accent underline decoration-sun underline-offset-4">
              カレンダー
            </Link>
          }
        >
          この先1週間
        </SectionTitle>
        {later.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm font-bold text-muted">この先1週間の予定はまだありません</p>
        ) : (
          <ul className="space-y-2">
            {later.map(([date, list]) => (
              <li key={date} className="flex gap-3">
                <p className="display w-[4.2rem] shrink-0 pt-2 text-[13px] leading-tight text-ink">{dayWord(date)}</p>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {list.map((e) => (
                    <div key={e.id} className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface">
                      <span className="w-1.5 shrink-0" style={{ background: colorOf(e) }} />
                      <p className="min-w-0 flex-1 truncate px-2.5 py-1.5 text-sm font-bold">
                        {e.title}
                        {e.start_time && <span className="ml-2 text-xs font-bold text-muted">{fmtTimeRange(e.start_time, e.end_time)}</span>}
                      </p>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 欲しいもの */}
      {wishes.length > 0 && (
        <div className="space-y-3">
          <SectionTitle
            tone="bg-pink"
            right={
              <Link href="/wishes" className="text-xs font-bold text-accent underline decoration-sun underline-offset-4">
                ぜんぶ見る
              </Link>
            }
          >
            欲しいもの
          </SectionTitle>
          <ul className="space-y-2">
            {wishes.map((w) => (
              <li key={w.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2.5">
                <Icon name="gift" size={17} className="shrink-0" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{w.title}</p>
                <WhoChip members={members} memberId={w.member_id} />
                {w.price !== null && <span className="display shrink-0 text-sm">{yen(w.price)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
