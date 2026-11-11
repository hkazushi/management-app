#!/usr/bin/env node
// ============================================================
// Claude Code の会話を要約して、議事録アプリへ自動で記録する。
//   - 作業ログ（やったこと・残り）→ activity_log（action = 'session'）
//   - 残り作業 → action_items（担当「自分」の宿題）
//   - 記録のあと、その案件の URL・ログイン情報も集める（logpass scan。AI には送らない）
//
// 呼ばれ方（~/.claude/settings.json の Stop / SessionEnd フック）:
//   node session-log.mjs hook        ← 標準入力にフックの JSON。すぐ終了し、本体は裏で動く
// 手動:
//   node session-log.mjs run end <session_id> <transcript_path> <cwd> [--dry]
//   node session-log.mjs backfill [--dry] [--since 2026-09-01]   ← 過去の会話をまとめて取り込む
//
// 方針:
//   - 1つのセッションが何か月も続くので、記録の単位は「セッション × 日付（日本時間）」。1日1行
//   - 案件は、その日に触ったファイルの場所から決める（作業フォルダがホームでも案件が分かるように）
//   - Stop（返答のたび）では記録しない。最後のやりとりから 20 分動きが無ければ記録する
//   - SessionEnd ではすぐ記録する
//   - 宿題は追加するだけ。完了チェックは絶対に付けない（判断は人がする）
//     過去分の取り込みでは宿題を作らない（古い「残り」が並ぶのを防ぐ）
//   - 会話を AI に送る前に、キーやトークンらしい文字列は伏せ字にする
//
// 設定は ~/.claude/hooks/management-app.env（リポジトリには入れない）:
//   SUPABASE_URL / SUPABASE_SERVICE_KEY / MANAGEMENT_USER_ID / OPENROUTER_API_KEY
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOME = os.homedir();
const HOOK_DIR = path.join(HOME, ".claude", "hooks");
const STATE_DIR = path.join(HOOK_DIR, "state");
const LOG_FILE = path.join(HOOK_DIR, "session-log.log");
const ENV_FILE = path.join(HOOK_DIR, "management-app.env");
const TRANSCRIPTS = path.join(HOME, ".claude", "projects");
const WORKSPACE = path.join(HOME, "workspace", "projects");
// この下は「フォルダ1つ = 案件1つ」として扱うグループ
const GROUPS = new Set(["comvace-work", "sai-work", "my-work", "aaa"]);

const IDLE_MS = 20 * 60 * 1000; // 最後のやりとりからこの時間たったら記録する
const MAX_WAIT_MS = 12 * 60 * 60 * 1000; // 待機プロセスの寿命
const DAY_CHARS = 16000; // 1日ぶんとして AI に送る会話の上限
const MIN_CHARS = 300; // これより短い日は記録しない
const TASK_DAYS = 2; // 何日前までの会話から宿題を作るか
const MODEL = "google/gemini-2.5-flash";
const MODEL_BACKFILL = "google/gemini-2.5-flash-lite"; // 過去分は量が多いので安いモデルを使う

function log(msg) {
  try {
    fs.mkdirSync(HOOK_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
  } catch {
    // ログが書けなくても処理は続ける
  }
}

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // 設定ファイルが無ければ空のまま（呼び出し側で終了する）
  }
  return env;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jstDate = (t) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(t));

// ---------- 状態ファイル（セッションごと） ----------

