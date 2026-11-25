import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { WhoChip, WhoSelect } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { yen } from "@/lib/format";
import { getMembers } from "@/lib/members";
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
import type { FixedCost, Income, Member, SavingsGoal } from "@/types/database";

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

function FixedFields({ members, cost }: { members: Member[]; cost?: FixedCost }) {
  return (
    <>
      <input name="name" required defaultValue={cost?.name} placeholder="名前（家賃・スマホ・サブスクなど）" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" required inputMode="numeric" defaultValue={cost?.amount} placeholder="金額" className="input" />
        <DaySelect defaultValue={cost?.due_day} />
      </div>
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <WhoSelect members={members} defaultValue={cost?.member_id} />
        <input name="memo" defaultValue={cost?.memo ?? ""} placeholder="メモ（引き落とし口座など）" className="input" />
      </div>
    </>
  );
}

function IncomeFields({ members, income }: { members: Member[]; income?: Income }) {
  return (
    <>
      <input name="name" required defaultValue={income?.name} placeholder="名前（給料など）" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="amount" required inputMode="numeric" defaultValue={income?.amount} placeholder="毎月の金額（手取り）" className="input" />
        <WhoSelect members={members} defaultValue={income?.member_id} />
      </div>
    </>
  );
}

function GoalFields({ members, goal }: { members: Member[]; goal?: SavingsGoal }) {
  return (
    <>
      <input name="name" required defaultValue={goal?.name} placeholder="名前（旅行・引っ越し・もしもの時など）" className="input" />
      <div className="grid grid-cols-2 gap-2">
        <input name="target" inputMode="numeric" defaultValue={goal?.target ?? ""} placeholder="目標額（なくてもOK）" className="input" />
        <input name="monthly" inputMode="numeric" defaultValue={goal?.monthly || ""} placeholder="毎月ためる額" className="input" />
      </div>
      <WhoSelect members={members} defaultValue={goal?.member_id} />
    </>
  );
}

const rowClass = "rounded-2xl border border-line bg-surface px-3 py-2.5";
const summaryClass = "cursor-pointer text-[11px] font-bold text-muted";

// お金の設定：毎月の収入・固定費・貯金の目標を登録する
export default async function MoneySettingsPage() {
  const supabase = await createClient();
  const [members, cRes, iRes, gRes] = await Promise.all([
    getMembers(supabase),
    supabase.from("fixed_costs").select("id,name,amount,due_day,member_id,memo,active").order("due_day", { ascending: true }),
    supabase.from("incomes").select("id,name,amount,member_id,active").order("created_at", { ascending: true }),
    supabase.from("savings_goals").select("id,name,target,monthly,member_id,active").order("created_at", { ascending: true }),
  ]);
  const costs = (cRes.data as unknown as FixedCost[] | null) ?? [];
  const incomes = (iRes.data as unknown as Income[] | null) ?? [];
  const goals = (gRes.data as unknown as SavingsGoal[] | null) ?? [];

  return (
    <section className="space-y-6">
      <Link href="/money" className="inline-flex items-center gap-1 text-sm font-bold text-ink">
        <Icon name="left" size={16} />
        お金にもどる
      </Link>
      <PageTitle title="お金の設定" label="SETTINGS" tone="bg-ink text-[#FAF4E4]" />

      {/* 収入 */}
      <div className="space-y-3">
        <SectionTitle tone="bg-sky">毎月の収入</SectionTitle>
        <ul className="space-y-2">
          {incomes.map((i) => (
            <li key={i.id} className={rowClass}>
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{i.name}</p>
                <WhoChip members={members} memberId={i.member_id} />
                <p className="display shrink-0">{yen(i.amount)}</p>
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・消す</summary>
                <ActionForm action={updateIncome.bind(null, i.id)} keep className="mt-2 space-y-2">
                  <IncomeFields members={members} income={i} />
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
        <ActionForm action={addIncome} className="card space-y-2 p-4">
          <IncomeFields members={members} />
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
                <WhoChip members={members} memberId={c.member_id} />
                <p className="display shrink-0">{yen(c.amount)}</p>
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・止める・消す</summary>
                <ActionForm action={updateFixed.bind(null, c.id)} keep className="mt-2 space-y-2">
                  <FixedFields members={members} cost={c} />
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
        <ActionForm action={addFixed} className="card space-y-2 p-4">
          <FixedFields members={members} />
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
                <WhoChip members={members} memberId={g.member_id} />
              </div>
              <details className="mt-1">
                <summary className={summaryClass}>直す・消す</summary>
                <ActionForm action={updateGoal.bind(null, g.id)} keep className="mt-2 space-y-2">
                  <GoalFields members={members} goal={g} />
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
        <ActionForm action={addGoal} className="card space-y-2 p-4">
          <GoalFields members={members} />
          <button type="submit" className="btn-primary w-full">
            <Icon name="plus" size={16} />
            貯金の目標を追加
          </button>
        </ActionForm>
      </div>
    </section>
  );
}
