import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { yen } from "@/lib/format";
import {
  addFixed,
  addGoal,
  addIncome,
  deleteFixed,
  deleteGoal,
  deleteIncome,
  setFixedActive,
  updateFixed,
  updateGoal,
  updateIncome,
} from "../actions";
import type { FixedCost, Income, SavingsGoal } from "@/types/database";

const dayLabel = (d: number) => (d >= 31 ? "月末" : `${d}日`);

function DaySelect({ defaultValue }: { defaultValue?: number }) {
  return (
    <select name="due_day" defaultValue={defaultValue ?? 27} aria-label="支払日" className="input">
      {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
        <option key={d} value={d}>
          毎月{d}日
        </option>
      ))}
      <option value={31}>毎月 月末</option>
    </select>
  );
}

function FixedFields({ cost }: { cost?: FixedCost }) {
  return (
    <>
      <input name="name" required defaultValue={cost?.name} placeholder="名前（家賃・スマホ・サブスクなど）" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" required inputMode="numeric" defaultValue={cost?.amount} placeholder="金額" className="input" />
        <DaySelect defaultValue={cost?.due_day} />
      </div>
      <input name="memo" defaultValue={cost?.memo ?? ""} placeholder="メモ（引き落とし口座など）" className="input" />
    </>
  );
}

function IncomeFields({ income }: { income?: Income }) {
  return (
    <>
      <input name="name" required defaultValue={income?.name} placeholder="名前（給料など）" className="input" />
      <input name="amount" required inputMode="numeric" defaultValue={income?.amount} placeholder="毎月の金額（手取り）" className="input" />
    </>
  );
}

function GoalFields({ goal }: { goal?: SavingsGoal }) {
  return (
    <>
      <input name="name" required defaultValue={goal?.name} placeholder="名前（旅行・引っ越し・もしもの時など）" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="target" inputMode="numeric" defaultValue={goal?.target ?? ""} placeholder="目標額（なくてもOK）" className="input" />
        <input name="monthly" inputMode="numeric" defaultValue={goal?.monthly || ""} placeholder="毎月ためる額" className="input" />
      </div>
    </>
  );
}

const rowClass = "rounded-2xl border border-line bg-surface px-3 py-2.5";
const summaryClass = "cursor-pointer text-[11px] font-bold text-muted";

