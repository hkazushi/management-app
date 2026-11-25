import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { WhoChip } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { Meerkat } from "@/components/Meerkat";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { fmtDay, fmtMonth, isMonth, shiftMonth, todayJST, yen } from "@/lib/format";
import { getMembers } from "@/lib/members";
import { fixedLines, monthSummary, savingsTotals, statusLabel } from "@/lib/money";
import { addSaving, addSavingAmount, deleteSaving, payFixed, setIncomeActual, unpayFixed } from "./actions";
import type { FixedCost, FixedPayment, Income, IncomeActual, SavingsEntry, SavingsGoal } from "@/types/database";

const STATUS_TONE = {
  paid: "bg-line/50 text-muted",
  overdue: "bg-danger text-white",
  today: "bg-sun text-ink",
  soon: "bg-sun/35 text-ink",
  later: "bg-line/40 text-muted",
} as const;

// お金：その月の「使えるお金」、固定費の支払い、収入、貯金。
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayJST();
  const thisMonth = today.slice(0, 7);
  const month = isMonth(m) ? m : thisMonth;
  const supabase = await createClient();

  const [members, cRes, pRes, iRes, aRes, gRes, eRes] = await Promise.all([
    getMembers(supabase),
    supabase.from("fixed_costs").select("id,name,amount,due_day,member_id,memo,active"),
    supabase.from("fixed_payments").select("id,fixed_cost_id,month,amount,paid_at").eq("month", month),
    supabase.from("incomes").select("id,name,amount,member_id,active").eq("active", true).order("created_at", { ascending: true }),
    supabase.from("income_actuals").select("id,income_id,month,amount").eq("month", month),
    supabase.from("savings_goals").select("id,name,target,monthly,member_id,active").eq("active", true).order("created_at", { ascending: true }),
    supabase.from("savings_entries").select("id,goal_id,amount,date,memo").order("created_at", { ascending: false }).limit(2000),
  ]);
  const costs = (cRes.data as unknown as FixedCost[] | null) ?? [];
  const payments = (pRes.data as unknown as FixedPayment[] | null) ?? [];
  const incomes = (iRes.data as unknown as Income[] | null) ?? [];
  const actuals = (aRes.data as unknown as IncomeActual[] | null) ?? [];
  const goals = (gRes.data as unknown as SavingsGoal[] | null) ?? [];
  const entries = (eRes.data as unknown as SavingsEntry[] | null) ?? [];

  const lines = fixedLines(costs, payments, month, today);
  const sum = monthSummary(lines, incomes, actuals, goals, month);
  const totals = savingsTotals(entries, month);
  const actualOf = new Map(actuals.map((a) => [a.income_id, a.amount]));
  const paidCount = lines.filter((l) => l.payment).length;
  const empty = costs.length === 0 && incomes.length === 0 && goals.length === 0;

  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-sun/50 bg-[#FAF4E4]/10 text-[#FAF4E4] active:scale-95";

  return (
    <section className="space-y-5">
      <PageTitle title={fmtMonth(month)} label="MONEY" tone="bg-primary text-[#FAF4E4]">
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/money?m=${shiftMonth(month, -1)}`} aria-label="前の月" className={navBtn}>
            <Icon name="left" size={18} />
          </Link>
          {month !== thisMonth && (
            <Link href="/money" className={`${navBtn} !w-auto px-3 text-xs font-bold`}>
              今月
            </Link>
          )}
          <Link href={`/money?m=${shiftMonth(month, 1)}`} aria-label="次の月" className={navBtn}>
            <Icon name="right" size={18} />
          </Link>
        </div>
      </PageTitle>

      {cRes.error && (
        <p className="card bg-danger p-4 text-sm font-bold text-white">
          データベースの準備が終わっていません。Supabase の SQL Editor で supabase/migrations/0008_home.sql を実行してください。
        </p>
      )}

      {empty && !cRes.error ? (
        <div className="card flex flex-col items-center space-y-3 p-6 text-center">
          <Meerkat className="h-28 w-auto" />
          <p className="display text-xl">まずは設定から</p>
          <p className="text-sm leading-relaxed text-muted">毎月の収入・固定費・貯金の目標を登録すると、ここに「使えるお金」と支払いの予定が出ます。</p>
          <Link href="/money/settings" className="btn-primary">
            <Icon name="settings" size={16} />
            お金の設定をひらく
          </Link>
        </div>
      ) : (
        <>
          {/* 使えるお金 */}
          <div className="card overflow-hidden">
            <div className={`px-5 py-5 ${sum.free < 0 ? "bg-danger text-white" : "bg-accent text-[#FAF4E4]"}`}>
              <p className="text-xs font-bold opacity-80">この月に自由に使えるお金</p>
              <p className={`display mt-1.5 text-[44px] leading-none ${sum.free < 0 ? "" : "text-sun"}`}>{yen(sum.free)}</p>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">収入</dt>
                <dd className="display text-[17px]">{yen(sum.income)}</dd>
              </div>
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">固定費</dt>
                <dd className="display text-[17px]">−{yen(sum.fixed)}</dd>
              </div>
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">貯金</dt>
                <dd className="display text-[17px]">−{yen(sum.savings)}</dd>
              </div>
            </dl>
          </div>

          {/* 固定費 */}
          <div className="space-y-3">
            <SectionTitle
              tone="bg-primary"
              right={
                <span className="text-xs font-bold text-muted">
                  {paidCount}/{lines.length} 済み{sum.unpaid > 0 ? `・のこり ${yen(sum.unpaid)}` : ""}
                </span>
              }
            >
              固定費の支払い
            </SectionTitle>
            {lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm font-bold text-muted">固定費はまだ登録されていません</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li
                    key={l.cost.id}
                    className={`flex items-center gap-3 rounded-2xl border border-line px-3 py-2.5 ${
                      l.payment ? "bg-surface opacity-70" : "bg-surface shadow-hard-sm"
                    }`}
                  >
                    <form action={l.payment ? unpayFixed.bind(null, l.cost.id, month) : payFixed.bind(null, l.cost.id, month, l.cost.amount)}>
                      <button
                        type="submit"
                        aria-label={l.payment ? "まだ払っていないに戻す" : "払った"}
                        className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                          l.payment ? "border-primary bg-primary text-sun" : "border-ink/30 bg-surface text-transparent hover:text-ink/40"
                        }`}
                      >
                        <Icon name="check" size={20} />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[15px] font-bold ${l.payment ? "line-through" : ""}`}>{l.cost.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted">
                        <span>{fmtDay(l.due)}まで</span>
                        <WhoChip members={members} memberId={l.cost.member_id} />
                        {month === thisMonth || l.status === "paid" || l.status === "overdue" ? (
                          <span className={`chip ${STATUS_TONE[l.status]}`}>{statusLabel(l)}</span>
                        ) : null}
                      </p>
                    </div>
                    <p className="display shrink-0 text-base">{yen(l.payment?.amount ?? l.cost.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 収入 */}
          <div className="space-y-3">
            <SectionTitle tone="bg-sky">収入</SectionTitle>
            {incomes.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm font-bold text-muted">収入はまだ登録されていません</p>
            ) : (
              <ul className="space-y-2">
                {incomes.map((i) => {
                  const actual = actualOf.get(i.id);
                  return (
                    <li key={i.id} className="rounded-2xl border border-line bg-surface px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{i.name}</p>
                        <WhoChip members={members} memberId={i.member_id} />
                        <p className="display shrink-0 text-base">{yen(actual ?? i.amount)}</p>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] font-bold text-muted">
                          {actual !== undefined ? `この月だけ変更中（いつもは ${yen(i.amount)}）` : "この月だけ金額を変える"}
                        </summary>
                        <ActionForm action={setIncomeActual.bind(null, i.id, month)} keep className="mt-2 flex gap-2">
                          <input name="amount" inputMode="numeric" defaultValue={actual ?? ""} placeholder="空にすると元に戻る" className="input flex-1" />
                          <button type="submit" className="btn-ghost shrink-0">
                            保存
                          </button>
                        </ActionForm>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 貯金 */}
          <div className="space-y-3">
            <SectionTitle tone="bg-lilac">貯金</SectionTitle>
            {goals.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-sm font-bold text-muted">貯金の目標はまだ登録されていません</p>
            ) : (
              <ul className="space-y-3">
                {goals.map((g) => {
                  const t = totals.get(g.id) ?? { total: 0, inMonth: 0 };
                  const pct = g.target ? Math.max(0, Math.min(100, Math.round((t.total / g.target) * 100))) : null;
                  const rest = g.monthly - t.inMonth;
                  const recent = entries.filter((e) => e.goal_id === g.id).slice(0, 4);
                  return (
                    <li key={g.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-[15px] font-bold">
                            <Icon name="piggy" size={18} />
                            <span className="truncate">{g.name}</span>
                          </p>
                          <div className="mt-1">
                            <WhoChip members={members} memberId={g.member_id} />
                          </div>
                        </div>
                        <p className="shrink-0 text-right">
                          <span className="display block text-2xl leading-none">{yen(t.total)}</span>
                          {g.target ? <span className="text-[11px] font-bold text-muted">目標 {yen(g.target)}</span> : null}
                        </p>
                      </div>
                      {pct !== null && (
                        <div className="mt-3">
                          <div className="h-2.5 overflow-hidden rounded-full bg-line/50">
                            <div className="h-full rounded-full bg-sun" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-1 text-[11px] font-bold text-muted">
                            {pct}%{g.target && t.total < g.target ? `・あと ${yen(g.target - t.total)}` : "・達成！"}
                          </p>
                        </div>
                      )}
                      {g.monthly > 0 && (
                        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2">
                          <p className="text-xs font-bold">
                            {fmtMonth(month)}は {yen(t.inMonth)} / {yen(g.monthly)}
                          </p>
                          {rest > 0 && month === thisMonth ? (
                            <form action={addSavingAmount.bind(null, g.id, rest)}>
                              <button type="submit" className="btn-primary !px-3 !py-1.5 !text-xs">
                                {yen(rest)} 入れた
                              </button>
                            </form>
                          ) : rest <= 0 ? (
                            <span className="chip bg-primary text-sun">今月分OK</span>
                          ) : null}
                        </div>
                      )}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-bold text-muted">金額を入れる・履歴</summary>
                        <ActionForm action={addSaving.bind(null, g.id)} className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
                          <input name="amount" required inputMode="numeric" placeholder="金額" className="input" />
                          <select name="mode" defaultValue="in" aria-label="入金か引き出しか" className="input">
                            <option value="in">入れた</option>
                            <option value="out">出した</option>
                          </select>
                          <input name="memo" placeholder="メモ" className="input" />
                          <button type="submit" className="btn-ghost">
                            記録
                          </button>
                        </ActionForm>
                        {recent.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {recent.map((e) => (
                              <li key={e.id} className="flex items-center gap-2 text-xs font-bold text-muted">
                                <span className="w-16 shrink-0">{fmtDay(e.date)}</span>
                                <span className={`shrink-0 font-bold ${e.amount < 0 ? "text-danger" : "text-ink"}`}>
                                  {e.amount < 0 ? "−" : "+"}
                                  {yen(Math.abs(e.amount))}
                                </span>
                                <span className="min-w-0 flex-1 truncate">{e.memo}</span>
                                <ActionForm action={deleteSaving.bind(null, e.id)} confirmText="この記録を消しますか？">
                                  <button type="submit" aria-label="消す" className="p-0.5 text-faint hover:text-danger">
                                    <Icon name="trash" size={13} />
                                  </button>
                                </ActionForm>
                              </li>
                            ))}
                          </ul>
                        )}
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link href="/money/settings" className="btn-ghost w-full">
            <Icon name="settings" size={16} />
            収入・固定費・貯金の設定
          </Link>
        </>
      )}
    </section>
  );
}
