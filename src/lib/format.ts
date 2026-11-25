// 日付とお金の表示・計算。日付は "YYYY-MM-DD"、月は "YYYY-MM" の文字列で扱い、すべて日本時間。

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

export function todayJST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

export const isMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// 日付の計算は UTC の真夜中として行う（端末のタイムゾーンに左右されないように）
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

// a − b の日数
export function diffDays(a: string, b: string): number {
  return Math.round((utc(a).getTime() - utc(b).getTime()) / 86400000);
}

export const weekdayOf = (date: string): number => utc(date).getUTCDay();

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// 支払日（1〜31）をその月の実在する日付にする。31 日が無い月は月末になる
export function dueDate(month: string, day: number): string {
  return `${month}-${String(Math.min(day, daysInMonth(month))).padStart(2, "0")}`;
}

// "2026-11" → "2026年11月"
export function fmtMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}年${m}月`;
}

// "2026-11-25" → "11/25(水)"
export function fmtDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}/${d}(${WEEK[weekdayOf(date)]})`;
}

// "2026-11-25" → "11月25日(水)"
export function fmtDayLong(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日(${WEEK[weekdayOf(date)]})`;
}

// "09:30:00" → "9:30"
export function fmtTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

export function fmtTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  return end ? `${fmtTime(start)}〜${fmtTime(end)}` : fmtTime(start);
}

// マイナスは「−¥1,000」と、記号を前に出す
export const yen = (n: number): string => `${n < 0 ? "−" : ""}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;
