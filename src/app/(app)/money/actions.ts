"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMonth, todayJST } from "@/lib/format";

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^\d-]/g, "");
  return s && s !== "-" ? Number(s) : null;
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const done = () => revalidatePath("/", "layout");

// ---------- 固定費 ----------

export async function payFixed(costId: string, month: string, amount: number) {
  if (!isMonth(month)) return;
  const supabase = await createClient();
  await supabase
    .from("fixed_payments")
    .upsert({ fixed_cost_id: costId, month, amount, paid_at: new Date().toISOString() }, { onConflict: "fixed_cost_id,month" });
  done();
}

export async function unpayFixed(costId: string, month: string) {
  const supabase = await createClient();
  await supabase.from("fixed_payments").delete().eq("fixed_cost_id", costId).eq("month", month);
  done();
}

function fixedFields(formData: FormData) {
  const day = num(formData.get("due_day"));
  return {
    name: text(formData.get("name")),
    amount: num(formData.get("amount")),
    due_day: day && day >= 1 && day <= 31 ? day : null,
    member_id: text(formData.get("member_id")) || null,
    memo: text(formData.get("memo")) || null,
  };
}

export async function addFixed(formData: FormData) {
  const row = fixedFields(formData);
  if (!row.name || row.amount === null || row.due_day === null) return;
  const supabase = await createClient();
  await supabase.from("fixed_costs").insert(row);
  done();
}

export async function updateFixed(id: string, formData: FormData) {
  const row = fixedFields(formData);
  if (!row.name || row.amount === null || row.due_day === null) return;
  const supabase = await createClient();
  await supabase.from("fixed_costs").update(row).eq("id", id);
  done();
}

// やめた固定費は消さずに止める（過去の月の記録を残すため）
export async function setFixedActive(id: string, active: boolean) {
  const supabase = await createClient();
  await supabase.from("fixed_costs").update({ active }).eq("id", id);
  done();
}

export async function deleteFixed(id: string) {
  const supabase = await createClient();
  await supabase.from("fixed_costs").delete().eq("id", id);
  done();
}

// ---------- 収入 ----------

function incomeFields(formData: FormData) {
  return {
    name: text(formData.get("name")),
    amount: num(formData.get("amount")),
    member_id: text(formData.get("member_id")) || null,
  };
}

export async function addIncome(formData: FormData) {
  const row = incomeFields(formData);
  if (!row.name || row.amount === null) return;
  const supabase = await createClient();
  await supabase.from("incomes").insert(row);
  done();
}

export async function updateIncome(id: string, formData: FormData) {
  const row = incomeFields(formData);
  if (!row.name || row.amount === null) return;
  const supabase = await createClient();
  await supabase.from("incomes").update(row).eq("id", id);
  done();
}

export async function deleteIncome(id: string) {
  const supabase = await createClient();
  await supabase.from("incomes").delete().eq("id", id);
  done();
}

// その月だけの金額。空で送ると、いつもの金額に戻る
export async function setIncomeActual(incomeId: string, month: string, formData: FormData) {
  if (!isMonth(month)) return;
  const amount = num(formData.get("amount"));
  const supabase = await createClient();
  if (amount === null) await supabase.from("income_actuals").delete().eq("income_id", incomeId).eq("month", month);
  else await supabase.from("income_actuals").upsert({ income_id: incomeId, month, amount }, { onConflict: "income_id,month" });
  done();
}

// ---------- 貯金 ----------

function goalFields(formData: FormData) {
  return {
    name: text(formData.get("name")),
    target: num(formData.get("target")),
    monthly: num(formData.get("monthly")) ?? 0,
    member_id: text(formData.get("member_id")) || null,
  };
}

export async function addGoal(formData: FormData) {
  const row = goalFields(formData);
  if (!row.name) return;
  const supabase = await createClient();
  await supabase.from("savings_goals").insert(row);
  done();
}

export async function updateGoal(id: string, formData: FormData) {
  const row = goalFields(formData);
  if (!row.name) return;
  const supabase = await createClient();
  await supabase.from("savings_goals").update(row).eq("id", id);
  done();
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  await supabase.from("savings_goals").delete().eq("id", id);
  done();
}

// 入金（mode が "out" なら引き出し）。日付は今日
export async function addSaving(goalId: string, formData: FormData) {
  const amount = num(formData.get("amount"));
  if (!amount) return;
  const out = text(formData.get("mode")) === "out";
  const supabase = await createClient();
  await supabase.from("savings_entries").insert({
    goal_id: goalId,
    amount: out ? -Math.abs(amount) : Math.abs(amount),
    date: todayJST(),
    memo: text(formData.get("memo")) || null,
  });
  done();
}

export async function addSavingAmount(goalId: string, amount: number) {
  if (!amount) return;
  const supabase = await createClient();
  await supabase.from("savings_entries").insert({ goal_id: goalId, amount, date: todayJST() });
  done();
}

export async function deleteSaving(id: string) {
  const supabase = await createClient();
  await supabase.from("savings_entries").delete().eq("id", id);
  done();
}
