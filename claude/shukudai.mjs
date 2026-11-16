#!/usr/bin/env node
// ============================================================
// shukudai — 議事録アプリの宿題を、ターミナル（Claude Code）から読み書きする。
//
//   shukudai                       自分の未完了の宿題（期限の近い順）
//   shukudai list --all            相手の対応待ちも含める
//   shukudai list --project 目トレ  案件で絞る（名前の一部で可）
//   shukudai add "内容" [--project 名前] [--due 2026-11-20] [--owner 山田]
//   shukudai done <ID>...          完了にする（ID は一覧の先頭の英数字）
//   shukudai undo <ID>...          未完了に戻す
//   shukudai log [--project 名前] [-n 5]   Claude Code の作業ログ
//   shukudai record --title "何をしたか" --done "成果" [--done ...] [--remaining "残り" ...] [--project 名前]
//                                  今日の作業ログを書く（案件 × 日付で1件。同じ日は足していく）
//   shukudai projects              案件の一覧
//
// add に --auto を付けると「Claude が自分の判断で入れた宿題」として覚える（一覧に「自動」と出る）。
// 自動の宿題は、会話で終わったと分かったら Claude が done にしてよい。それ以外はユーザーが言ったときだけ。
//
// --project を省くと、今いるフォルダに紐づく案件を使う（add / log）。
// 設定は ~/.claude/hooks/management-app.env を読む。
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK_DIR = path.join(os.homedir(), ".claude", "hooks");
const ENV_FILE = path.join(HOOK_DIR, "management-app.env");
const STATE_DIR = path.join(HOOK_DIR, "state");
const AUTO_FILE = path.join(STATE_DIR, "auto-tasks.json"); // Claude が自分の判断で入れた宿題の ID
const RECORDED_FILE = path.join(STATE_DIR, "last-record.json"); // フォルダごとの、最後に作業ログを書いた時刻
const WORKSPACE = path.join(os.homedir(), "workspace", "projects");
const GROUPS = new Set(["comvace-work", "sai-work", "my-work", "aaa"]); // この下は「フォルダ1つ = 案件1つ」

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // 下でまとめてエラーにする
  }
  return env;
}

const env = loadEnv();
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY || !env.MANAGEMENT_USER_ID) {
  console.error(`設定が見つかりません: ${ENV_FILE}`);
  process.exit(1);
}
const UID = env.MANAGEMENT_USER_ID;

async function api(method, pathAndQuery, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// 引数を「オプション」と「それ以外」に分ける
function parse(argv) {
  const opts = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") opts.all = true;
    else if (a === "--auto") opts.auto = true;
    else if (a === "--done" || a === "--remaining") {
      // 何度でも書ける
      const k = a.slice(2);
      (opts[k] ??= []).push(argv[++i] ?? "");
    } else if (a === "--project" || a === "--due" || a === "--owner" || a === "-n" || a === "--title")
      opts[a.replace(/^-+/, "")] = argv[++i];
    else rest.push(a);
  }
  return { opts, rest };
}

const real = (p) => {
  try {
    // macOS は「ダ」などの濁点を NFD で返すことがあり、DB の文字列（NFC）と一致しない。NFC にそろえる
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return null;
  }
};

// 未登録のフォルダが「案件にしてよい場所」なら、そのルートを返す。
// ~/workspace/projects の決まった階層か、それ以外なら git リポジトリ。ワークツリーは元のリポジトリ扱い
function projectRootOf(cwd) {
  const here = real(cwd.replace(/\/\.claude\/worktrees\/[^/]+.*$/, "")) ?? real(cwd);
  const home = real(os.homedir());
  const workspace = real(WORKSPACE);
  if (!here || !home) return null;
  const under = (c, p) => c === p || c.startsWith(p + path.sep);
  if (workspace && under(here, workspace) && here !== workspace) {
    const parts = path.relative(workspace, here).split(path.sep);
    if (GROUPS.has(parts[0])) return parts[1] ? path.join(workspace, parts[0], parts[1]) : null;
    return path.join(workspace, parts[0]);
  }
  for (let cur = here; under(cur, home) && cur !== home; cur = path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, ".git"))) return cur;
  }
  return null;
}

async function loadProjects() {
  return api("GET", `projects?user_id=eq.${UID}&select=id,name,client,status,repo_path&order=name`);
}

