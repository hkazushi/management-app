#!/usr/bin/env node
// ============================================================
// timetree-sync — TimeTree のカレンダー（例: 家族）を読み取って、ふたり手帖に「見るだけの予定」として入れる。
//
//   timetree-sync --check     ログインできるか試し、カレンダーの名前を一覧する（何も書き込まない）
//   timetree-sync             読み取って、ふたり手帖の external_events を入れ替える
//   timetree-sync --dry       読み取って件数だけ出す（書き込まない）
//
//   timetree-sync --dry は、書き込みについても「何をするつもりか」だけを出す
//
// 書き込み（ふたり手帖 → TimeTree。TIMETREE_WRITE=true のときだけ）:
//   - TIMETREE_WRITE_SINCE 以降にふたり手帖で作った予定を、TIMETREE_WRITE_CALENDAR のカレンダーに入れる
//   - ふたり手帖で直せば TimeTree も直し、消せば TimeTree も消す（対応表 timetree_links で追いかける）
//   - 自分が書き込んだ予定は、読み取りのときには取り込まない（二重に出さない）
//   - 1回の実行で新しく入れるのは最大 20 件（何かの間違いで大量に入るのを防ぐ）
//   - ふたり手帖で「消す」と頼まれた TimeTree の予定（external_events.delete_requested_at）を、TimeTree から消す。
//     くり返しの予定は全部消えてしまうので消さない
//
// 大事なこと:
//   - TimeTree には公式の連携手段が無い（API は 2023-12-22 に終了）。これは TimeTree の Web 版と同じ通信を
//     まねる非公式の方法で、TimeTree の仕様変更で突然動かなくなることがある。
//   - TIMETREE_WRITE を true にしないかぎり読むだけで、TimeTree 側には何も書き込まない。
//   - TimeTree のパスワードは、このMacの設定ファイルにだけ置く。ふたり手帖のサーバーや DB には送らない。
//   - ログインは使い回す（毎回ログインすると制限にかかるため）。
//
// 設定:
//   ~/.config/futari-techo/timetree.env  （自分で作る。chmod 600）
//       TIMETREE_EMAIL=...
//       TIMETREE_PASSWORD=...
//       TIMETREE_SESSION=...            ← Apple / Google でサインインしていてパスワードが無い場合は、こちらだけ書く。
//                                         ブラウザで TimeTree にログインした状態の Cookie「_session_id」の値
//       TIMETREE_CALENDAR=家族          ← 読み取るカレンダーの名前（一部でも可。カンマ区切りで複数）
//       TIMETREE_SHARED=false           ← true にすると、ふたり手帖のもう1人にも見える
//       TIMETREE_WRITE=false            ← true にすると、ふたり手帖の予定を TimeTree に書き込む
//       TIMETREE_WRITE_CALENDAR=家族    ← 書き込み先のカレンダーの名前
//       TIMETREE_WRITE_SINCE=2026-11-25T10:00:00Z  ← これ以降に作った予定だけ書き込む
//   ~/.claude/hooks/management-app.env   （既存。SUPABASE_URL / SUPABASE_SERVICE_KEY / MANAGEMENT_USER_ID）
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const CONF_DIR = path.join(os.homedir(), ".config", "futari-techo");
const CONF_FILE = path.join(CONF_DIR, "timetree.env");
const SESSION_FILE = path.join(CONF_DIR, "timetree-session.json");
const LOG_FILE = path.join(CONF_DIR, "timetree-sync.log");
const APP_ENV = path.join(os.homedir(), ".claude", "hooks", "management-app.env");

const API = "https://timetreeapp.com/api/v1";
const HEADERS = { "Content-Type": "application/json", "X-Timetreea": "web/2.1.0/ja" };
const PAST_DAYS = 31; // これより前の予定は入れない
const FUTURE_DAYS = 366; // これより先の予定は入れない
const DAY = 86400000;
const WEB = "https://timetreeapp.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MAX_CREATES = 20; // 1回の実行で TimeTree に新しく入れる上限

function loadEnv(file) {
  const env = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch {
    // 無ければ空（呼び出し側で案内を出す）
  }
  return env;
}

