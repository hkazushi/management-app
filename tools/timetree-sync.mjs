#!/usr/bin/env node
// ============================================================
// timetree-sync — TimeTree のカレンダー（例: 家族）を読み取って、ふたり手帖に「見るだけの予定」として入れる。
//
//   timetree-sync --check     ログインできるか試し、カレンダーの名前を一覧する（何も書き込まない）
//   timetree-sync             読み取って、ふたり手帖の external_events を入れ替える
//   timetree-sync --dry       読み取って件数だけ出す（書き込まない）
//
// 大事なこと:
//   - TimeTree には公式の連携手段が無い（API は 2023-12-22 に終了）。これは TimeTree の Web 版と同じ通信を
//     まねる非公式の方法で、TimeTree の仕様変更で突然動かなくなることがある。
//   - 読むだけ。TimeTree 側には何も書き込まない（GET と、ログインの1回だけ）。
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
//   ~/.claude/hooks/management-app.env   （既存。SUPABASE_URL / SUPABASE_SERVICE_KEY / MANAGEMENT_USER_ID）
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  return rows.map((r) => ({ ...r, memo, calendar_name: calendarName, author_name, label_color }));
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
    if (!res.ok) throw new Error(`ふたり手帖への書き込みに失敗しました（${res.status} ${text.slice(0, 160)}）`);
    return text ? JSON.parse(text) : null;
  };
}

async function main() {
  const check = process.argv.includes("--check");
  const dry = process.argv.includes("--dry");
  const conf = loadEnv(CONF_FILE);
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
    return;
  }

  const wanted = (conf.TIMETREE_CALENDAR || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (wanted.length === 0) throw new Error("設定ファイルに TIMETREE_CALENDAR（読み取るカレンダーの名前）を書いてください");
  const targets = active.filter((c) => wanted.some((w) => String(c.name).includes(w)));
  if (targets.length === 0) throw new Error(`「${wanted.join("」「")}」に当てはまるカレンダーがありません（--check で名前を確認できます）`);

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
    for (const ev of events) for (const r of toRows(ev, cal.name, from, to, lookup)) rows.set(r.uid, r);
  }
  const list = [...rows.values()];
  const summary = `${targets.map((c) => c.name).join("・")}: ${list.length} 件（${from} 〜 ${to}）`;
  if (dry) return console.log(`（試し読み）${summary}`);

  if (!app.SUPABASE_URL || !app.SUPABASE_SERVICE_KEY || !app.MANAGEMENT_USER_ID) throw new Error(`ふたり手帖の設定が見つかりません: ${APP_ENV}`);
  const rest = restOf(app);
  const uid = app.MANAGEMENT_USER_ID;
  const shared = /^(true|1|yes)$/i.test(conf.TIMETREE_SHARED || "");
  const stamp = new Date().toISOString();
  // 入れて（同じ予定は上書き）、今回出てこなかった古い行を消す
  const upsert = async (withAuthor) => {
    for (let i = 0; i < list.length; i += 500) {
      await rest(
        "POST",
        "external_events?on_conflict=user_id,source,uid",
        list.slice(i, i + 500).map(({ author_name, label_color, ...r }) => ({
          ...r,
          ...(withAuthor ? { author_name, label_color } : {}),
          user_id: uid,
          source: "timetree",
          shared,
          synced_at: stamp,
        })),
        "resolution=merge-duplicates,return=minimal",
      );
    }
  };
  let colored = true;
  try {
    await upsert(true);
  } catch (e) {
    // 0012（作成者・色の列）がまだ無い DB では、その2つを抜いて入れる
    if (!/author_name|label_color/.test(String(e?.message))) throw e;
    colored = false;
    await upsert(false);
  }
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