// 名前の一部、または今いるフォルダから案件を1つ決める
function pickProject(projects, name) {
  if (name) {
    const hits = projects.filter((p) => p.name.includes(name));
    const active = hits.filter((p) => p.status !== "アーカイブ");
    const list = active.length ? active : hits;
    if (list.length === 1) return list[0];
    const exact = list.find((p) => p.name === name);
    if (exact) return exact;
    if (list.length === 0) throw new Error(`案件「${name}」が見つかりません（shukudai projects で確認）`);
    throw new Error(`案件「${name}」が複数あります: ${list.map((p) => p.name).join(" / ")}`);
  }
  const here = real(process.cwd());
  let best = null;
  for (const p of projects) {
    const rp = p.repo_path && real(p.repo_path);
    if (!rp || !here) continue;
    if ((here === rp || here.startsWith(rp + path.sep)) && (!best || rp.length > best.len)) best = { p, len: rp.length };
  }
  return best?.p ?? null;
}

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());

function dueLabel(due) {
  if (!due) return "";
  const t = today();
  if (due < t) return `〆${due}（期限切れ）`;
  if (due === t) return `〆${due}（今日）`;
  return `〆${due}`;
}

// ID の先頭数文字から宿題を特定する
async function resolveIds(prefixes) {
  const rows = await api("GET", `action_items?user_id=eq.${UID}&select=id,content,done&order=created_at.desc&limit=500`);
  return prefixes.map((p) => {
    const hits = rows.filter((r) => r.id.startsWith(p.toLowerCase()));
    if (hits.length === 0) throw new Error(`ID「${p}」の宿題が見つかりません`);
    if (hits.length > 1) throw new Error(`ID「${p}」に当てはまる宿題が複数あります。もう少し長く指定してください`);
    return hits[0];
  });
}