function log(msg) {
  try {
    fs.mkdirSync(CONF_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // ログが書けなくても続ける
  }
}

// ---------- TimeTree ----------

async function login(email, password) {
  const res = await fetch(`${API}/auth/email/signin`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ uid: email, password, uuid: randomUUID().replace(/-/g, "") }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    let code = null;
    try {
      code = (await res.json())?.error?.code ?? null;
    } catch {
      // 本文が JSON でない
    }
    if (code === -702) throw new Error("TimeTree にログインできません：メールアドレスかパスワードが違います");
    if (code === -495) throw new Error("TimeTree にログインできません：回数の制限にかかっています。しばらく待ってください");
    throw new Error(`TimeTree にログインできません（HTTP ${res.status}）`);
  }
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).find((c) => c.startsWith("_session_id="));
  if (!cookie) throw new Error("TimeTree のログインは通りましたが、セッションを受け取れませんでした");
  return cookie.slice("_session_id=".length);
}

async function tt(sessionId, pathAndQuery) {
  const res = await fetch(`${API}/${pathAndQuery}`, {
    headers: { ...HEADERS, Cookie: `_session_id=${sessionId}` },
    signal: AbortSignal.timeout(30000),
  });
  if (res.status === 401 || res.status === 403) {
    const e = new Error("TimeTree のログインが切れています");
    e.expired = true;
    throw e;
  }
  if (!res.ok) throw new Error(`TimeTree の読み取りに失敗しました（${pathAndQuery.split("?")[0]} → HTTP ${res.status}）`);
  return res.json();
}

// 保存してあるログインを使い、切れていたらログインし直す
async function withSession(conf, fn) {
  let saved = null;
  try {
    saved = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8")).sessionId;
  } catch {
    // まだ無い
  }
  if (saved) {
    try {
      return await fn(saved);
    } catch (e) {
      if (!e.expired) throw e;
    }
  }
  // パスワードが無い（Apple / Google でサインイン）ときは、ブラウザから写したセッションを使う
  if (conf.TIMETREE_SESSION) {
    try {
      return await fn(conf.TIMETREE_SESSION);
    } catch (e) {
      if (!e.expired) throw e;
      throw new Error("TimeTree のセッションが切れています。ブラウザで TimeTree にログインし直して、設定ファイルの TIMETREE_SESSION を新しい値に書き換えてください");
    }
  }
  const sessionId = await login(conf.TIMETREE_EMAIL, conf.TIMETREE_PASSWORD);
  fs.mkdirSync(CONF_DIR, { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ sessionId, at: new Date().toISOString() }), { mode: 0o600 });
  return fn(sessionId);
}

async function fetchEvents(sessionId, calendarId) {
  const all = [];
  let since = 0;
  for (let i = 0; i < 200; i++) {
    const r = await tt(sessionId, `calendar/${calendarId}/events/sync?since=${since}`);
    all.push(...(r.events ?? []));
    if (r.chunk !== true) break;
    since = r.since;
  }
  return all;
}

