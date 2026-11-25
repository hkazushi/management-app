// このアプリの予定を iCal（.ics）の文字列にする。iPhone のカレンダーなどが読む形式。

export type FeedEvent = {
  id: string;
  date: string; // YYYY-MM-DD（日本時間）
  title: string;
  start_time: string | null; // HH:MM:SS
  end_time: string | null;
  memo: string | null;
  member_name: string | null;
  created_at: string;
};

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (date: string) => date.replace(/-/g, "");

// 日本時間の日付と時刻を、UTC の "YYYYMMDDTHHMMSSZ" にする（日本は夏時間が無いので 9 時間引くだけ）
function utcStamp(date: string, time: string): string {
  const d = new Date(`${date}T${time.slice(0, 5)}:00+09:00`);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// 1行は 75 バイトまで、という決まりに合わせて折り返す（続きの行は空白で始める）
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length === 0 ? 75 : 74)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function toICal(events: FeedEvent[], name: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Futari Techo//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:Asia/Tokyo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.id}@futari-techo`, `DTSTAMP:${now}`);
    if (e.start_time) {
      // 終わりが無い、または始まりより前なら 1 時間の予定として出す
      const end = e.end_time && e.end_time > e.start_time ? e.end_time : null;
      lines.push(`DTSTART:${utcStamp(e.date, e.start_time)}`);
      if (end) lines.push(`DTEND:${utcStamp(e.date, end)}`);
      else lines.push("DURATION:PT1H");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compact(e.date)}`, `DTEND;VALUE=DATE:${compact(nextDay(e.date))}`);
    }
    lines.push(`SUMMARY:${esc(e.member_name ? `${e.title}（${e.member_name}）` : e.title)}`);
    if (e.memo) lines.push(`DESCRIPTION:${esc(e.memo)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