// お金の設定：自分の毎月の収入・固定費・貯金の目標を登録する（相手には見えない）
export default async function MoneySettingsPage() {
  const supabase = await createClient();
  const [cRes, iRes, gRes] = await Promise.all([
    supabase.from("fixed_costs").select("id,name,amount,due_day,memo,active").order("due_day", { ascending: true }),
    supabase.from("incomes").select("id,name,amount,active").order("created_at", { ascending: true }),
    supabase.from("savings_goals").select("id,name,target,monthly,active").order("created_at", { ascending: true }),
  ]);
  const costs = (cRes.data as unknown as FixedCost[] | null) ?? [];
  const incomes = (iRes.data as unknown as Income[] | null) ?? [];
  const goals = (gRes.data as unknown as SavingsGoal[] | null) ?? [];

  return (
    <section className="stagger space-y-6">
      <Link href="/money" className="inline-flex items-center gap-1 text-sm font-bold text-ink">
        <Icon name="left" size={16} />
        お金にもどる
      </Link>
      <PageTitle title="お金の設定" label="SETTINGS" tone="bg-ink text-[#FAF4E4]" mascot="manul" />

      {/* 収入 */}
      <div className="space-y-3">
        <SectionTitle tone="bg-sky">毎月の収入</SectionTitle>
        <ul className="space-y-2">
          {incomes.map((i) => (
            <li key={i.id} className={rowClass}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{i.name}</p>
                <p className="display shrink-0">{yen(i.amount)}</p>
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・消す</summary>
                <ActionForm action={updateIncome.bind(null, i.id)} keep cheer="保存しました" className="mt-2 space-y-2">
                  <IncomeFields income={i} />
                  <button type="submit" className="btn-ghost w-full">
                    保存
                  </button>
                </ActionForm>
                <ActionForm action={deleteIncome.bind(null, i.id)} confirmText={`「${i.name}」を消しますか？`} className="mt-1">
                  <button type="submit" className="w-full py-1.5 text-xs font-bold text-danger">
                    消す
                  </button>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
        <ActionForm action={addIncome} cheer="収入を入れました" className="card space-y-2 p-4">
          <IncomeFields />
          <button type="submit" className="btn-primary w-full">
            <Icon name="plus" size={16} />
            収入を追加
          </button>
        </ActionForm>
      </div>

      {/* 固定費 */}
      <div className="space-y-3">
        <SectionTitle tone="bg-primary">毎月の固定費</SectionTitle>
        <ul className="space-y-2">
          {costs.map((c) => (
            <li key={c.id} className={`${rowClass} ${c.active ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{c.name}</p>
                  <p className="text-xs font-bold text-muted">
                    毎月{dayLabel(c.due_day)}まで{c.active ? "" : "・停止中"}
                    {c.memo ? `・${c.memo}` : ""}
                  </p>
                </div>
                <p className="display shrink-0">{yen(c.amount)}</p>
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・止める・消す</summary>
                <ActionForm action={updateFixed.bind(null, c.id)} keep cheer="保存しました" className="mt-2 space-y-2">
                  <FixedFields cost={c} />
                  <button type="submit" className="btn-ghost w-full">
                    保存
                  </button>
                </ActionForm>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <form action={setFixedActive.bind(null, c.id, !c.active)}>
                    <button type="submit" className="w-full py-1.5 text-xs font-bold text-muted">
                      {c.active ? "解約した（今後は出さない）" : "また払うようにする"}
                    </button>
                  </form>
                  <ActionForm action={deleteFixed.bind(null, c.id)} confirmText={`「${c.name}」を、これまでの支払い記録ごと消しますか？`}>
                    <button type="submit" className="w-full py-1.5 text-xs font-bold text-danger">
                      記録ごと消す
                    </button>
                  </ActionForm>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <ActionForm action={addFixed} cheer="固定費を入れました" className="card space-y-2 p-4">
          <FixedFields />
          <button type="submit" className="btn-primary w-full">
            <Icon name="plus" size={16} />
            固定費を追加
          </button>
        </ActionForm>
      </div>

      {/* 貯金 */}
      <div className="space-y-3">
        <SectionTitle tone="bg-lilac">貯金の目標</SectionTitle>
        <ul className="space-y-2">
          {goals.map((g) => (
            <li key={g.id} className={rowClass}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{g.name}</p>
                  <p className="text-xs font-bold text-muted">
                    {g.target ? `目標 ${yen(g.target)}` : "目標額なし"}
                    {g.monthly ? `・毎月 ${yen(g.monthly)}` : ""}
                  </p>
                </div>
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・消す</summary>
                <ActionForm action={updateGoal.bind(null, g.id)} keep cheer="保存しました" className="mt-2 space-y-2">
                  <GoalFields goal={g} />
                  <button type="submit" className="btn-ghost w-full">
                    保存
                  </button>
                </ActionForm>
                <ActionForm action={deleteGoal.bind(null, g.id)} confirmText={`「${g.name}」を、入金の記録ごと消しますか？`} className="mt-1">
                  <button type="submit" className="w-full py-1.5 text-xs font-bold text-danger">
                    記録ごと消す
                  </button>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
        <ActionForm action={addGoal} cheer="目標を入れました" className="card space-y-2 p-4">
          <GoalFields />
          <button type="submit" className="btn-primary w-full">
            <Icon name="plus" size={16} />
            貯金の目標を追加
          </button>
        </ActionForm>
      </div>
    </section>
  );
}
