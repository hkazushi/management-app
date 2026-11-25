"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { addEvents, deleteBatch, deleteEvent, type EventInput } from "@/app/(app)/calendar/actions";
import { DEFAULT_COLOR, PALETTE, onColor } from "@/lib/colors";
import { addDays, daysInMonth, fmtDayLong, fmtTimeRange, weekdayOf, yen } from "@/lib/format";
import { whoOf } from "@/lib/members";
import { Icon } from "./Icon";
import type { EventPreset, EventRow, Member } from "@/types/database";

export type DueMark = { date: string; name: string; amount: number; paid: boolean };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

// 月のカレンダー。日をタップして予定を見る・足す。「まとめて選ぶ」で複数の日に同じ予定を入れられる。
export function CalendarView({
  month,
  today,
  events,
  presets,
  members,
  dues,
}: {
  month: string;
  today: string;
  events: EventRow[];
  presets: EventPreset[];
  members: Member[];
  dues: DueMark[];
}) {
  const first = `${month}-01`;
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<string[]>([today.startsWith(month) ? today : first]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // 日曜はじまりで、その月が入る週だけ並べる
  const cells = useMemo(() => {
    const lead = weekdayOf(first);
    const weeks = Math.ceil((lead + daysInMonth(month)) / 7);
    const gridStart = addDays(first, -lead);
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  }, [first, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99") || a.title.localeCompare(b.title, "ja"));
    }
    return map;
  }, [events]);
  const dueByDate = useMemo(() => {
    const map = new Map<string, DueMark[]>();
    for (const d of dues) map.set(d.date, [...(map.get(d.date) ?? []), d]);
    return map;
  }, [dues]);

  const colorOf = (e: { color: string | null; member_id: string | null }) =>
    e.color ?? (e.member_id ? whoOf(members, e.member_id).color : DEFAULT_COLOR);

  function tap(date: string) {
    setError("");
    if (!multi) return setSelected([date]);
    setSelected((cur) => (cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date].sort()));
  }

  function toggleMulti() {
    setError("");
    setMulti((m) => {
      // やめるときは1日だけ残す
      if (m) setSelected((cur) => [cur[0] ?? (today.startsWith(month) ? today : first)]);
      return !m;
    });
  }

  function add(input: EventInput, after?: () => void) {
    setError("");
    if (selected.length === 0) return setError("日付をタップして選んでください");
    start(async () => {
      const res = await addEvents(selected, input);
      if (res.error) return setError(res.error);
      after?.();
      if (multi) {
        setMulti(false);
        setSelected([selected[0]]);
      }
    });
  }

  const single = !multi && selected.length === 1 ? selected[0] : null;
  const dayEvents = single ? (byDate.get(single) ?? []) : [];
  const dayDues = single ? (dueByDate.get(single) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* カレンダー本体 */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b-2 border-ink bg-ink text-center text-[11px] font-black text-[#FFF4E0]">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 ? "text-[#FF9C8A]" : i === 6 ? "text-[#9DB4FF]" : ""}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const inMonth = date.startsWith(month);
            const isSelected = selected.includes(date);
            const list = byDate.get(date) ?? [];
            const due = dueByDate.get(date) ?? [];
            const wd = i % 7;
            return (
              <button
                key={date}
                type="button"
                onClick={() => tap(date)}
                aria-pressed={isSelected}
                aria-label={fmtDayLong(date)}
                className={`relative flex min-h-[74px] flex-col items-stretch gap-0.5 border-ink/15 p-1 text-left transition ${
                  wd < 6 ? "border-r" : ""
                } ${i < cells.length - 7 ? "border-b" : ""} ${
                  isSelected ? "z-10 bg-sun outline outline-2 -outline-offset-2 outline-ink" : inMonth ? "bg-surface" : "bg-bg"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`display flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] leading-none ${
                      date === today
                        ? "bg-primary text-white"
                        : !inMonth
                          ? "text-faint"
                          : wd === 0
                            ? "text-primary"
                            : wd === 6
                              ? "text-accent"
                              : "text-ink"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {due.length > 0 && (
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border border-ink text-[9px] font-black ${
                        due.every((d) => d.paid) ? "bg-surface text-faint" : "bg-mint text-ink"
                      }`}
                      title="支払い"
                    >
                      ¥
                    </span>
                  )}
                </span>
                {list.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className={`truncate rounded-[5px] border border-ink px-1 text-[10px] font-bold leading-[15px] ${inMonth ? "" : "opacity-50"}`}
                    style={{ background: colorOf(e), color: onColor(colorOf(e)) }}
                  >
                    {e.title}
                  </span>
                ))}
                {list.length > 2 && <span className="text-[10px] font-black leading-none text-muted">+{list.length - 2}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選んだ日 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="display text-[19px] text-ink">
          {multi ? (selected.length ? `${selected.length}日を選択中` : "日付をタップ") : single ? fmtDayLong(single) : ""}
        </h2>
        <button
          type="button"
          onClick={toggleMulti}
          className={`btn-ghost !px-3 !py-1.5 !text-xs ${multi ? "!bg-ink !text-[#FFF4E0]" : ""}`}
        >
          <Icon name={multi ? "close" : "plus"} size={14} />
          {multi ? "まとめ選びをやめる" : "まとめて選ぶ"}
        </button>
      </div>

      {multi && (
        <p className="rounded-xl border-2 border-dashed border-ink bg-surface px-3 py-2 text-xs font-bold text-muted">
          カレンダーの日付をいくつでもタップして選び、下から予定を入れると、選んだ日すべてに入ります。
          {selected.length > 0 && (
            <span className="mt-1 block text-ink">{selected.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`).join("・")}</span>
          )}
        </p>
      )}

      {single && (dayEvents.length > 0 || dayDues.length > 0) && (
        <ul className="space-y-2">
          {dayDues.map((d) => (
            <li key={d.name} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-mint/30 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-mint text-xs font-black">¥</span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {d.name}の支払い {yen(d.amount)}
              </span>
              <span className="text-xs font-black text-muted">{d.paid ? "済み" : "まだ"}</span>
            </li>
          ))}
          {dayEvents.map((e) => (
            <li key={e.id} className="flex items-stretch overflow-hidden rounded-2xl border-2 border-ink bg-surface shadow-hard-sm">
              <span className="w-3 shrink-0 border-r-2 border-ink" style={{ background: colorOf(e) }} />
              <div className="min-w-0 flex-1 px-3 py-2">
                <p className="text-[15px] font-black leading-snug text-ink">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-bold text-muted">
                  {e.start_time && <span>{fmtTimeRange(e.start_time, e.end_time)}</span>}
                  <span>{whoOf(members, e.member_id).name}</span>
                  {e.memo && <span className="font-medium">{e.memo}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 pr-2">
                {e.batch_id && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`「${e.title}」を、まとめて入れたほかの日の分も全部消しますか？`)) start(() => deleteBatch(e.batch_id!));
                    }}
                    className="rounded-lg px-1.5 py-1 text-[11px] font-black text-muted hover:text-danger"
                  >
                    全部消す
                  </button>
                )}
                <button
                  type="button"
                  aria-label="この予定を消す"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm(`「${e.title}」を消しますか？`)) start(() => deleteEvent(e.id));
                  }}
                  className="rounded-lg p-1.5 text-muted hover:text-danger"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {single && dayEvents.length === 0 && dayDues.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-ink/40 px-3 py-3 text-center text-sm font-bold text-muted">この日の予定はまだありません</p>
      )}

      {error && <p className="rounded-xl border-2 border-ink bg-danger px-3 py-2 text-sm font-black text-white">{error}</p>}

      {/* よく使う予定：タップするだけで入る */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="display text-sm text-ink">よく使う予定をワンタップ</h3>
          <Link href="/settings#presets" className="text-xs font-black text-accent underline decoration-2 underline-offset-2">
            編集
          </Link>
        </div>
        {presets.length === 0 ? (
          <p className="text-xs font-bold text-muted">
            まだありません。「編集」から、仕事・デート・ジムなどを登録しておくと、ここに並びます。
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() =>
                  add({
                    title: p.title,
                    start_time: p.start_time ?? "",
                    end_time: p.end_time ?? "",
                    member_id: p.member_id ?? "",
                    color: p.color ?? "",
                    memo: "",
                  })
                }
                className="flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1.5 text-sm font-black shadow-hard-sm transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-60"
                style={{ background: colorOf(p), color: onColor(colorOf(p)) }}
              >
                <Icon name="plus" size={14} />
                {p.title}
                {p.start_time && <span className="text-[11px] font-bold opacity-80">{fmtTimeRange(p.start_time, p.end_time)}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 自由に入力 */}
      <form
        ref={formRef}
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          add(
            {
              title: String(fd.get("title") ?? ""),
              start_time: String(fd.get("start_time") ?? ""),
              end_time: String(fd.get("end_time") ?? ""),
              member_id: String(fd.get("member_id") ?? ""),
              color: String(fd.get("color") ?? ""),
              memo: String(fd.get("memo") ?? ""),
            },
            () => formRef.current?.reset(),
          );
        }}
        className="card space-y-3 p-4"
      >
        <h3 className="display text-sm text-ink">自由に入力</h3>
        <input name="title" required placeholder="予定の名前" className="input" />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-black text-muted">
            はじまり
            <input name="start_time" type="time" className="input mt-0.5" />
          </label>
          <label className="text-[11px] font-black text-muted">
            おわり
            <input name="end_time" type="time" className="input mt-0.5" />
          </label>
        </div>
        <div className="grid grid-cols-[7rem_1fr] gap-2">
          <select name="member_id" defaultValue="" aria-label="誰の" className="input">
            <option value="">ふたり</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
          <input name="memo" placeholder="メモ（場所など）" className="input" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="色">
          {PALETTE.map((c, i) => (
            <label key={c.value} className="cursor-pointer">
              <input type="radio" name="color" value={c.value} defaultChecked={i === 2} className="peer sr-only" />
              <span
                title={c.name}
                className="block h-8 w-8 rounded-full border-2 border-ink transition peer-checked:scale-110 peer-checked:shadow-[0_0_0_3px_#fff,0_0_0_5px_rgb(var(--ink))]"
                style={{ background: c.value }}
              />
            </label>
          ))}
        </div>
        <button type="submit" disabled={pending} className="btn-primary w-full !py-3">
          <Icon name="plus" size={16} />
          {pending ? "追加中…" : multi ? `選んだ${selected.length}日にまとめて追加` : "この日に追加"}
        </button>
      </form>
    </div>
  );
}