async function main() {
  const [cmd = "list", ...argv] = process.argv.slice(2);
  const { opts, rest } = parse(argv);

  if (cmd === "list") {
    const projects = await loadProjects();
    const names = new Map(projects.map((p) => [p.id, p.name]));
    let q = `action_items?user_id=eq.${UID}&done=eq.false&select=id,owner,content,due_date,project_id&order=due_date.asc.nullslast,created_at.asc`;
    if (opts.project) q += `&project_id=eq.${pickProject(projects, opts.project).id}`;
    const rows = await api("GET", q);
    const mine = rows.filter((r) => r.owner === "自分");
    const others = rows.filter((r) => r.owner !== "自分");
    const auto = readJson(AUTO_FILE);
    const line = (r) =>
      `${r.id.slice(0, 6)}  ${r.content}` +
      [
        r.project_id ? `［${names.get(r.project_id) ?? "?"}］` : "",
        dueLabel(r.due_date),
        r.owner !== "自分" ? `担当:${r.owner}` : "",
        auto[r.id] ? "（自動）" : "",
      ]
        .filter(Boolean)
        .map((s) => `  ${s}`)
        .join("");
    console.log(`自分の宿題（${mine.length}）`);
    console.log(mine.length ? mine.map(line).join("\n") : "  なし");
    if (opts.all) {
      console.log(`\n相手の対応待ち（${others.length}）`);
      console.log(others.length ? others.map(line).join("\n") : "  なし");
    } else if (others.length) {
      console.log(`\n（相手の対応待ちが ${others.length} 件。--all で表示）`);
    }
    return;
  }

  if (cmd === "add") {
    const content = rest.join(" ").trim();
    if (!content) throw new Error('内容を指定してください: shukudai add "内容"');
    if (opts.due && !/^\d{4}-\d{2}-\d{2}$/.test(opts.due)) throw new Error("--due は 2026-11-20 の形で指定してください");
    const project = pickProject(await loadProjects(), opts.project);
    const rows = await api("POST", "action_items", {
      user_id: UID,
      project_id: project?.id ?? null,
      owner: opts.owner || "自分",
      content,
      due_date: opts.due || null,
    });
    if (opts.auto) {
      const auto = readJson(AUTO_FILE);
      auto[rows[0].id] = { at: new Date().toISOString() };
      writeJson(AUTO_FILE, auto);
    }
    console.log(`追加: ${rows[0].id.slice(0, 6)}  ${content}${project ? `  ［${project.name}］` : ""}${opts.due ? `  〆${opts.due}` : ""}`);
    return;
  }

  // 今日の作業ログを書く。案件 × 日付（日本時間）で1件。同じ日に何度呼んでも1件に足していく
  if (cmd === "record") {
    const clean = (list) => (list ?? []).map((t) => String(t).trim().slice(0, 140)).filter(Boolean);
    const title = String(opts.title ?? "").trim().slice(0, 60);
    const done = clean(opts.done);
    if (!title || done.length === 0) throw new Error('使い方: shukudai record --title "何をしたか" --done "成果" [--remaining "残り"]');

    const projects = await loadProjects();
    let project = pickProject(projects, opts.project);
    if (!project && !opts.project) {
      // 未登録のフォルダでも、案件にしてよい場所なら作る
      const root = projectRootOf(process.cwd());
      if (root) {
        const inside = projects.filter((p) => {
          const rp = p.repo_path && real(p.repo_path);
          return rp && (rp === root || rp.startsWith(root + path.sep));
        });
        if (inside.length === 1) project = inside[0];
        else {
          project = (await api("POST", "projects", { user_id: UID, name: path.basename(root), repo_path: root, status: "運用中" }))[0];
          console.log(`案件を作成: ${project.name}`);
        }
      }
    }
    if (project && project.status === "アーカイブ") {
      await api("PATCH", `projects?id=eq.${project.id}`, { status: "運用中" });
    }

    const date = today();
    const next = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(
      new Date(new Date(`${date}T12:00:00+09:00`).getTime() + 86400000),
    );
    const range =
      `created_at=gte.${encodeURIComponent(`${date}T00:00:00+09:00`)}` +
      `&created_at=lt.${encodeURIComponent(`${next}T00:00:00+09:00`)}`;
    const pFilter = project ? `project_id=eq.${project.id}` : "project_id=is.null";
    const rows = await api(
      "GET",
      `activity_log?user_id=eq.${UID}&action=eq.session&${pFilter}&${range}&select=id,detail&order=created_at.desc&limit=1`,
    );
    let before = { done: [], remaining: [] };
    try {
      if (rows[0]) before = { done: [], remaining: [], ...JSON.parse(rows[0].detail) };
    } catch {
      // 古い形式の行は上書きする
    }
    // やったことは足していく（同じ文は1つに。多すぎたら新しい方を残す）。残りは今回の内容で置き換える
    const merged = [...new Set([...(before.done ?? []), ...done])].slice(-12);
    const detail = JSON.stringify({ title, done: merged, remaining: clean(opts.remaining) });
    const row = { project_id: project?.id ?? null, detail, created_at: new Date().toISOString() };
    if (rows[0]) await api("PATCH", `activity_log?id=eq.${rows[0].id}`, row);
    else await api("POST", "activity_log", { ...row, user_id: UID, action: "session", source: "claude_code" });

    const cwd = real(process.cwd());
    if (cwd) writeJson(RECORDED_FILE, { ...readJson(RECORDED_FILE), [cwd]: Date.now() });
    console.log(`記録: ${date} ${project ? `［${project.name}］` : "（案件なし）"} ${title}（やったこと ${merged.length}件・残り ${clean(opts.remaining).length}件）`);
    return;
  }

  if (cmd === "done" || cmd === "undo") {
    if (rest.length === 0) throw new Error(`ID を指定してください: shukudai ${cmd} <ID>`);
    const done = cmd === "done";
    for (const item of await resolveIds(rest)) {
      await api("PATCH", `action_items?id=eq.${item.id}&user_id=eq.${UID}`, {
        done,
        done_at: done ? new Date().toISOString() : null,
      });
      if (done) {
        const auto = readJson(AUTO_FILE);
        if (auto[item.id]) {
          delete auto[item.id];
          writeJson(AUTO_FILE, auto);
        }
      }
      console.log(`${done ? "完了" : "未完了に戻した"}: ${item.content}`);
    }
    return;
  }

  if (cmd === "log") {
    const projects = await loadProjects();
    const names = new Map(projects.map((p) => [p.id, p.name]));
    const project = pickProject(projects, opts.project);
    const n = Math.min(Math.max(Number(opts.n) || 5, 1), 30);
    let q = `activity_log?user_id=eq.${UID}&action=eq.session&select=project_id,detail,created_at&order=created_at.desc&limit=${n}`;
    if (project) q += `&project_id=eq.${project.id}`;
    const rows = await api("GET", q);
    if (rows.length === 0) return console.log("作業ログはまだありません。");
    for (const r of rows) {
      let d = {};
      try {
        d = JSON.parse(r.detail);
      } catch {
        d = { title: r.detail };
      }
      const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(r.created_at));
      console.log(`■ ${day}  ${d.title ?? ""}${r.project_id ? `  ［${names.get(r.project_id) ?? "?"}］` : ""}`);
      for (const s of d.done ?? []) console.log(`  ・${s}`);
      for (const s of d.remaining ?? []) console.log(`  残り: ${s}`);
    }
    return;
  }

  if (cmd === "projects") {
    const projects = (await loadProjects()).filter((p) => opts.all || p.status !== "アーカイブ");
    for (const p of projects) console.log(`${p.name}${p.client ? `（${p.client}）` : ""}  ${p.status}`);
    return;
  }

  console.error("使い方: shukudai [list|add|done|undo|log|record|projects]（詳しくはファイル先頭のコメント）");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
