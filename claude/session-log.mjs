#!/usr/bin/env node
// ============================================================
// Claude Code の会話を要約して、議事録アプリへ自動で記録する。
//   - 作業ログ（やったこと・残り）→ activity_log（action = 'session'）
//   - 残り作業 → action_items（担当「自分」の宿題）
//
// 呼ばれ方（~/.claude/settings.json の Stop / SessionEnd フック）:
//   node session-log.mjs hook        ← 標準入力にフックの JSON。すぐ終了し、本体は裏で動く
// 手動:
//   node session-log.mjs run end <session_id> <transcript_path> <cwd> [--dry]
//
// 方針:
//   - Stop（返答のたび）では記録しない。最後のやりとりから 20 分動きが無ければ記録する
//   - SessionEnd ではすぐ記録する
//   - 1セッション = 作業ログ1行。続きがあれば同じ行を書き直す
//   - 宿題は追加するだけ。完了チェックは絶対に付けない（判断は人がする）
//   - 会話を AI に送る前に、キーやトークンらしい文字列は伏せ字にする
//
// 設定は ~/.claude/hooks/management-app.env（リポジトリには入れない）:
//   SUPABASE_URL / SUPABASE_SERVICE_KEY / MANAGEMENT_USER_ID / OPENROUTER_API_KEY
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK_DIR = path.join(os.homedir(), ".claude", "hooks");
const STATE_DIR = path.join(HOOK_DIR, "state");
const LOG_FILE = path.join(HOOK_DIR, "session-log.log");
const ENV_FILE = path.join(HOOK_DIR, "management-app.env");

const IDLE_MS = 20 * 60 * 1000; // 最後のやりとりからこの時間たったら記録する
const MAX_WAIT_MS = 12 * 60 * 60 * 1000; // 待機プロセスの寿命
const TAIL_CHARS = 20000; // AI に送る会話の上限
const MIN_CHARS = 300; // これより短い会話は記録しない
const MODEL = "google/gemini-2.5-flash";

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
      /((?:key|token|secret|password|passwd|pwd|pin|パスワード|暗証番号)[A-Za-z0-9_]*["']?\s*[:=：]\s*["']?)[^\s"',]{4,}/gi,
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
    .replace(/<command-(name|message|args)>[\s\S]*?<\/command-\1>/g, "")
    .trim();
}

// JSONL の1行を「発言」に直す。対象外なら null
function toEntry(line) {
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    return null;
  }
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
    return { who: "ユーザー", text: text.slice(0, 2000) };
  }
  if (row.type === "assistant" && Array.isArray(content)) {
    const parts = [];
    for (const c of content) {
      if (c.type === "text" && c.text?.trim()) parts.push(c.text.trim().slice(0, 1500));
      if (c.type === "tool_use") {
        const input = c.input ?? {};
        if (c.name === "Edit" || c.name === "Write") {
          parts.push(`[ファイル編集] ${input.file_path ?? ""}`);
        } else if (c.name === "Bash" && /git (commit|push|merge)|gh pr/.test(input.command ?? "")) {
          parts.push(`[コマンド] ${String(input.command).slice(0, 200)}`);
        }
      }
    }
    if (parts.length === 0) return null;
    return { who: "Claude", text: parts.join("\n") };
  }
  return null;
}

// 連続する同じファイル編集の行をまとめる
function render(entries) {
  const out = [];
  let prev = "";
  for (const e of entries) {
    const line = `${e.who}: ${e.text}`;
    if (line === prev) continue;
    out.push(line);
    prev = line;
  }
  return out.join("\n\n");
}

// ---------- Supabase / AI ----------

