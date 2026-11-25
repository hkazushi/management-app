import { diffDays, dueDate } from "@/lib/format";
import type { FixedCost, FixedPayment, Income, IncomeActual, OneOff, SavingsEntry, SavingsGoal } from "@/types/database";

export type FixedStatus = "paid" | "overdue" | "today" | "soon" | "later";

export type FixedLine = {
  cost: FixedCost;
  due: string; // その月の支払期限（YYYY-MM-DD）
  payment: FixedPayment | null;
  daysLeft: number; // 期限まであと何日（過ぎていればマイナス）
  status: FixedStatus;
};

// その月の固定費を、期限の早い順に並べて状態を付ける
export function fixedLines(costs: FixedCost[], payments: FixedPayment[], month: string, today: string): FixedLine[] {
  const paid = new Map(payments.filter((p) => p.month === month).map((p) => [p.fixed_cost_id, p]));
  return costs
    .filter((c) => c.active || paid.has(c.id))
    .map((cost) => {
      const due = dueDate(month, cost.due_day);
      const payment = paid.get(cost.id) ?? null;
      const daysLeft = diffDays(due, today);
      const status: FixedStatus = payment
        ? "paid"
        : daysLeft < 0
          ? "overdue"
          : daysLeft === 0
            ? "today"
            : daysLeft <= 7
              ? "soon"
              : "later";
      return { cost, due, payment, daysLeft, status };
    })
    .sort((a, b) => a.due.localeCompare(b.due) || a.cost.name.localeCompare(b.cost.name, "ja"));
}

// 単発の出費1件の状態（固定費と同じ見せ方をする）
export type OneOffLine = { item: OneOff; daysLeft: number; status: FixedStatus };

export function oneOffLine(item: OneOff, today: string): OneOffLine {
  const daysLeft = diffDays(item.date, today);
  const status: FixedStatus = item.paid_at
    ? "paid"
    : daysLeft < 0
      ? "overdue"
      : daysLeft === 0
        ? "today"
        : daysLeft <= 7
          ? "soon"
          : "later";
  return { item, daysLeft, status };
}

export function statusLabel(line: { status: FixedStatus; daysLeft: number }): string {
  switch (line.status) {
    case "paid":
      return "支払い済み";
    case "overdue":
      return `${-line.daysLeft}日すぎています`;
    case "today":
      return "今日まで";
    default:
      return `あと${line.daysLeft}日`;
  }
}

export type MonthSummary = {
  income: number;
  fixed: number;
  extra: number; // 単発の出費の合計
  savings: number; // 毎月ためる予定の合計
  free: number; // 使えるお金 = 収入 − 固定費 − 単発の出費 − 貯金
  unpaid: number; // まだ払っていない固定費・単発の出費の合計
};

export function monthSummary(
  lines: FixedLine[],
  incomes: Income[],
  actuals: IncomeActual[],
  goals: SavingsGoal[],
  month: string,
  oneOffs: OneOff[] = [], // その月の単発（日付がその月のもの）
): MonthSummary {
  const inMonth = oneOffs.filter((o) => o.date.startsWith(month));
  const extraIncome = inMonth.filter((o) => o.kind === "income").reduce((n, o) => n + o.amount, 0);
  const expenses = inMonth.filter((o) => o.kind === "expense");
  const extra = expenses.reduce((n, o) => n + o.amount, 0);
  const actual = new Map(actuals.filter((a) => a.month === month).map((a) => [a.income_id, a.amount]));
  const income = incomes.filter((i) => i.active).reduce((n, i) => n + (actual.get(i.id) ?? i.amount), 0) + extraIncome;
  const fixed = lines.reduce((n, l) => n + (l.payment?.amount ?? l.cost.amount), 0);
  const unpaid =
    lines.filter((l) => !l.payment).reduce((n, l) => n + l.cost.amount, 0) +
    expenses.filter((o) => !o.paid_at).reduce((n, o) => n + o.amount, 0);
  const savings = goals.filter((g) => g.active).reduce((n, g) => n + g.monthly, 0);
  return { income, fixed, extra, savings, free: income - fixed - extra - savings, unpaid };
}

// 目標ごとの「これまでの合計」と「その月に入れた額」
export function savingsTotals(entries: SavingsEntry[], month: string): Map<string, { total: number; inMonth: number }> {
  const map = new Map<string, { total: number; inMonth: number }>();
  for (const e of entries) {
    const t = map.get(e.goal_id) ?? { total: 0, inMonth: 0 };
    t.total += e.amount;
    if (e.date.startsWith(month)) t.inMonth += e.amount;
    map.set(e.goal_id, t);
  }
  return map;
}
