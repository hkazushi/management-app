import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { Meerkat } from "@/components/Meerkat";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { daysInMonth, fmtDay, fmtMonth, isMonth, shiftMonth, todayJST, yen } from "@/lib/format";
import { getMembers } from "@/lib/members";
import { fixedLines, monthSummary, oneOffLine, savingsTotals, statusLabel } from "@/lib/money";
import {
  addOneOff,
  addSaving,
  addSavingAmount,
  deleteOneOff,
  deleteSaving,
  payFixed,
  setIncomeActual,
  setOneOffPaid,
  unpayFixed,
} from "./actions";
import type { FixedCost, FixedPayment, Income, IncomeActual, OneOff, SavingsEntry, SavingsGoal } from "@/types/database";

const STATUS_TONE = {
  paid: "bg-line/50 text-muted",
  overdue: "bg-danger text-white",
  today: "bg-sun text-ink",
  soon: "bg-sun/35 text-ink",
  later: "bg-line/40 text-muted",
} as const;

// お金：その月の「使えるお金」、固定費の支払い、収入、貯金。
// ここに出るのは自分の分だけ（DB 側で本人の行しか返らない）。相手のお金は見えない。
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const today = todayJST();
  const thisMonth = today.slice(0, 7);
  const month = isMonth(m) ? m : thisMonth;
  const supabase = await createClient();

  const [
    members,
    {
      data: { user },
    },
    cRes,
    pRes,
    iRes,
    aRes,
    gRes,
    eRes,
    oRes,
  ] = await Promise.all([
    getMembers(supabase),
    supabase.auth.getUser(),
    supabase.from("fixed_costs").select("id,name,amount,due_day,memo,active"),
    supabase.from("fixed_payments").select("id,fixed_cost_id,month,amount,paid_at").eq("month", month),
    supabase.from("incomes").select("id,name,amount,active").eq("active", true).order("created_at", { ascending: true }),
    supabase.from("income_actuals").select("id,income_id,month,amount").eq("month", month),
    supabase.from("savings_goals").select("id,name,target,monthly,active").eq("active", true).order("created_at", { ascending: true }),
    supabase.from("savings_entries").select("id,goal_id,amount,date,memo").order("created_at", { ascending: false }).limit(2000),
    supabase
      .from("one_offs")
      .select("id,kind,name,amount,date,paid_at,memo")
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${String(daysInMonth(month)).padStart(2, "0")}`)
      .order("date", { ascending: true }),
  ]);
  const costs = (cRes.data as unknown as FixedCost[] | null) ?? [];
  const payments = (pRes.data as unknown as FixedPayment[] | null) ?? [];
  const incomes = (iRes.data as unknown as Income[] | null) ?? [];
  const actuals = (aRes.data as unknown as IncomeActual[] | null) ?? [];
  const goals = (gRes.data as unknown as SavingsGoal[] | null) ?? [];
  const entries = (eRes.data as unknown as SavingsEntry[] | null) ?? [];
  // 単発のテーブル（0009）がまだ無いときは、空として扱って画面に案内を出す
  const oneOffs = (oRes.data as unknown as OneOff[] | null) ?? [];
  const oneOffLines = oneOffs.map((o) => oneOffLine(o, today));

  const me = members.find((x) => x.user_id === user?.id);
  const lines = fixedLines(costs, payments, month, today);
  const sum = monthSummary(lines, incomes, actuals, goals, month, oneOffs);
  const totals = savingsTotals(entries, month);
  const actualOf = new Map(actuals.map((a) => [a.income_id, a.amount]));
  const paidCount = lines.filter((l) => l.payment).length;
  const empty = costs.length === 0 && incomes.length === 0 && goals.length === 0 && oneOffs.length === 0;
  // 単発を入れるときの日付の初期値：今月を見ているなら今日、ほかの月ならその月の1日
  const defaultDate = month === thisMonth ? today : `${month}-01`;

  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-sun/50 bg-[#FAF4E4]/10 text-[#FAF4E4] active:scale-95";

  return (
    <section className="stagger space-y-5">
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

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name="lock" size={13} />
        このページは{me ? `${me.name}さん` : "自分"}だけに見えます。相手のお金は見えません。
      </p>

      {empty && !cRes.error && (
        <div className="card flex flex-col items-center space-y-3 p-6 text-center">
          <Meerkat className="h-28 w-auto" />
          <p className="display text-xl">まずは設定から</p>
          <p className="text-sm leading-relaxed text-muted">毎月の収入・固定費・貯金の目標を登録すると、ここに「使えるお金」と支払いの予定が出ます。</p>
          <Link href="/money/settings" className="btn-primary">
            <Icon name="settings" size={16} />
            お金の設定をひらく
          </Link>
        </div>
      )}

      {/* 何も登録していなくても、単発だけは入れられるように全体を出す */}
      {!cRes.error && (
        <>
          {/* 使えるお金 */}
          <div className="card overflow-hidden">
            <div className={`px-5 py-5 ${sum.free < 0 ? "bg-danger text-white" : "bg-accent text-[#FAF4E4]"}`}>
              <p className="text-xs font-bold opacity-80">{me ? `${me.name}さんが` : ""}この月に自由に使えるお金</p>
              <p className={`display mt-1.5 text-[38px] leading-none sm:text-[44px] ${sum.free < 0 ? "" : "text-sun"}`}>{yen(sum.free)}</p>
            </div>
            <dl className="grid grid-cols-4 divide-x divide-line border-t border-line text-center">
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">収入</dt>
                <dd className="display text-[17px]">{yen(sum.income)}</dd>
              </div>
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">固定費</dt>
                <dd className="display text-[17px]">−{yen(sum.fixed)}</dd>
              </div>
              <div className="px-1 py-3">
                <dt className="text-[10px] font-bold text-ink/70">単発</dt>
                <dd className="display text-[17px]">−{yen(sum.extra)}</dd>
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
                        {month === thisMonth || l.status === "paid" || l.status === "overdue" ? (
                          <span className={`chip ${STATUS_TONE[l.status]}`}>{statusLabel(l)}</span>
                        ) : null}
                      </p>
                    </div>
                    <p className="display shrink-0 text-[17px]">{yen(l.payment?.amount ?? l.cost.amount)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 単発（この月だけ） */}
          <div className="space-y-3">
            <SectionTitle>単発の出費・収入</SectionTitle>
            {oRes.error ? (
              <p className="rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-muted">
                単発を使うには、Supabase の SQL Editor で supabase/migrations/0009_one_offs_and_feed.sql を実行してください。
              </p>
            ) : (
              <>
                {oneOffLines.length > 0 && (
                  <ul className="space-y-2">
                    {oneOffLines.map((l) => {
                      const o = l.item;
                      const income = o.kind === "income";
                      return (
                        <li
                          key={o.id}
                          className={`flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 ${
                            o.paid_at ? "opacity-70" : "shadow-hard-sm"
                          }`}
                        >
                          {income ? (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky text-ink">
                              <Icon name="plus" size={18} />
                            </span>
                          ) : (
                            <form action={setOneOffPaid.bind(null, o.id, !o.paid_at)}>
                              <button
                                type="submit"
                                aria-label={o.paid_at ? "まだ払っていないに戻す" : "払った"}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border transition ${
                                  o.paid_at ? "border-primary bg-primary text-sun" : "border-ink/30 bg-surface text-transparent hover:text-ink/40"
                                }`}
                              >
                                <Icon name="check" size={20} />
                              </button>
                            </form>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-[15px] font-bold ${o.paid_at ? "line-through" : ""}`}>{o.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted">
                              <span>{income ? `${fmtDay(o.date)}に入る` : `${fmtDay(o.date)}まで`}</span>
                              {!income && <span className={`chip ${STATUS_TONE[l.status]}`}>{statusLabel(l)}</span>}
                              {o.memo && <span className="font-normal">{o.memo}</span>}
                            </p>
                          </div>
                          <p className="display shrink-0 text-[17px]">
                            {income ? "+" : ""}
                            {yen(o.amount)}
                          </p>
                          <ActionForm action={deleteOneOff.bind(null, o.id)} confirmText={`「${o.name}」を消しますか？`}>
                            <button type="submit" aria-label="消す" className="p-1 text-faint hover:text-danger">
                              <Icon name="trash" size={15} />
                            </button>
                          </ActionForm>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <details className="card p-4" open={oneOffLines.length === 0 ? undefined : false}>
                  <summary className="cursor-pointer text-sm font-bold text-ink">単発を追加（車検・旅行・ボーナスなど）</summary>
                  <ActionForm action={addOneOff} cheer="単発を入れました" className="mt-3 space-y-2">
                    <div className="flex gap-1.5" role="radiogroup" aria-label="出費か収入か">
                      {[
                        { value: "expense", label: "出費" },
                        { value: "income", label: "収入" },
                      ].map((k, i) => (
                        <label key={k.value} className="flex-1 cursor-pointer">
                          <input type="radio" name="kind" value={k.value} defaultChecked={i === 0} className="peer sr-only" />
                          <span className="block rounded-full border border-line bg-surface py-2 text-center text-sm font-bold text-muted transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-[#FAF4E4]">
                            {k.label}
                          </span>
                        </label>
                      ))}
                    </div>
                    <input name="name" required placeholder="名前" className="input" />
                    <div className="grid grid-cols-2 gap-2">
                      <input name="amount" required inputMode="numeric" placeholder="金額" className="input" />
                      <input name="date" type="date" required defaultValue={defaultDate} aria-label="日付（出費は期限、収入は入る日）" className="input" />
                    </div>
                    <input name="memo" placeholder="メモ" className="input" />
                    <button type="submit" className="btn-primary w-full">
                      <Icon name="plus" size={16} />
                      追加
                    </button>
                  </ActionForm>
                </details>
              </>
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
                        <ActionForm action={addSaving.bind(null, g.id)} cheer="記録しました" className="mt-2 grid grid-cols-[1fr_6.5rem] gap-2">
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
            収入・固定費・貯金を追加・変更
          </Link>
        </>
      )}
    </section>
  );
}