function rest(env) {
  const base = `${env.SUPABASE_URL}/rest/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  return async (method, pathAndQuery, body) => {
    const res = await fetch(`${base}/${pathAndQuery}`, {
      method,
      headers: { ...headers, Prefer: "return=representation" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery.split("?")[0]} → ${res.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

function real(p) {
  try {
    // macOS は「ダ」などの濁点を NFD で返すことがあり、DB の文字列（NFC）と一致しない。NFC にそろえる
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return null;
  }
}

// cwd から上へたどって git リポジトリのルートを探す
function gitRoot(dir) {
  let cur = dir;
  for (let i = 0; i < 30; i++) {
    if (fs.existsSync(path.join(cur, ".git"))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
  return null;
}

// 作業フォルダから案件を探す（フォルダ移動やシンボリックリンクがあっても実体のパスで比べる）
export function matchProject(projects, cwd) {
  const here = real(cwd) ?? cwd;
  let best = null;
  for (const p of projects) {
    if (!p.repo_path) continue;
    const rp = real(p.repo_path);
    if (!rp) continue;
    if (here === rp || here.startsWith(rp + path.sep)) {
      if (!best || rp.length > best.len) best = { project: p, len: rp.length };
    }
  }
  return best?.project ?? null;
}

async function summarize(env, { conversation, prev, openItems, projectName, today }) {
  const system =
    "あなたは開発者の作業記録係です。Claude Code（AIコーディングアシスタント）とユーザーの会話ログから、" +
    "この作業セッションの記録を作ります。会話に書かれている事実だけを使い、推測で作業や予定を足しません。" +
    "出力は JSON オブジェクトのみです。";
  const user = [
    `今日の日付: ${today}`,
    projectName ? `案件: ${projectName}` : "案件: （未登録）",
    prev
      ? `このセッションのこれまでの記録（続きの会話を足して、全体の記録として書き直す）:\n${JSON.stringify(prev)}`
      : "",
    `すでに登録されている未完了の宿題（同じ内容は new_tasks に入れない）:\n${
      openItems.length ? openItems.map((t) => `- ${t}`).join("\n") : "（なし）"
    }`,
    "次の形式の JSON を返してください。",
    `{
  "skip": 実質的な作業が無い（挨拶・短い質問と回答だけ等）なら true,
  "title": "何をしたセッションか。30字以内",
  "done": ["やったこと。成果を1つずつ。各60字以内。最大6個"],
  "remaining": ["残っていること。会話の中ですでに終わったものは入れない。最大5個"],
  "new_tasks": ["remaining のうち、ユーザー本人が後でやる必要があり、既存の宿題に無いもの。それだけ読んで意味が通る具体的な文。最大3個"]
}`,
    "new_tasks に入れてよいのは、ユーザーの操作や判断が必要なこと、または次回に持ち越された作業だけです。" +
      "Claude がこの会話の続きですぐやる作業、一般的な改善案、「必要なら〜できます」のような提案は入れません。迷ったら入れません。",
    `--- 会話ログ ---\n${conversation}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 1500,
      response_format: { type: "json_object" },
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
    new_tasks: list(json.new_tasks, 3, 120),
  };
}

// ---------- 本体 ----------