function statePath(sid) {
  return path.join(STATE_DIR, `${sid.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}
function readState(sid) {
  try {
    return JSON.parse(fs.readFileSync(statePath(sid), "utf8"));
  } catch {
    return {};
  }
}
function writeState(sid, patch) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const next = { ...readState(sid), ...patch };
  fs.writeFileSync(statePath(sid), JSON.stringify(next));
  return next;
}
function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------- 会話ログの読み取り ----------

// キー・トークンらしい文字列を伏せ字にする
export function redact(text) {
  return text
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[伏せ字]")
    .replace(/\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}/g, "[伏せ字]")
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[伏せ字]")
    .replace(/\bgithub_pat_[A-Za-z0-9_]{20,}/g, "[伏せ字]")
    .replace(/\bsb[p]?_[A-Za-z0-9_-]{16,}/g, "[伏せ字]")
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[伏せ字]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[伏せ字]")
    .replace(/\bAIza[0-9A-Za-z_-]{30,}/g, "[伏せ字]")
    .replace(
      /((?:key|token|secret|password|passwd|pwd|pin|パスワード|暗証番号)[A-Za-z0-9_]*["']?\s*(?:[:=：]|は)?\s*["'「]?)[!-~]{4,}/gi,
      "$1[伏せ字]",
    )
    .replace(/(:\/\/[^\s/:@]+:)[^\s/@]+@/g, "$1[伏せ字]@")
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[伏せ字]");
}

function cleanUserText(text) {
  return text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<bash-(stdout|stderr)>[\s\S]*?<\/bash-\1>/g, "")
    .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, "")
    .trim();
}

// JSONL の1行を「発言」と「触ったファイル」に直す。対象外なら null
function toEntry(row) {
  if (row.isSidechain || row.isMeta || row.isCompactSummary) return null;
  const content = row.message?.content;
  if (row.type === "user") {
    let text = "";
    if (typeof content === "string") text = content;
    else if (Array.isArray(content)) {
      text = content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
    }
    text = cleanUserText(text);
    if (!text || text.startsWith("This session is being continued")) return null;
    return { who: "ユーザー", text: text.slice(0, 1500), paths: [] };
  }
  if (row.type === "assistant" && Array.isArray(content)) {
    const parts = [];
    const paths = [];
    for (const c of content) {
      if (c.type === "text" && c.text?.trim()) parts.push(c.text.trim().slice(0, 1200));
      if (c.type === "tool_use") {
        const input = c.input ?? {};
        if (typeof input.file_path === "string") paths.push(input.file_path);
        if (c.name === "Edit" || c.name === "Write") {
          parts.push(`[ファイル編集] ${input.file_path ?? ""}`);
        } else if (c.name === "Bash" && /git (commit|push|merge)|gh pr/.test(input.command ?? "")) {
          parts.push(`[コマンド] ${String(input.command).slice(0, 200)}`);
        }
      }
    }
    if (parts.length === 0 && paths.length === 0) return null;
    return { who: "Claude", text: parts.join("\n"), paths };
  }
  return null;
}

// 会話ログを fromLine 行目から読み、日付（日本時間）ごとにまとめる
async function readDays(transcriptPath, fromLine) {
  const days = new Map(); // date -> { entries, paths: Map, cwds: Map, lastTs }
  let lineNo = 0;
  let current = null;
  const rl = readline.createInterface({ input: fs.createReadStream(transcriptPath, "utf8"), crlfDelay: Infinity });
  for await (const line of rl) {
    lineNo += 1;
    if (lineNo <= fromLine || !line) continue;
    // 発言でない行（道具の結果など）は中身を解釈しない。大きいので読み飛ばす
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.timestamp) current = jstDate(row.timestamp);
    if (!current) continue;
    const entry = toEntry(row);
    if (!entry) continue;
    if (!days.has(current)) days.set(current, { entries: [], paths: new Map(), cwds: new Map(), lastTs: null });
    const day = days.get(current);
    if (row.timestamp) day.lastTs = row.timestamp;
    if (entry.text) day.entries.push(entry);
    for (const p of entry.paths) day.paths.set(p, (day.paths.get(p) ?? 0) + 1);
    if (row.cwd) day.cwds.set(row.cwd, (day.cwds.get(row.cwd) ?? 0) + 1);
  }
  return { days, lines: lineNo };
}

// 連続する同じ行をまとめ、長すぎる日は「最初の依頼＋後半」に絞る
function render(entries) {
  const out = [];
  let prev = "";
  for (const e of entries) {
    const line = `${e.who}: ${e.text}`;
    if (line === prev) continue;
    out.push(line);
    prev = line;
  }
  const text = redact(out.join("\n\n"));
  if (text.length <= DAY_CHARS) return text;
  const head = Math.floor(DAY_CHARS * 0.25);
  return `${text.slice(0, head)}\n\n（中略）\n\n${text.slice(-(DAY_CHARS - head))}`;
}

// ---------- 案件の判定 ----------

function real(p) {
  try {
    // macOS は「ダ」などの濁点を NFD で返すことがあり、DB の文字列（NFC）と一致しない。NFC にそろえる
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return null;
  }
}

// いまは無いパス（消したワークツリーなど）でも、残っている親フォルダまでを実体のパスに直す
function realish(p) {
  let cur = p.replace(/\/\.claude\/worktrees\/[^/]+/, ""); // ワークツリーは元のリポジトリとして扱う
  const rest = [];
  for (let i = 0; i < 40; i++) {
    const r = real(cur);
    if (r) return path.join(r, ...rest).normalize("NFC");
    const up = path.dirname(cur);
    if (up === cur) break;
    rest.unshift(path.basename(cur));
    cur = up;
  }
  return p.normalize("NFC");
}

const under = (child, parent) => child === parent || child.startsWith(parent + path.sep);

function gitRoot(dir) {
  let cur = dir;
  for (let i = 0; i < 30; i++) {
    if (cur === HOME || !under(cur, HOME)) return null;
    if (fs.existsSync(path.join(cur, ".git"))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
  return null;
}

// パス1つから案件を決める。{ id } は登録済み、{ root } は未登録（これから作る）、null は対象外
function makeResolver(projects) {
  const known = projects
    .map((p) => ({ p, rp: p.repo_path ? real(p.repo_path) : null }))
    .filter((x) => x.rp);
  const workspace = real(WORKSPACE) ?? WORKSPACE;
  const cache = new Map();

  function resolve(raw) {
    if (!raw || !raw.startsWith("/")) return null;
    const dir = path.extname(raw) ? path.dirname(raw) : raw;
    if (cache.has(dir)) return cache.get(dir);
    const rp = realish(dir);
    let result = null;
    const skip = !under(rp, HOME) || rp === HOME || /\/(\.claude|\.cache|Library|node_modules)(\/|$)/.test(rp);
    if (!skip) {
      // 1. 登録済みの案件（一番深いもの）
      let best = null;
      for (const k of known) if (under(rp, k.rp) && (!best || k.rp.length > best.rp.length)) best = k;
      if (best) result = { id: best.p.id };
      else {
        // 2. ~/workspace/projects の決まった階層（中に別の git リポジトリがあっても、案件は上のフォルダ）
        // 3. それ以外の場所は git リポジトリ
        let root = null;
        if (under(rp, workspace) && rp !== workspace) {
          const parts = path.relative(workspace, rp).split(path.sep);
          if (GROUPS.has(parts[0])) root = parts[1] ? path.join(workspace, parts[0], parts[1]) : null;
          else root = path.join(workspace, parts[0]);
        } else {
          root = gitRoot(rp);
          if (root && !under(root, HOME)) root = null;
        }
        if (root && GROUPS.has(path.relative(workspace, root))) root = null; // グループ自体は案件にしない
        if (root) {
          // そのフォルダの中に登録済みの案件が1つだけあるなら、それと同じものとして扱う
          const inside = known.filter((k) => under(k.rp, root));
          result = inside.length === 1 ? { id: inside[0].p.id } : { root };
        }
      }
    }
    cache.set(dir, result);
    return result;
  }

  // その日に触ったファイル（多数決）と作業フォルダから、案件を1つ選ぶ
  function pick(day, fallbackCwd) {
    const votes = new Map();
    const vote = (raw, weight) => {
      const r = resolve(raw);
      if (!r) return;
      const key = r.id ? `id:${r.id}` : `root:${r.root}`;
      votes.set(key, (votes.get(key) ?? 0) + weight);
    };
    for (const [p, n] of day.paths) vote(p, n);
    for (const [c, n] of day.cwds) vote(c, Math.min(n, 3) * 0.5);
    if (votes.size === 0 && fallbackCwd) vote(fallbackCwd, 1);
    let top = null;
    for (const [key, score] of votes) if (!top || score > top.score) top = { key, score };
    if (!top) return null;
    return top.key.startsWith("id:") ? { id: top.key.slice(3) } : { root: top.key.slice(5) };
  }

  return { pick, known };
}

// ---------- Supabase / AI ----------

function rest(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  return async (method, pathAndQuery, body) => {
    const res = await fetch(`${base}/${pathAndQuery}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery.split("?")[0]} → ${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

async function summarize(env, { conversation, prev, openItems, projectName, date, wantTasks, model }) {
  const system =
    "あなたは開発者の作業記録係です。Claude Code（AIコーディングアシスタント）とユーザーの会話ログから、" +
    "その日の作業の記録を作ります。会話に書かれている事実だけを使い、推測で作業や予定を足しません。" +
    "出力は JSON オブジェクトのみです。";
  const user = [
    `会話の日付: ${date}`,
    projectName ? `案件: ${projectName}` : "案件: （未登録）",
    prev ? `この日のこれまでの記録（続きの会話を足して、1日全体の記録として書き直す）:\n${JSON.stringify(prev)}` : "",
    wantTasks
      ? `すでに登録されている未完了の宿題（同じ内容は new_tasks に入れない）:\n${
          openItems.length ? openItems.map((t) => `- ${t}`).join("\n") : "（なし）"
        }`
      : "",
    "次の形式の JSON を返してください。",
    `{
  "skip": 実質的な作業が無い（挨拶・短い質問と回答だけ等）なら true,
  "title": "この日に何をしたか。30字以内",
  "done": ["やったこと。成果を1つずつ。各60字以内。最大6個"],
  "remaining": ["残っていること。会話の中ですでに終わったものは入れない。最大5個"]${
    wantTasks
      ? `,
  "new_tasks": ["remaining のうち、ユーザー本人が後でやる必要があり、既存の宿題に無いもの。それだけ読んで意味が通る具体的な文。最大3個"]`
      : ""
  }
}`,
    wantTasks
      ? "new_tasks に入れてよいのは、ユーザーの操作や判断が必要なこと、または次回に持ち越された作業だけです。" +
        "Claude がこの会話の続きですぐやる作業、一般的な改善案、「必要なら〜できます」のような提案は入れません。迷ったら入れません。"
      : "",
    `--- 会話ログ ---\n${conversation}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: "json_object" },
          usage: { include: true },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(`AI: ${data.error?.message ?? res.status}`);
      const raw = (data.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const json = JSON.parse(raw);
      const list = (v, n, len) =>
        (Array.isArray(v) ? v : [])
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim().slice(0, len))
          .slice(0, n);
      return {
        skip: json.skip === true,
        title: String(json.title ?? "").trim().slice(0, 60) || "作業",
        done: list(json.done, 6, 120),
        remaining: list(json.remaining, 5, 120),
        new_tasks: wantTasks ? list(json.new_tasks, 3, 120) : [],
        cost: data.usage?.cost ?? 0,
      };
    } catch (e) {
      lastError = e;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw lastError;
}

// ---------- 本体 ----------

// 共有する道具（案件の一覧、判定、作成）。取り込みでは全セッションで使い回す
async function makeContext(env) {
  const api = rest(env);
  const uid = env.MANAGEMENT_USER_ID;
  const projects = await api("GET", `projects?user_id=eq.${uid}&select=id,name,repo_path,status`);
  const byId = new Map(projects.map((p) => [p.id, p]));
  const resolver = makeResolver(projects);
  const creating = new Map(); // root -> Promise<project>

  // 未登録のフォルダなら案件を作る（同時に2回作らない）
  function ensureProject(target) {
    if (!target) return Promise.resolve(null);
    if (target.id) return Promise.resolve(byId.get(target.id) ?? null);
    if (!creating.has(target.root)) {
      creating.set(
        target.root,
        (async () => {
          const rows = await api("POST", "projects", {
            user_id: uid,
            name: path.basename(target.root),
            repo_path: target.root,
            status: "運用中",
          });
          byId.set(rows[0].id, rows[0]);
          log(`案件を作成: ${rows[0].name}`);
          return rows[0];
        })(),
      );
    }
    return creating.get(target.root);
  }

  // 作業があったのにアーカイブのままの案件は、一覧に出るように戻す
  async function reviveIfArchived(project, date) {
    if (!project || project.status !== "アーカイブ" || date < "2026-09-01") return;
    project.status = "運用中";
    await api("PATCH", `projects?id=eq.${project.id}`, { status: "運用中" });
    log(`アーカイブを解除: ${project.name}`);
  }

  return { env, api, uid, byId, resolver, ensureProject, reviveIfArchived };
}

// 1セッションぶんを記録する。返り値は { days, cost }
async function record(ctx, { sid, transcriptPath, cwd, dry, backfill, since, report }) {
  const tag = sid.slice(0, 8);
  if (!fs.existsSync(transcriptPath)) return { days: 0, cost: 0 };

  // 二重実行を防ぐ（10分以上前のロックは無視）
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const lock = `${statePath(sid)}.lock`;
  try {
    if (Date.now() - fs.statSync(lock).mtimeMs < 10 * 60 * 1000) return { days: 0, cost: 0 };
    fs.rmSync(lock);
  } catch {
    // ロック無し
  }
  if (!dry) fs.writeFileSync(lock, String(process.pid));

  let written = 0;
  let cost = 0;
  try {
    const state = readState(sid);
    const dayState = state.days ?? {};
    const { days, lines } = await readDays(transcriptPath, dry ? 0 : (state.lastLine ?? 0));
    const today = jstDate(Date.now());
    const taskFrom = jstDate(Date.now() - TASK_DAYS * 86400000);

    const jobs = [];
    for (const [date, day] of [...days.entries()].sort()) {
      if (since && date < since) continue;
      const userChars = day.entries.filter((e) => e.who === "ユーザー").reduce((n, e) => n + e.text.length, 0);
      const conversation = render(day.entries);
      // 発言が無い／短すぎる日は記録しない（当日ぶんは次回にまとめて記録される）
      if (userChars < 20 || (!dayState[date] && conversation.length < MIN_CHARS)) continue;
      jobs.push({ date, day, conversation, target: ctx.resolver.pick(day, cwd) });
    }

    if (dry) {
      for (const j of jobs) {
        const name = j.target?.id ? ctx.byId.get(j.target.id)?.name : j.target?.root ? `＋${path.basename(j.target.root)}` : "案件なし";
        report?.({ date: j.date, project: name, chars: j.conversation.length });
      }
      return { days: jobs.length, cost: 0 };
    }

    // 1日ずつ要約して保存（同時に4つまで）
    let failed = false;
    const queue = [...jobs];
    const worker = async () => {
      for (let j = queue.shift(); j; j = queue.shift()) {
        try {
          const project = await ctx.ensureProject(j.target);
          const wantTasks = !backfill && j.date >= taskFrom;
          let openItems = [];
          if (wantTasks) {
            const filter = project ? `project_id=eq.${project.id}` : "project_id=is.null";
            const open = await ctx.api(
              "GET",
              `action_items?user_id=eq.${ctx.uid}&done=eq.false&${filter}&select=content&order=created_at.desc&limit=40`,
            );
            openItems = open.map((r) => r.content);
          }
          const prev = dayState[j.date];
          const result = await summarize(ctx.env, {
            conversation: j.conversation,
            prev: prev?.summary ?? null,
            openItems,
            projectName: project?.name ?? null,
            date: j.date,
            wantTasks,
            model: backfill ? MODEL_BACKFILL : MODEL,
          });
          cost += result.cost;
          if (result.skip && !prev) continue;

          await ctx.reviveIfArchived(project, j.date);
          const summary = { title: result.title, done: result.done, remaining: result.remaining };
          const row = {
            project_id: project?.id ?? null,
            detail: JSON.stringify(summary),
            created_at: j.day.lastTs ?? new Date().toISOString(), // 一覧がその日の位置に並ぶように
          };
          let logId = prev?.logId;
          if (logId) await ctx.api("PATCH", `activity_log?id=eq.${logId}`, row);
          else {
            const rows = await ctx.api("POST", "activity_log", {
              ...row,
              user_id: ctx.uid,
              action: "session",
              source: "claude_code",
              session_id: sid,
            });
            logId = rows[0].id;
          }

          // 宿題は追加だけ。同じ文面があれば足さない
          const known = new Set(openItems);
          let added = 0;
          for (const content of result.new_tasks) {
            if (known.has(content)) continue;
            await ctx.api("POST", "action_items", {
              user_id: ctx.uid,
              project_id: project?.id ?? null,
              owner: "自分",
              content,
            });
            known.add(content);
            added += 1;
          }
          dayState[j.date] = { logId, summary };
          written += 1;
          if (!backfill || j.date === today) {
            log(`${tag} 記録: ${j.date} ${project?.name ?? "案件なし"} / ${result.title} / 宿題 +${added}`);
          }
        } catch (e) {
          failed = true;
          log(`${tag} 失敗: ${j.date} ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);

    // 失敗した日があれば読み取り位置を進めない（次回やり直す。済んだ日は書き直しになるだけ）
    writeState(sid, {
      days: dayState,
      ...(failed ? {} : { lastLine: lines }),
      updatedAt: new Date().toISOString(),
    });
    return { days: written, cost };
  } catch (e) {
    log(`${tag} 失敗: ${e instanceof Error ? e.message : String(e)}`);
    return { days: written, cost };
  } finally {
    if (!dry) fs.rmSync(lock, { force: true });
  }
}

function checkEnv(env) {
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MANAGEMENT_USER_ID", "OPENROUTER_API_KEY"]) {
    if (!env[k]) {
      log(`設定 ${k} が無いので終了`);
      return false;
    }
  }
  return true;
}