// 書き込みには、ログイン済みのページに埋まっている合言葉（CSRF トークン）が要る
async function csrfToken(sessionId) {
  const res = await fetch(`${WEB}/calendars`, { headers: { Cookie: `_session_id=${sessionId}`, "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  const token = (await res.text()).match(/<meta name="csrf-token" content="([^"]+)"/)?.[1];
  if (!res.ok || !token) throw new Error("TimeTree の書き込み用の合言葉を取得できませんでした（ログインが切れているかもしれません）");
  return token;
}

async function ttWrite(sessionId, csrf, method, pathAndQuery, body) {
  const res = await fetch(`${API}/${pathAndQuery}`, {
    method,
    headers: {
      ...HEADERS,
      "X-CSRF-Token": csrf,
      Cookie: `_session_id=${sessionId}`,
      "User-Agent": UA,
      Origin: WEB,
      Referer: `${WEB}/calendars`,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) {
    const e = new Error(`TimeTree への書き込みに失敗しました（${method} → HTTP ${res.status}）`);
    e.status = res.status;
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ふたり手帖の予定1件を、TimeTree に送る形に直す
export function toTimeTree(ev, { users, labels }) {
  const who = ev.member_name ? users.filter((u) => u.name === ev.member_name) : users; // 「ふたり」は全員
  const attendees = (who.length ? who : users).map((u) => u.id);
  const label_id = (ev.member_name && labels.get(ev.member_name)) || labels.get("") || 1;
  const base = { title: ev.title, label_id, note: ev.memo || "", alerts: [], attendees, virtual_user_attendees: [], recurrences: [], file_uuids: [] };
  if (!ev.start_time) {
    // 終日は UTC の 0 時で持つ（TimeTree の決まり）
    const at = Date.parse(`${ev.date}T00:00:00Z`);
    return { ...base, all_day: true, start_at: at, end_at: at, start_timezone: "UTC", end_timezone: "UTC" };
  }
  const start = Date.parse(`${ev.date}T${ev.start_time.slice(0, 5)}:00+09:00`);
  const endOk = ev.end_time && ev.end_time > ev.start_time;
  const end = endOk ? Date.parse(`${ev.date}T${ev.end_time.slice(0, 5)}:00+09:00`) : start + 3600000;
  return { ...base, all_day: false, start_at: start, end_at: end, start_timezone: "Asia/Tokyo", end_timezone: "Asia/Tokyo" };
}

// ---------- 日付まわり ----------

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fromYmd = (s) => new Date(`${s}T00:00:00Z`);
const addDays = (s, n) => ymd(new Date(fromYmd(s).getTime() + n * DAY));
// ミリ秒 → 日本時間の { date, time }
function jst(ms) {
  const d = new Date(ms + 9 * 3600000);
  return { date: ymd(d), time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
}

// くり返しの決まり（RRULE）から、範囲内の開始日を出す。対応していない書き方は最初の1回だけにする
export function occurrences(startDate, recurrences, from, to) {
  const rule = (recurrences ?? []).find((r) => /^RRULE/i.test(r));
  if (!rule) return [startDate];
  const p = Object.fromEntries(
    rule
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((kv) => kv.split("="))
      .filter((kv) => kv.length === 2)
      .map(([k, v]) => [k.toUpperCase(), v]),
  );
  const interval = Math.max(1, Number(p.INTERVAL) || 1);
  const count = p.COUNT ? Number(p.COUNT) : Infinity;
  const until = p.UNTIL ? `${p.UNTIL.slice(0, 4)}-${p.UNTIL.slice(4, 6)}-${p.UNTIL.slice(6, 8)}` : "9999-12-31";
  const excluded = new Set();
  for (const r of recurrences ?? []) {
    if (!/^EXDATE/i.test(r)) continue;
    for (const v of r.split(":").pop().split(",")) {
      const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z)?/);
      if (!m) continue;
      // 時刻つき（UTC）は日本時間の日付に直す
      excluded.add(m[4] ? jst(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).date : `${m[1]}-${m[2]}-${m[3]}`);
    }
  }

  const out = [];
  let made = 0;
  const push = (date) => {
    if (date < startDate || date > until || made >= count) return false;
    made += 1;
    if (!excluded.has(date) && date >= from && date <= to) out.push(date);
    return true;
  };
  const start = fromYmd(startDate);
  const stop = to < until ? to : until;
  const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  if (p.FREQ === "DAILY") {
    for (let d = startDate, i = 0; d <= stop && made < count && i < 5000; d = addDays(d, interval), i++) push(d);
  } else if (p.FREQ === "WEEKLY") {
    const wanted = p.BYDAY ? p.BYDAY.split(",").map((x) => DAYS.indexOf(x.slice(-2))).filter((x) => x >= 0) : [start.getUTCDay()];
    const weekStart = addDays(startDate, -start.getUTCDay()); // その週の日曜
    for (let w = weekStart, i = 0; w <= stop && made < count && i < 2000; w = addDays(w, 7 * interval), i++) {
      for (const wd of [...wanted].sort((a, b) => a - b)) push(addDays(w, wd));
    }
  } else if (p.FREQ === "MONTHLY" || p.FREQ === "YEARLY") {
    // 「第2月曜」のような指定は未対応。同じ日付のくり返しとして扱う
    const day = p.BYMONTHDAY && /^\d+$/.test(p.BYMONTHDAY) ? Number(p.BYMONTHDAY) : start.getUTCDate();
    const step = p.FREQ === "YEARLY" ? 12 * interval : interval;
    for (let i = 0; i < 1500 && made < count; i++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i * step, day));
      if (d.getUTCDate() !== day) continue; // その月に無い日（31日など）は飛ばす
      const s = ymd(d);
      if (s > stop) break;
      push(s);
    }
  } else {
    return [startDate];
  }
  return out;
}

// TimeTree の予定1件を、ふたり手帖の行（1日1行）に直す
export function toRows(ev, calendarName, from, to, lookup = {}) {
  if (!ev || ev.deactivated_at || ev.category === 2 || !ev.title || typeof ev.start_at !== "number") return []; // 2 はメモ
  const rows = [];
  if (ev.all_day) {
    // 終日は UTC の 0 時で入っている。end_at は最後の日（その日を含む）
    const first = ymd(new Date(ev.start_at));
    const last = typeof ev.end_at === "number" && ev.end_at >= ev.start_at ? ymd(new Date(ev.end_at)) : first;
    const span = Math.min(60, Math.round((fromYmd(last) - fromYmd(first)) / DAY));
    for (const start of occurrences(first, ev.recurrences, addDays(from, -span), to)) {
      for (let i = 0; i <= span; i++) {
        const date = addDays(start, i);
        if (date < from || date > to) continue;
        rows.push({ uid: `${ev.uuid}:${date}`, date, title: ev.title, start_time: null, end_time: null });
      }
    }
  } else {
    const s = jst(ev.start_at);
    const e = typeof ev.end_at === "number" ? jst(ev.end_at) : null;
    const sameDay = e && e.date === s.date && e.time > s.time;
    for (const date of occurrences(s.date, ev.recurrences, from, to)) {
      if (date < from || date > to) continue;
      rows.push({ uid: `${ev.uuid}:${date}`, date, title: ev.title, start_time: s.time, end_time: sameDay ? e.time : null });
    }
  }
  const memo = [ev.location, ev.note].filter((x) => typeof x === "string" && x.trim()).join(" / ").slice(0, 300) || null;
  // 誰が入れたか（メンバー名）と、TimeTree 上の色
  const author_name = lookup.users?.get(String(ev.author_id)) ?? null;
  const label_color = lookup.labels?.get(Number(ev.label_id)) ?? null;
  const recurring = (ev.recurrences ?? []).some((r) => /^RRULE/i.test(r));
  return rows.map((r) => ({ ...r, memo, calendar_name: calendarName, author_name, label_color, recurring }));
}

// ---------- ふたり手帖（Supabase） ----------

function restOf(app) {
  return async (method, pathAndQuery, body, prefer = "return=minimal") => {
    const res = await fetch(`${app.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      method,
      headers: {
        apikey: app.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${app.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: prefer,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`ふたり手帖とのやり取りに失敗しました（${method} ${pathAndQuery.split("?")[0]} → ${res.status} ${text.slice(0, 160)}）`);
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  const check = process.argv.includes("--check");
  const dry = process.argv.includes("--dry");
  // 設定ファイルの値。同じ名前の環境変数があれば、そちらを優先する（動作確認で一時的に変えるため）
  const conf = loadEnv(CONF_FILE);
  for (const k of ["TIMETREE_WRITE", "TIMETREE_WRITE_CALENDAR", "TIMETREE_WRITE_SINCE", "TIMETREE_CALENDAR"]) {
    if (process.env[k] !== undefined) conf[k] = process.env[k];
  }
  const app = loadEnv(APP_ENV);
  if (!conf.TIMETREE_SESSION && (!conf.TIMETREE_EMAIL || !conf.TIMETREE_PASSWORD)) {
    throw new Error(`設定ファイルに TIMETREE_EMAIL と TIMETREE_PASSWORD（または TIMETREE_SESSION）を書いてください: ${CONF_FILE}`);
  }

  const calendars = await withSession(conf, (sid) => tt(sid, "calendars?since=0").then((r) => r.calendars ?? []));
  const active = calendars.filter((c) => !c.deactivated_at);
  if (check) {
    console.log("TimeTree にログインできました。カレンダー:");
    for (const c of active) console.log(`  ・${c.name}`);
    console.log(`\n読み取る対象（TIMETREE_CALENDAR）: ${conf.TIMETREE_CALENDAR || "（未設定）"}`);
    console.log(
      /^(true|1|yes)$/i.test(conf.TIMETREE_WRITE || "")
        ? `書き込み: する → 「${conf.TIMETREE_WRITE_CALENDAR || "（未設定）"}」（${conf.TIMETREE_WRITE_SINCE || "開始時刻が未設定"} 以降に作った予定）`
        : "書き込み: しない（読むだけ）",
    );
    return;
  }

  const wanted = (conf.TIMETREE_CALENDAR || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (wanted.length === 0) throw new Error("設定ファイルに TIMETREE_CALENDAR（読み取るカレンダーの名前）を書いてください");
  const targets = active.filter((c) => wanted.some((w) => String(c.name).includes(w)));
  if (targets.length === 0) throw new Error(`「${wanted.join("」「")}」に当てはまるカレンダーがありません（--check で名前を確認できます）`);

  // ---------- 書き込み（ふたり手帖 → TimeTree） ----------
  const writing = /^(true|1|yes)$/i.test(conf.TIMETREE_WRITE || "");
  const written = new Set(); // 自分が書き込んだ TimeTree の予定の ID（読み取りで除く）
  let rest = null;
  if (app.SUPABASE_URL && app.SUPABASE_SERVICE_KEY) rest = restOf(app);
  if (writing) {
    if (!rest) throw new Error(`ふたり手帖の設定が見つかりません: ${APP_ENV}`);
    const since = conf.TIMETREE_WRITE_SINCE;
    if (!since || Number.isNaN(Date.parse(since))) throw new Error("設定ファイルに TIMETREE_WRITE_SINCE（いつ以降の予定を書き込むか）を書いてください");
    const wname = (conf.TIMETREE_WRITE_CALENDAR || "").trim();
    const wcals = active.filter((c) => wname && String(c.name).includes(wname));
    if (wcals.length !== 1) throw new Error(`書き込み先のカレンダー「${wname}」が1つに決まりません（--check で名前を確認できます）`);
    const wcal = wcals[0];
    const users = (wcal.calendar_users ?? []).map((u) => ({ id: u.user_id ?? u.id, name: u.name })).filter((u) => u.id);

    // 人ごとの色（ラベル）は、その人が TimeTree でいちばんよく使っているものに合わせる
    const existing = await withSession(conf, (sid) => fetchEvents(sid, wcal.id));
    const counts = new Map();
    for (const e of existing) {
      if (e.deactivated_at) continue;
      const name = users.find((u) => String(u.id) === String(e.author_id))?.name;
      if (!name) continue;
      const k = `${name}|${e.label_id}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const labels = new Map();
    for (const u of users) {
      const top = [...counts.entries()].filter(([k]) => k.startsWith(`${u.name}|`)).sort((a, b) => b[1] - a[1])[0];
      if (top) labels.set(u.name, Number(top[0].split("|")[1]));
    }
    labels.set("", 9); // 「ふたり」の予定の色

    const members = await rest("GET", "members?select=user_id,name", null, "return=representation");
    const nameOf = new Map(members.map((m) => [m.user_id, m.name]));
    const events = await rest(
      "GET",
      `events?select=id,date,title,start_time,end_time,member_id,memo,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=1000`,
      null,
      "return=representation",
    );
    const links = await rest("GET", "timetree_links?select=event_id,timetree_calendar_id,timetree_event_id,hash", null, "return=representation");
    const linkOf = new Map(links.map((l) => [l.event_id, l]));
    const alive = new Set(events.map((e) => e.id));

    const plan = { 追加: [], 変更: [], 削除: [] };
    for (const ev of events) {
      const body = toTimeTree({ ...ev, member_name: ev.member_id ? nameOf.get(ev.member_id) : null }, { users, labels });
      const hash = createHash("sha1").update(JSON.stringify(body)).digest("hex");
      const link = linkOf.get(ev.id);
      if (!link) plan.追加.push({ ev, body, hash });
      else if (link.hash !== hash) plan.変更.push({ ev, body, hash, link });
    }
    // ふたり手帖で消された予定（対応表にだけ残っているもの）
    for (const l of links) if (!alive.has(l.event_id)) plan.削除.push(l);

    if (dry) {
      console.log(`（試し読み）TimeTree「${wcal.name}」への書き込み予定: 追加 ${plan.追加.length} / 変更 ${plan.変更.length} / 削除 ${plan.削除.length}`);
      for (const p of plan.追加) console.log(`  ＋ ${p.ev.date} ${p.ev.title}`);
    } else if (plan.追加.length + plan.変更.length + plan.削除.length > 0) {
      const done = { 追加: 0, 変更: 0, 削除: 0, 失敗: 0 };
      await withSession(conf, async (sid) => {
        const csrf = await csrfToken(sid);
        for (const p of plan.追加.slice(0, MAX_CREATES)) {
          try {
            const r = await ttWrite(sid, csrf, "POST", `calendar/${wcal.id}/event`, p.body);
            const id = r?.event?.id ?? r?.event?.uuid;
            if (!id) throw new Error("TimeTree から予定の ID が返りませんでした");
            try {
              await rest("POST", "timetree_links", { event_id: p.ev.id, timetree_calendar_id: String(wcal.id), timetree_event_id: id, hash: p.hash });
            } catch (e) {
              // 対応表に残せなかったら、次回また入れて二重になる。入れたものを取り消す
              await ttWrite(sid, csrf, "DELETE", `calendar/${wcal.id}/event/${id}`).catch(() => {});
              throw e;
            }
            done.追加 += 1;
          } catch (e) {
            done.失敗 += 1;
            log(`NG 追加 ${p.ev.date} ${e instanceof Error ? e.message : e}`);
          }
        }
        for (const p of plan.変更) {
          try {
            await ttWrite(sid, csrf, "PUT", `calendar/${p.link.timetree_calendar_id}/event/${p.link.timetree_event_id}`, p.body);
            await rest("PATCH", `timetree_links?event_id=eq.${p.ev.id}`, { hash: p.hash, synced_at: new Date().toISOString() });
            done.変更 += 1;
          } catch (e) {
            done.失敗 += 1;
            log(`NG 変更 ${p.ev.date} ${e instanceof Error ? e.message : e}`);
          }
        }
        for (const l of plan.削除) {
          try {
            try {
              await ttWrite(sid, csrf, "DELETE", `calendar/${l.timetree_calendar_id}/event/${l.timetree_event_id}`);
            } catch (e) {
              if (e.status !== 404) throw e; // TimeTree 側ですでに消されていたら、それでよい
            }
            await rest("DELETE", `timetree_links?event_id=eq.${l.event_id}`);
            done.削除 += 1;
          } catch (e) {
            done.失敗 += 1;
            log(`NG 削除 ${e instanceof Error ? e.message : e}`);
          }
        }
      });
      const skipped = Math.max(0, plan.追加.length - MAX_CREATES);
      const msg = `TimeTree「${wcal.name}」に書き込みました。追加 ${done.追加} / 変更 ${done.変更} / 削除 ${done.削除}${done.失敗 ? ` / 失敗 ${done.失敗}` : ""}${skipped ? `（残り ${skipped} 件は次回）` : ""}`;
      console.log(msg);
      log(`OK ${msg}`);
    }
    // ---------- ふたり手帖から「消す」と頼まれた TimeTree の予定 ----------
    let requests = [];
    try {
      requests = await rest(
        "GET",
        `external_events?select=uid,calendar_name&source=eq.timetree&user_id=eq.${app.MANAGEMENT_USER_ID}&delete_requested_at=not.is.null`,
        null,
        "return=representation",
      );
    } catch {
      // 0014 がまだ無い DB では、この機能は動かない
    }
    const asked = new Map(requests.map((r) => [r.uid.split(":")[0], r.calendar_name]));
    if (asked.size > 0 && dry) console.log(`（試し読み）TimeTree から消す依頼: ${asked.size} 件`);
    if (asked.size > 0 && !dry) {
      let removed = 0;
      let refused = 0;
      await withSession(conf, async (sid) => {
        const csrf = await csrfToken(sid);
        const cache = new Map(); // カレンダーごとの予定（くり返しかどうかを確かめる）
        for (const [uuid, calName] of asked) {
          const filter = `external_events?source=eq.timetree&user_id=eq.${app.MANAGEMENT_USER_ID}&uid=like.${uuid}:*`;
          try {
            const cal = active.find((c) => c.name === calName);
            if (!cal) throw new Error(`カレンダー「${calName}」が見つかりません`);
            if (!cache.has(cal.id)) cache.set(cal.id, await fetchEvents(sid, cal.id));
            const ev = cache.get(cal.id).find((e) => e.uuid === uuid || e.id === uuid);
            if (ev && (ev.recurrences ?? []).some((r) => /^RRULE/i.test(r))) {
              // くり返しは全部消えてしまうので消さない。依頼を取り下げる
              await rest("PATCH", filter, { delete_requested_at: null });
              refused += 1;
              continue;
            }
            if (ev && !ev.deactivated_at) {
              await ttWrite(sid, csrf, "DELETE", `calendar/${cal.id}/event/${ev.id ?? uuid}`);
            }
            await rest("DELETE", filter);
            removed += 1;
          } catch (e) {
            log(`NG TimeTree から消す ${e instanceof Error ? e.message : e}`);
          }
        }
      });
      const msg = `TimeTree から消しました: ${removed} 件${refused ? `（くり返しのため消さなかった: ${refused} 件）` : ""}`;
      console.log(msg);
      log(`OK ${msg}`);
    }

    // 自分が書き込んだ予定は、読み取りで取り込まない
    const now = await rest("GET", "timetree_links?select=timetree_event_id", null, "return=representation");
    for (const l of now) written.add(l.timetree_event_id);
  }

  // ---------- 読み取り（TimeTree → ふたり手帖） ----------
  const today = jst(Date.now()).date;
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, FUTURE_DAYS);
  const rows = new Map();
  for (const cal of targets) {
    const events = await withSession(conf, (sid) => fetchEvents(sid, cal.id));
    // メンバーの ID → 名前、ラベルの ID → 色
    const lookup = {
      users: new Map((cal.calendar_users ?? []).map((u) => [String(u.user_id ?? u.id), u.name]).filter(([, n]) => n)),
      labels: new Map(
        (cal.calendar_labels ?? []).map((l) => [
          Number(l.id),
          typeof l.color === "number" ? `#${l.color.toString(16).padStart(6, "0")}` : /^#[0-9a-f]{6}$/i.test(l.color ?? "") ? l.color : null,
        ]),
      ),
    };
    for (const ev of events) {
      if (written.has(ev.id) || written.has(ev.uuid)) continue; // ふたり手帖から書き込んだもの
      for (const r of toRows(ev, cal.name, from, to, lookup)) rows.set(r.uid, r);
    }
  }
  const list = [...rows.values()];
  const summary = `${targets.map((c) => c.name).join("・")}: ${list.length} 件（${from} 〜 ${to}）`;
  if (dry) return console.log(`（試し読み）${summary}`);

  if (!rest || !app.MANAGEMENT_USER_ID) throw new Error(`ふたり手帖の設定が見つかりません: ${APP_ENV}`);
  const uid = app.MANAGEMENT_USER_ID;
  const shared = /^(true|1|yes)$/i.test(conf.TIMETREE_SHARED || "");
  const stamp = new Date().toISOString();
  // 入れて（同じ予定は上書き）、今回出てこなかった古い行を消す
  const upsert = async (withAuthor) => {
    for (let i = 0; i < list.length; i += 500) {
      await rest(
        "POST",
        "external_events?on_conflict=user_id,source,uid",
        list.slice(i, i + 500).map(({ author_name, label_color, recurring, ...r }) => ({
          ...r,
          ...(withAuthor >= 1 ? { author_name, label_color } : {}),
          ...(withAuthor >= 2 ? { recurring } : {}),
          user_id: uid,
          source: "timetree",
          shared,
          synced_at: stamp,
        })),
        "resolution=merge-duplicates,return=minimal",
      );
    }
  };
  // 列が足りない古い DB でも動くよう、新しい列から順に抜いて試す（2: 0014 まで / 1: 0012 まで / 0: 0011 のみ）
  let colored = true;
  let level = 2;
  for (;;) {
    try {
      await upsert(level);
      break;
    } catch (e) {
      if (level === 0 || !/author_name|label_color|recurring/.test(String(e?.message))) throw e;
      level -= 1;
    }
  }
  colored = level >= 1;
  await rest("DELETE", `external_events?user_id=eq.${uid}&source=eq.timetree&synced_at=lt.${encodeURIComponent(stamp)}`);
  console.log(`取り込みました。${summary}${shared ? "・もう1人にも表示" : "・自分だけに表示"}`);
  if (!colored) console.log("（人ごとの色分けには、supabase/migrations/0012_external_author.sql の実行が必要です）");
  log(`OK ${summary}`);
}

// 直接実行されたときだけ動かす（テストから関数を読み込めるように）
// import.meta.url の pathname は日本語が %E3… に化けるので、fileURLToPath で実際のパスに直す
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    log(`NG ${msg}`);
    process.exit(1);
  });
}