async function record({ sid, transcriptPath, cwd, dry }) {
  const env = loadEnv();
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "MANAGEMENT_USER_ID", "OPENROUTER_API_KEY"]) {
    if (!env[k]) return log(`${sid.slice(0, 8)} 設定 ${k} が無いので終了`);
  }
  if (!fs.existsSync(transcriptPath)) return log(`${sid.slice(0, 8)} 会話ログが見つからない`);

  // 二重実行を防ぐ（5分以上前のロックは無視）
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const lock = `${statePath(sid)}.lock`;
  try {
    const st = fs.statSync(lock);
    if (Date.now() - st.mtimeMs < 5 * 60 * 1000) return;
    fs.rmSync(lock);
  } catch {
    // ロック無し
  }
  if (!dry) fs.writeFileSync(lock, String(process.pid));

  try {
    const state = readState(sid);
    const lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
    const from = dry ? 0 : (state.lastLine ?? 0);
    if (lines.length <= from) return;

    const fresh = lines.slice(from).map(toEntry).filter(Boolean);
    const userChars = fresh.filter((e) => e.who === "ユーザー").reduce((n, e) => n + e.text.length, 0);
    let conversation = redact(render(fresh));
    // 新しい発言が無い／短すぎる場合は、次回にまとめて記録する
    if (userChars === 0 || (!state.logId && conversation.length < MIN_CHARS)) return;
    if (conversation.length > TAIL_CHARS) {
      const first = fresh.find((e) => e.who === "ユーザー");
      const head = first && !state.summary ? `ユーザー（最初の依頼）: ${redact(first.text).slice(0, 800)}\n\n（中略）\n\n` : "";
      conversation = head + conversation.slice(-TAIL_CHARS);
    }

    const api = rest(env);
    const uid = env.MANAGEMENT_USER_ID;
    const projects = await api("GET", `projects?user_id=eq.${uid}&select=id,name,repo_path,status`);
    let project = matchProject(projects, cwd);

    const filter = project ? `project_id=eq.${project.id}` : "project_id=is.null";
    const open = await api(
      "GET",
      `action_items?user_id=eq.${uid}&done=eq.false&${filter}&select=content&order=created_at.desc&limit=40`,
    );
    const openItems = open.map((r) => r.content);

    const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
    const result = await summarize(env, {
      conversation,
      prev: dry ? null : (state.summary ?? null),
      openItems,
      projectName: project?.name ?? null,
      today,
    });

    if (dry) {
      console.log(JSON.stringify({ project: project?.name ?? null, sentChars: conversation.length, result }, null, 2));
      return;
    }
    if (result.skip && !state.logId) {
      writeState(sid, { lastLine: lines.length });
      return log(`${sid.slice(0, 8)} 作業なしと判定`);
    }

    // 案件が未登録でも、git リポジトリでの作業なら案件を作る
    if (!project) {
      const root = gitRoot(real(cwd) ?? cwd);
      if (root) {
        const created = await api("POST", "projects", {
          user_id: uid,
          name: path.basename(root),
          repo_path: root,
          status: "運用中",
        });
        project = created[0];
        log(`${sid.slice(0, 8)} 案件を作成: ${project.name}`);
      }
    }

    const summary = { title: result.title, done: result.done, remaining: result.remaining };
    const detail = JSON.stringify(summary);
    let logId = state.logId;
    if (logId) {
      await api("PATCH", `activity_log?id=eq.${logId}`, { detail, project_id: project?.id ?? null });
    } else {
      const rows = await api("POST", "activity_log", {
        user_id: uid,
        project_id: project?.id ?? null,
        action: "session",
        detail,
        source: "claude_code",
        session_id: sid,
      });
      logId = rows[0].id;
    }

    // 宿題は追加だけ。同じ文面があれば足さない
    const known = new Set(openItems);
    const added = [];
    for (const content of result.new_tasks) {
      if (known.has(content)) continue;
      await api("POST", "action_items", {
        user_id: uid,
        project_id: project?.id ?? null,
        owner: "自分",
        content,
      });
      known.add(content);
      added.push(content);
    }

    writeState(sid, { lastLine: lines.length, logId, summary, updatedAt: new Date().toISOString() });
    log(`${sid.slice(0, 8)} 記録: ${project?.name ?? "案件なし"} / ${result.title} / 宿題 +${added.length}`);
  } catch (e) {
    log(`${sid.slice(0, 8)} 失敗: ${e instanceof Error ? e.message : String(e)}`);
    if (dry) console.error(e);
  } finally {
    if (!dry) fs.rmSync(lock, { force: true });
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

async function main() {
  const [mode, ...rest_] = process.argv.slice(2);

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
    const dry = rest_.includes("--dry");
    const [kind, sid, transcriptPath, cwd] = rest_.filter((a) => a !== "--dry");
    if (!sid || !transcriptPath) return;
    if (kind === "idle") {
      const idle = await waitUntilIdle(transcriptPath);
      writeState(sid, { waiterPid: null });
      if (!idle) return;
    }
    await record({ sid, transcriptPath, cwd: cwd || process.cwd(), dry });
    return;
  }

  console.error("使い方: session-log.mjs hook | run <end|idle> <session_id> <transcript_path> <cwd> [--dry]");
}

// 直接実行されたときだけ動かす（テストから関数を読み込めるように）
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  main().catch((e) => log(`致命的: ${e instanceof Error ? e.message : String(e)}`));
}