// 過去の会話をまとめて取り込む
async function backfill({ dry, since }) {
  const env = loadEnv();
  if (!checkEnv(env)) return console.error(`設定が足りません: ${ENV_FILE}`);
  const ctx = await makeContext(env);

  const files = [];
  for (const d of fs.readdirSync(TRANSCRIPTS)) {
    const dir = path.join(TRANSCRIPTS, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".jsonl")) files.push(path.join(dir, f));
  }

  const perProject = new Map();
  let chars = 0;
  let total = 0;
  let cost = 0;
  for (const [i, file] of files.entries()) {
    const sid = path.basename(file, ".jsonl");
    const res = await record(ctx, {
      sid,
      transcriptPath: file,
      cwd: null,
      dry,
      backfill: true,
      since,
      report: (r) => {
        chars += r.chars;
        perProject.set(r.project, (perProject.get(r.project) ?? 0) + 1);
      },
    });
    total += res.days;
    cost += res.cost;
    if (!dry) console.log(`[${i + 1}/${files.length}] ${sid.slice(0, 8)} ${res.days} 日ぶん`);
  }

  if (dry) {
    console.log(`会話ファイル ${files.length} 個 / 記録の候補 ${total} 日ぶん / AI に送る文字数 約 ${Math.round(chars / 1000)} 千字`);
    for (const [name, n] of [...perProject.entries()].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${name}`);
    console.log("（＋ は、これから新しく作る案件）");
  } else {
    console.log(`完了: ${total} 日ぶんを記録（AI の費用 約 $${cost.toFixed(3)}）`);
    log(`取り込み完了: ${total} 日ぶん / $${cost.toFixed(3)}`);
  }
}

// 会話ログが 20 分動かなくなるまで待つ
async function waitUntilIdle(transcriptPath) {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    let age;
    try {
      age = Date.now() - fs.statSync(transcriptPath).mtimeMs;
    } catch {
      return false;
    }
    if (age >= IDLE_MS) return true;
    await sleep(IDLE_MS - age + 1000);
  }
  return false;
}

// ついでに、この案件の URL・ログイン情報を集める（~/bin/logpass。無ければ何もしない）
function collectLogpass(cwd) {
  const bin = path.join(HOME, "bin", "logpass");
  if (!fs.existsSync(bin)) return;
  spawn(process.execPath, [bin, "scan", "--cwd", cwd, "--quiet"], { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const flag = (name) => args.includes(name);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

  // フックから呼ばれたとき：裏で本体を起動して、すぐ終了する（Claude を待たせない）
  if (mode === "hook") {
    let input = {};
    try {
      input = JSON.parse(fs.readFileSync(0, "utf8"));
    } catch {
      return;
    }
    const sid = input.session_id;
    const tp = input.transcript_path;
    if (!sid || !tp) return;
    const kind = input.hook_event_name === "SessionEnd" ? "end" : "idle";
    // 待機中のプロセスがすでにいれば、Stop では何もしない
    if (kind === "idle" && alive(readState(sid).waiterPid)) return;
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), "run", kind, sid, tp, input.cwd ?? process.cwd()],
      { detached: true, stdio: "ignore" },
    );
    if (kind === "idle") writeState(sid, { waiterPid: child.pid });
    child.unref();
    return;
  }

  if (mode === "run") {
    const dry = flag("--dry");
    const [kind, sid, transcriptPath, cwd] = args.filter((a) => a !== "--dry");
    if (!sid || !transcriptPath) return;
    if (kind === "idle") {
      const idle = await waitUntilIdle(transcriptPath);
      writeState(sid, { waiterPid: null });
      if (!idle) return;
    }
    const env = loadEnv();
    if (!checkEnv(env)) return;
    const ctx = await makeContext(env);
    const res = await record(ctx, {
      sid,
      transcriptPath,
      cwd: cwd || process.cwd(),
      dry,
      report: (r) => console.log(`${r.date}  ${r.project}  ${r.chars} 字`),
    });
    if (!dry && res.days > 0) collectLogpass(cwd || process.cwd());
    return;
  }

  if (mode === "backfill") return backfill({ dry: flag("--dry"), since: option("--since") });

  console.error("使い方: session-log.mjs hook | run <end|idle> <session_id> <transcript_path> <cwd> [--dry] | backfill [--dry] [--since 日付]");
}

// 直接実行されたときだけ動かす
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    log(`致命的: ${e instanceof Error ? e.message : String(e)}`);
    console.error(e instanceof Error ? e.message : String(e));
  });
}
