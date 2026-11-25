"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { addEvents, deleteBatch, deleteEvent, updateEvent, type EventInput } from "@/app/(app)/calendar/actions";
import { DEFAULT_COLOR, PALETTE, onColor } from "@/lib/colors";
import { addDays, daysInMonth, fmtDayLong, fmtTimeRange, weekdayOf, yen } from "@/lib/format";
import { cheer } from "@/lib/cheer";
import { externalColor, whoOf } from "@/lib/members";
import { WhoSelect } from "./Fields";
import { Icon } from "./Icon";
import { Manul } from "./Manul";
import type { EventPreset, EventRow, ExternalEvent, Member } from "@/types/database";

export type DueMark = { date: string; name: string; amount: number; paid: boolean };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function inputOf(fd: FormData): EventInput {
  const get = (k: string) => String(fd.get(k) ?? "");
  return {
    title: get("title"),
    start_time: get("start_time"),
    end_time: get("end_time"),
    member_id: get("member_id"),
    color: get("color"),
    memo: get("memo"),
  };
}

// 時間・誰の・色・メモ（追加と編集で共通）
function DetailFields({ members, event, idPrefix }: { members: Member[]; event?: EventRow; idPrefix: string }) {
  const color = event?.color ?? DEFAULT_COLOR;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-bold text-muted">
          はじまり
          <input name="start_time" type="time" defaultValue={event?.start_time?.slice(0, 5) ?? ""} className="input mt-0.5" />
        </label>
        <label className="text-[11px] font-bold text-muted">
          おわり
          <input name="end_time" type="time" defaultValue={event?.end_time?.slice(0, 5) ?? ""} className="input mt-0.5" />
        </label>
      </div>
      <WhoSelect members={members} defaultValue={event?.member_id} />
      <input name="memo" defaultValue={event?.memo ?? ""} placeholder="メモ（場所など）" className="input" />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="色">
        {PALETTE.map((c) => (
          <label key={c.value} className="cursor-pointer">
            <input type="radio" name="color" value={c.value} defaultChecked={c.value === color} className="peer sr-only" id={`${idPrefix}-${c.value}`} />
            <span
              title={c.name}
              className="block h-7 w-7 rounded-full transition peer-checked:scale-110 peer-checked:shadow-[0_0_0_3px_rgb(var(--surface)),0_0_0_4.5px_rgb(var(--sun))]"
              style={{ background: c.value }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

// 月のカレンダー。日をタップして予定を見る・足す・直す。「まとめて選ぶ」で複数の日に同じ予定を入れられる。
export function CalendarView({
  month,
  today,
  initial,
  events,
  externals = [],
  presets,
  members,
  dues,
}: {
  month: string;
  today: string;
  initial?: string;
  events: EventRow[];
  externals?: ExternalEvent[]; // TimeTree から読み取った予定（見るだけ）
  presets: EventPreset[];
  members: Member[];
  dues: DueMark[];
}) {
  const first = `${month}-01`;
  const fallback = today.startsWith(month) ? today : first;
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<string[]>([initial ?? fallback]);
  const [editing, setEditing] = useState<string | null>(null);
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
  const extByDate = useMemo(() => {
    const map = new Map<string, ExternalEvent[]>();
    for (const e of externals) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.title.localeCompare(b.title, "ja"));
    }
    return map;
  }, [externals]);
  const dueByDate = useMemo(() => {
    const map = new Map<string, DueMark[]>();
    for (const d of dues) map.set(d.date, [...(map.get(d.date) ?? []), d]);
    return map;
  }, [dues]);

  const colorOf = (e: { color: string | null; member_id: string | null }) =>
    e.color ?? (e.member_id ? whoOf(members, e.member_id).color : DEFAULT_COLOR);

  function tap(date: string) {
    setError("");
    setEditing(null);
    if (!multi) return setSelected([date]);
    setSelected((cur) => (cur.includes(date) ? cur.filter((d) => d !== date) : [...cur, date].sort()));
  }

  function toggleMulti() {
    setError("");
    setEditing(null);
    if (multi) setSelected((cur) => [cur[0] ?? fallback]); // やめるときは1日だけ残す
    setMulti(!multi);
  }

  function add(input: EventInput, after?: () => void) {
    setError("");
    if (selected.length === 0) return setError("日付をタップして選んでください");
    start(async () => {
      const res = await addEvents(selected, input);
      if (res.error) return setError(res.error);
      after?.();
      cheer(selected.length > 1 ? `${selected.length}日ぶん、入れました` : "予定を入れました");
      if (multi) {
        setMulti(false);
        setSelected([selected[0]]);
      }
    });
  }

  const single = !multi && selected.length === 1 ? selected[0] : null;
  const dayEvents = single ? (byDate.get(single) ?? []) : [];
  const dayDues = single ? (dueByDate.get(single) ?? []) : [];
  const dayExternals = single ? (extByDate.get(single) ?? []) : [];

  return (
    <div className="space-y-5">
      {/* カレンダー本体 */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 bg-primary-deep text-center text-[11px] font-bold tracking-widest text-[#FAF4E4]/80">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-2 ${i === 0 ? "text-[#E9A3AC]" : i === 6 ? "text-[#A9BEE3]" : ""}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            const inMonth = date.startsWith(month);
            const isSelected = selected.includes(date);
            const list = byDate.get(date) ?? [];
            const ext = extByDate.get(date) ?? [];
            const due = dueByDate.get(date) ?? [];
            // マスに出せるのは2件まで。自分たちの予定を先に、残りの枠に TimeTree の予定
            const extShown = ext.slice(0, Math.max(0, 2 - list.length));
            const hidden = list.length + ext.length - Math.min(2, list.length) - extShown.length;
            const wd = i % 7;
            return (
              <button
                key={date}
                type="button"
                onClick={() => tap(date)}
                aria-pressed={isSelected}
                aria-label={fmtDayLong(date)}
                className={`relative flex min-h-[72px] flex-col items-stretch gap-0.5 border-line/70 p-[3px] text-left transition sm:min-h-[84px] sm:p-1.5 ${
                  wd < 6 ? "border-r" : ""
                } ${i < cells.length - 7 ? "border-b" : ""} ${
                  isSelected ? "z-10 bg-sun/25 outline outline-2 -outline-offset-2 outline-sun" : inMonth ? "bg-surface" : "bg-bg/70"
                }`}
              >
                <span className="flex items-center justify-between">
                  <span
                    className={`display flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[15px] leading-none ${
                      date === today
                        ? "bg-primary text-sun"
                        : !inMonth
                          ? "text-faint"
                          : wd === 0
                            ? "text-danger"
                            : wd === 6
                              ? "text-accent"
                              : "text-ink"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  {due.length > 0 && (
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        due.every((d) => d.paid) ? "bg-line/60 text-faint" : "bg-danger text-white"
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
                    className={`overflow-hidden whitespace-nowrap rounded-[4px] px-[3px] text-[10px] font-bold leading-[15px] sm:truncate sm:px-1 sm:text-[11px] ${inMonth ? "" : "opacity-50"}`}
                    style={{ background: colorOf(e), color: onColor(colorOf(e)) }}
                  >
                    {e.title}
                  </span>
                ))}
                {extShown.map((e) => {
                  const c = externalColor(members, e);
                  return (
                    <span
                      key={e.id}
                      className={`overflow-hidden whitespace-nowrap rounded-[4px] px-[3px] text-[10px] font-bold leading-[15px] sm:truncate sm:px-1 sm:text-[11px] ${inMonth ? "" : "opacity-50"}`}
                      style={{ background: c, color: onColor(c) }}
                    >
                      {e.title}
                    </span>
                  );
                })}
                {hidden > 0 && <span className="text-[10px] font-bold leading-none text-muted">+{hidden}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 選んだ日 */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="display text-[20px] text-ink sm:text-[22px]">
          {multi ? (selected.length ? `${selected.length}日を選択中` : "日付をタップ") : single ? fmtDayLong(single) : ""}
        </h2>
        <button
          type="button"
          onClick={toggleMulti}
          className={`btn-ghost !px-3.5 !py-1.5 !text-xs ${multi ? "!border-primary !bg-primary !text-[#FAF4E4]" : ""}`}
        >
          <Icon name={multi ? "close" : "calendar"} size={14} />
          {multi ? "やめる" : "まとめて選ぶ"}
        </button>
      </div>

      {multi && (
        <p className="rounded-2xl border border-dashed border-sun bg-sun/10 px-4 py-3 text-xs leading-relaxed text-ink">
          上のカレンダーで日付をいくつでもタップして選んでください。下から予定を入れると、選んだ日すべてに入ります。
          {selected.length > 0 && (
            <span className="display mt-1 block text-sm">{selected.map((d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`).join("・")}</span>
          )}
        </p>
      )}

      {single && (dayEvents.length > 0 || dayDues.length > 0 || dayExternals.length > 0) && (
        <ul className="space-y-2">
          {dayDues.map((d) => (
            <li key={d.name} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  d.paid ? "bg-line/60 text-faint" : "bg-danger text-white"
                }`}
              >
                ¥
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{d.name}の支払い</span>
              <span className="display text-sm">{yen(d.amount)}</span>
              <span className="text-[11px] font-bold text-muted">{d.paid ? "済み" : "まだ"}</span>
            </li>
          ))}
          {dayEvents.map((e) => (
            <li key={e.id} className="overflow-hidden rounded-2xl border border-line bg-surface shadow-hard-sm">
              <div className="flex items-stretch">
                <span className="w-1.5 shrink-0" style={{ background: colorOf(e) }} />
                <button
                  type="button"
                  onClick={() => setEditing(editing === e.id ? null : e.id)}
                  className="min-w-0 flex-1 px-3.5 py-2.5 text-left"
                  aria-expanded={editing === e.id}
                >
                  <p className="text-[15px] font-bold leading-snug text-ink">{e.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    {e.start_time && <span className="font-bold">{fmtTimeRange(e.start_time, e.end_time)}</span>}
                    <span>{whoOf(members, e.member_id).name}</span>
                    {e.memo && <span>{e.memo}</span>}
                  </p>
                </button>
                <span className="flex shrink-0 items-center pr-3 text-faint">
                  <Icon name={editing === e.id ? "close" : "edit"} size={15} />
                </span>
              </div>
              {editing === e.id && (
                <form
                  method="post"
                  onSubmit={(ev) => {
                    ev.preventDefault();
                    const input = inputOf(new FormData(ev.currentTarget));
                    setError("");
                    start(async () => {
                      const res = await updateEvent(e.id, input);
                      if (res.error) return setError(res.error);
                      setEditing(null);
                      cheer("直しました");
                    });
                  }}
                  className="space-y-3 border-t border-line bg-bg/60 p-3.5"
                >
                  <input name="title" required defaultValue={e.title} aria-label="予定の名前" className="input" />
                  <DetailFields members={members} event={e} idPrefix={`edit-${e.id}`} />
                  <button type="submit" disabled={pending} className="btn-primary w-full">
                    保存する
                  </button>
                  <div className="flex items-center justify-center gap-4 text-xs font-bold">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm(`「${e.title}」を消しますか？`)) start(() => deleteEvent(e.id));
                      }}
                      className="text-danger"
                    >
                      この予定を消す
                    </button>
                    {e.batch_id && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`「${e.title}」を、まとめて入れたほかの日の分も全部消しますか？`)) start(() => deleteBatch(e.batch_id!));
                        }}
                        className="text-danger"
                      >
                        ほかの日の分も全部消す
                      </button>
                    )}
                  </div>
                </form>
              )}
            </li>
          ))}
          {dayExternals.map((e) => (
            <li key={e.id} className="flex items-stretch overflow-hidden rounded-2xl border border-line bg-surface shadow-hard-sm">
              <span className="w-1.5 shrink-0" style={{ background: externalColor(members, e) }} />
              <div className="min-w-0 flex-1 px-3.5 py-2.5">
                <p className="text-[15px] font-bold leading-snug text-ink">{e.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {e.start_time && <span className="font-bold">{fmtTimeRange(e.start_time, e.end_time)}</span>}
                  {e.author_name && <span>{e.author_name}</span>}
                  <span className="chip bg-line/50 !py-0 text-muted">TimeTree{e.calendar_name ? `・${e.calendar_name}` : ""}</span>
                  {e.memo && <span>{e.memo}</span>}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {single && dayEvents.length === 0 && dayDues.length === 0 && dayExternals.length === 0 && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
          <Manul variant="peek" className="h-9 w-auto" />
          <p className="text-sm text-muted">この日の予定はまだありません</p>
        </div>
      )}

      {error && <p className="rounded-2xl bg-danger px-4 py-2.5 text-sm font-bold text-white">{error}</p>}

      {/* 追加 */}
      <div className="card space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="display text-base text-ink">{multi ? `選んだ${selected.length}日に入れる` : "この日に入れる"}</h3>
          <Link href="/settings#presets" className="shrink-0 text-xs font-bold text-muted underline decoration-sun underline-offset-4">
            よく使う予定を編集
          </Link>
        </div>

        {/* よく使う予定：タップするだけで入る */}
        {presets.length > 0 ? (
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
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold shadow-hard-sm transition active:scale-95 disabled:opacity-60"
                style={{ background: colorOf(p), color: onColor(colorOf(p)) }}
              >
                <Icon name="plus" size={14} />
                {p.title}
                {p.start_time && <span className="text-[11px] font-normal opacity-80">{fmtTimeRange(p.start_time, p.end_time)}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-muted">
            仕事・デート・ジムなど、よく入れる予定を登録しておくと、ここにボタンが並んでワンタップで入れられます。
          </p>
        )}

        <div className="rule" />

        {/* 自由に入力：名前だけでも入る */}
        <form
          ref={formRef}
          method="post"
          onSubmit={(ev) => {
            ev.preventDefault();
            add(inputOf(new FormData(ev.currentTarget)), () => formRef.current?.reset());
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <input name="title" required placeholder="予定の名前を入力" className="input flex-1" />
            <button type="submit" disabled={pending} className="btn-primary shrink-0 !px-4">
              {pending ? "…" : "追加"}
            </button>
          </div>
          <details>
            <summary className="cursor-pointer text-xs font-bold text-muted">時間・誰の予定か・色・メモも入れる</summary>
            <div className="mt-3">
              <DetailFields members={members} idPrefix="new" />
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}
