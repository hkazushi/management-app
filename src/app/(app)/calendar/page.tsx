import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarView, type DueMark } from "@/components/CalendarView";
import { Icon } from "@/components/Icon";
import { PageTitle } from "@/components/PageTitle";
import { addDays, dueDate, fmtMonth, isDate, isMonth, shiftMonth, todayJST } from "@/lib/format";
import { getMembers } from "@/lib/members";
import type { EventPreset, EventRow, FixedCost, FixedPayment } from "@/types/database";

// カレンダー：月の予定を見る・足す。固定費の支払日も印で出す。
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const { m, d } = await searchParams;
  const today = todayJST();
  // ?d=日付 で来たら、その日を選んだ状態で開く
  const month = isMonth(m) ? m : isDate(d) ? d.slice(0, 7) : today.slice(0, 7);
  const supabase = await createClient();

  // 前後の月にはみ出す週の分も取る
  const from = addDays(`${month}-01`, -7);
  const to = addDays(`${shiftMonth(month, 1)}-01`, 7);
  const [members, eRes, pRes, cRes, payRes] = await Promise.all([
    getMembers(supabase),
    supabase.from("events").select("id,date,title,start_time,end_time,member_id,color,memo,batch_id").gte("date", from).lte("date", to),
    supabase.from("event_presets").select("id,title,start_time,end_time,member_id,color,sort").order("sort", { ascending: true }),
    supabase.from("fixed_costs").select("id,name,amount,due_day,memo,active").eq("active", true),
    supabase.from("fixed_payments").select("id,fixed_cost_id,month,amount,paid_at").eq("month", month),
  ]);
  const events = (eRes.data as unknown as EventRow[] | null) ?? [];
  const presets = (pRes.data as unknown as EventPreset[] | null) ?? [];
  const costs = (cRes.data as unknown as FixedCost[] | null) ?? [];
  const paid = new Set(((payRes.data as unknown as FixedPayment[] | null) ?? []).map((p) => p.fixed_cost_id));
  const dues: DueMark[] = costs.map((c) => ({
    date: dueDate(month, c.due_day),
    name: c.name,
    amount: c.amount,
    paid: paid.has(c.id),
  }));

  const navBtn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-sun/50 bg-[#FAF4E4]/10 text-[#FAF4E4] active:scale-95";

  return (
    <section className="space-y-4">
      <PageTitle title={fmtMonth(month)} label="CALENDAR" tone="bg-accent text-[#FAF4E4]">
        <div className="flex shrink-0 items-center gap-1.5">
          <Link href={`/calendar?m=${shiftMonth(month, -1)}`} aria-label="前の月" className={navBtn}>
            <Icon name="left" size={18} />
          </Link>
          {month !== today.slice(0, 7) && (
            <Link href="/calendar" className={`${navBtn} !w-auto px-3 text-xs font-bold`}>
              今月
            </Link>
          )}
          <Link href={`/calendar?m=${shiftMonth(month, 1)}`} aria-label="次の月" className={navBtn}>
            <Icon name="right" size={18} />
          </Link>
        </div>
      </PageTitle>

      {eRes.error ? (
        <p className="card bg-danger p-4 text-sm font-bold text-white">
          データベースの準備が終わっていません。Supabase の SQL Editor で supabase/migrations/0008_home.sql を実行してください。
        </p>
      ) : (
        <CalendarView key={month} month={month} today={today} initial={isDate(d) && d.startsWith(month) ? d : undefined} events={events} presets={presets} members={members} dues={dues} />
      )}
    </section>
  );
}
