#!/usr/bin/env node
// ============================================================
// logpass — 案件ごとの URL・ログインID・パスワードを集めて、議事録アプリの「ログパス」に入れる。
//
//   logpass scan [--dry]           全案件の .env・git・メモ・過去の記録から集める
//   logpass scan --cwd <フォルダ>   そのフォルダの案件だけ（作業ログのフックから呼ばれる）
//   logpass add --label 名前 [--project 案件] [--url URL] [--id ログインID] [--secret パスワード] [--note メモ]
//   logpass list [--project 案件]   登録済みの一覧（パスワードは出ない）
//
// 方針:
//   - 集める処理はこのPCの中だけで行う。AI には何も送らない
//   - パスワードは金庫の公開鍵で暗号化してから保存する。このコマンドでは復号できない
//     （見るのはアプリでマスターパスワードを入れたときだけ）
//   - 金庫がまだ無いときは URL だけ入れ、パスワードは次回に回す
//   - Stripe の本番キー（sk_live_ / rk_live_）は絶対に入れない
//   - 画面にも、ログにも、パスワードの値は出さない
//
// 暗号文の形式は src/lib/vault.ts と同じ（"v1.<鍵>.<IV>.<本文>"）。変えるときは両方直す。
// 設定は ~/.claude/hooks/management-app.env を読む。
// ============================================================

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";

const HOOK_DIR = path.join(os.homedir(), ".claude", "hooks");
const ENV_FILE = path.join(HOOK_DIR, "management-app.env");
const STATE_FILE = path.join(HOOK_DIR, "state", "logpass.json");
const MEM0_DIR = path.join(os.homedir(), "workspace", "notes", "mem0-export");
// 過去の記録ファイル名 → 案件名（名前の一部）
const MEM0_ALIAS = { HP: "comvace HP", "gaicyu-madori": "害虫駆除" };

function loadEnvFile(file) {
  const env = {};
  try {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if (/^(["']).*\1$/.test(v)) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, "");
      env[m[1]] = v;
    }
  } catch {
    // 読めないファイルは無視
  }
  return env;
}

const cfg = loadEnvFile(ENV_FILE);
const UID = cfg.MANAGEMENT_USER_ID;

async function api(method, pathAndQuery, body) {
  const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: cfg.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${cfg.SUPABASE_SERVICE_KEY}`,
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

const real = (p) => {
  try {
    // macOS は濁点を NFD で返すことがあるので NFC にそろえる
    return fs.realpathSync(p).normalize("NFC");
  } catch {
    return null;
  }
};
const sha = (s) => createHash("sha256").update(s).digest("hex");

// ---------- 暗号化（公開鍵。src/lib/vault.ts の encryptSecret と同じ） ----------

const RSA = { name: "RSA-OAEP", hash: "SHA-256" };
const b64 = (buf) => Buffer.from(buf).toString("base64");

async function encryptSecret(publicKey, plain) {
  const { subtle } = webcrypto;
  const pub = await subtle.importKey("spki", Buffer.from(publicKey, "base64"), RSA, false, ["encrypt"]);
  const aesRaw = webcrypto.getRandomValues(new Uint8Array(32));
  const aes = await subtle.importKey("raw", aesRaw, "AES-GCM", false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(plain));
  const wrapped = await subtle.encrypt(RSA, pub, aesRaw);
  return `v1.${b64(wrapped)}.${b64(iv)}.${b64(ct)}`;
}

// ---------- 集める ----------

const STRIPE_LIVE = /\b[sr]k_live_/;
const SECRET_NAME = /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|PASS|PWD|PIN|CREDENTIAL|DSN|WEBHOOK)/i;
const PUBLIC_NAME = /(PUBLIC|PUBLISHABLE|ANON)/i;
const PLACEHOLDER = /^(|x+|your[-_ ].*|changeme|todo|dummy|example.*|<.*>|\.\.\.)$/i;

const SERVICES = [
  [/SUPABASE/i, "Supabase"],
  [/STRIPE/i, "Stripe"],
  [/OPENROUTER/i, "OpenRouter"],
  [/ANTHROPIC|CLAUDE/i, "Anthropic"],
  [/OPENAI/i, "OpenAI"],
  [/GEMINI|GOOGLE|GCP/i, "Google"],
  [/VERCEL/i, "Vercel"],
  [/GITHUB|GH_/i, "GitHub"],
  [/RESEND/i, "Resend"],
  [/SENDGRID/i, "SendGrid"],
  [/TWILIO/i, "Twilio"],
  [/LINE/i, "LINE"],
  [/KINTONE/i, "kintone"],
  [/SLACK/i, "Slack"],
  [/DISCORD/i, "Discord"],
  [/N8N/i, "n8n"],
  [/AWS|S3_/i, "AWS"],
  [/DATABASE|POSTGRES|MYSQL|REDIS/i, "データベース"],
  [/SMTP|MAIL/i, "メール"],
];
const serviceOf = (name) => SERVICES.find(([re]) => re.test(name))?.[1] ?? null;

function cleanUrl(u) {
  // URL に埋め込まれたユーザー名・トークンを落とす
  return u.replace(/^(https?:\/\/)[^/@\s]+@/, "$1").replace(/[)\]」。、,.;'"`*]+$/, "");
}
const normUrl = (u) => cleanUrl(u).replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();
const boringUrl = (u) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|example\.(com|org)|.*\.example\.com)/i.test(u) ||
  /\$\{|<|\{\{|x{4,}|\.\.\./i.test(u) ||
  u.length > 300;

function walk(dir, depth, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth > 0 && !/^(node_modules|\.git|\.next|dist|build|out|vendor|\.venv|venv|__pycache__)$/.test(e.name)) {
        walk(p, depth - 1, out);
      }
    } else if (e.isFile()) out.push(p);
  }
}

// .env から：キーやパスワードは「アカウント」、URL は「リンク」
function fromEnvFiles(root) {
  const files = [];
  walk(root, 3, files);
  const found = [];
  for (const file of files) {
    const base = path.basename(file);
    if (!/^\.env(\..+)?$/.test(base) || /(example|sample|template|dist)$/i.test(base)) continue;
    const rel = path.relative(root, file);
    const env = loadEnvFile(file);
    for (const [name, value] of Object.entries(env)) {
      if (PLACEHOLDER.test(value)) continue;
      const service = serviceOf(name);
      if (/^https?:\/\//.test(value) && !SECRET_NAME.test(name) && !WEBHOOK_URL.test(value)) {
        if (boringUrl(value) || /:\/\/[^/@\s]+:[^/@\s]+@/.test(value)) continue;
        found.push({
          key: `env:${rel}#${name}`,
          source: "env",
          label: `${service ?? "URL"}（${name}）`,
          url: cleanUrl(value),
        });
        continue;
      }
      if (!(SECRET_NAME.test(name) || WEBHOOK_URL.test(value)) || PUBLIC_NAME.test(name)) continue;
      if (STRIPE_LIVE.test(value)) {
        found.push({
          key: `env:${rel}#${name}`,
          source: "env",
          label: `Stripe（${name}）`,
          note: "本番キー。Stripe Dashboard > API キーに保管（ここには記録しない）",
        });
        continue;
      }
      // 同じ接頭辞の *_EMAIL / *_USER などをログインIDとして添える
      // 末尾の番号（APP_AUTH_PASSWORD_2 の _2）は相手側にも付ける
      const num = name.match(/_\d+$/)?.[0] ?? "";
      const prefix = name.slice(0, name.length - num.length).replace(/_?(PASSWORD|PASSWD|PASS|PWD|PIN|SECRET|TOKEN|KEY)$/i, "");
      const idName = ["EMAIL", "USER", "USERNAME", "LOGIN", "ID"]
        .map((s) => (prefix ? `${prefix}_${s}` : s) + num)
        .find((n) => env[n]);
      found.push({
        key: `env:${rel}#${name}`,
        source: "env",
        label: `${service ?? prefix.split("_")[0] ?? "キー"}（${name}）`,
        account: idName ? env[idName] : undefined,
        secret: value,
        note: rel,
      });
    }
  }
  return found;
}

// git の接続先（トークンが埋まっていても落とす）
function fromGit(root) {
  try {
    const raw = execFileSync("git", ["-C", root, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
    if (!raw) return [];
    const ssh = raw.match(/^git@([^:]+):(.+?)(\.git)?$/);
    const url = ssh ? `https://${ssh[1]}/${ssh[2]}` : cleanUrl(raw).replace(/\.git$/, "");
    if (!/^https?:\/\//.test(url)) return [];
    return [{ key: "git:origin", source: "git", label: /github\.com/.test(url) ? "GitHub リポジトリ" : "git リポジトリ", url }];
  } catch {
    return [];
  }
}

// 英単語は前後が英字でないときだけ拾う（"shopping" の pin や "valid" の id を拾わない）
const ID_WORD = "(?:アカウント名|アカウント|ログインID|ログイン|ユーザー名|ユーザーID|メールアドレス|メール|(?<![A-Za-z])(?:e-?mail|user(?:name)?|login|ID)(?![A-Za-z]))";
const PW_WORD = "(?:パスワード|暗証番号|(?<![A-Za-z])(?:password|passwd|pass|PW|PIN)(?![A-Za-z]))";
const URL_RE = /https?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'*+,;=%]+/g;
// 知っている人なら誰でも叩ける URL（Webhook）は、パスワードと同じ扱いにする
const WEBHOOK_URL = /^https?:\/\/(hook\.[a-z0-9]+\.make\.com|hooks\.slack\.com|hooks\.zapier\.com|(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks)|\/webhook(-test)?\//i;
// 一般的な説明ページは集めない
const DOC_URL = /^https?:\/\/((www\.)?(nextjs\.org|react\.dev|tailwindcss\.com|npmjs\.com|stackoverflow\.com|developer\.mozilla\.org|claude\.ai|claude\.com|anthropic\.com)|docs\.|[^/]+\/(docs|font|help|faq)(\/|$))/i;
const VALUE = "[`「\"']?([!-~]{3,})";
const SEP = "\\s*(?:[:：=]|は)?\\s*";
const PW_RE = new RegExp(`${PW_WORD}${SEP}${VALUE}`, "gi");
const ID_RE = new RegExp(`${ID_WORD}${SEP}${VALUE}`, "gi");
const TOKEN_RE =
  /\b(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{16,}|sbp_[A-Za-z0-9]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,})/g;
const trimValue = (v) => v.replace(/[、。,.;:)」`"'*]+$/, "");
// 文章中の単語（"password reset" など）を拾わないよう、数字か記号か大小文字の混在を求める
const looksSecret = (v) => v.length >= 4 && (/\d/.test(v) || /[^A-Za-z0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v)));

// メモ（Markdown）から機械的に拾う。精度は高くないので「要確認」を付ける
function fromMemo(file, relKey) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  if (text.length > 400000) return [];
  const lines = text.split("\n");
  const found = [];
  const seenUrl = new Set();
  let heading = "";
  let n = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^#{1,4}\s+(.+)/);
    if (h) heading = h[1].trim();
    // 行の見出し部分（"- **日付** — 件名: 本文" の件名）を名前に使う
    // 表の行は、セルの中身（人名など）を名前にしない
    const isTable = /^\s*\|/.test(line);
    const body = line
      .replace(/^\s*[-*]\s*/, "")
      .replace(/^\*\*[^*]*\*\*\s*[—–-]?\s*/, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(URL_RE, "");
    const title = ((isTable ? "" : body.split(/[:：]/)[0]) || heading || path.basename(file, ".md"))
      .replace(/[`*#|]/g, "")
      .trim()
      .slice(0, 50);
    const allUrls = (line.match(URL_RE) ?? []).map(cleanUrl).filter((u) => !boringUrl(u));
    const urls = allUrls.filter((u) => !WEBHOOK_URL.test(u) && !DOC_URL.test(u));

    const secrets = [];
    for (const m of line.matchAll(PW_RE)) {
      const v = trimValue(m[1]);
      if (looksSecret(v) && !/^https?:/.test(v)) secrets.push({ value: v, at: m.index });
    }
    for (const m of line.matchAll(TOKEN_RE)) secrets.push({ value: m[1], at: m.index, token: true });
    for (const u of allUrls.filter((x) => WEBHOOK_URL.test(x))) secrets.push({ value: u, at: 0, token: true, webhook: true });

    for (const s of secrets) {
      if (STRIPE_LIVE.test(s.value)) continue;
      // 同じ行で、パスワードより手前にある一番近い ID
      let account;
      if (!s.token) {
        for (const m of line.matchAll(ID_RE)) {
          if (m.index < s.at) account = trimValue(m[1]);
        }
        if (account && (PW_RE.test(account) || account.length > 80)) account = undefined;
        PW_RE.lastIndex = 0;
      }
      n += 1;
      found.push({
        key: `memo:${relKey}:${sha(`${title}|${account ?? ""}|${n}`).slice(0, 12)}`,
        source: "memo",
        review: true,
        label: s.webhook ? `${title || "Webhook"}（Webhook）` : title || "メモから",
        account,
        secret: s.value,
        url: s.webhook ? new URL(s.value).origin : urls[0],
        note: `${relKey} から自動で拾った`,
      });
    }

    if (secrets.length === 0) {
      for (const u of urls) {
        let host = "";
        try {
          host = new URL(u).host.replace(/^www\./, "");
        } catch {
          continue;
        }
        // メモの URL は、同じサイトにつき最初の1件だけ（一覧が埋もれないように）
        if (seenUrl.has(host)) continue;
        seenUrl.add(host);
        const nu = host;
        found.push({
          key: `memo:${relKey}:${sha(nu).slice(0, 12)}`,
          source: "memo",
          review: true,
          label: title && title.length <= 40 && !/https?:/.test(title) ? `${title}（${host}）` : host,
          url: u,
          note: `${relKey} から自動で拾った`,
        });
      }
    }
  }
  return found;
}

function memoFilesOf(root) {
  const files = [];
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) files.push(p);
  }
  const notes = [];
  walk(path.join(root, "notes"), 2, notes);
  return files.concat(notes.filter((f) => f.endsWith(".md"))).slice(0, 80);
}

// ---------- 保存 ----------

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function scan({ cwd, dry, quiet, verbose }) {
  const say = (s) => !quiet && console.log(s);
  const projects = await api("GET", `projects?user_id=eq.${UID}&select=id,name,repo_path,status`);
  // 試し読みは、DB の準備（0007）が済んでいなくても動くようにする
  const orEmpty = (p) => (dry ? p.catch(() => []) : p);
  const vault = (await orEmpty(api("GET", `vaults?user_id=eq.${UID}&select=public_key`)))[0] ?? null;
  const existing = await orEmpty(
    api("GET", `project_resources?user_id=eq.${UID}&select=id,project_id,url,source_key`),
  );
  const byKey = new Map(existing.filter((r) => r.source_key).map((r) => [r.source_key, r]));
  // 手で登録済みの URL と重ならないようにする
  const manualUrls = new Set(
    existing.filter((r) => !r.source_key && r.url).map((r) => `${r.project_id ?? ""}|${normUrl(r.url)}`),
  );

  // 対象の案件を決める
  const targets = [];
  const here = cwd ? real(cwd) : null;
  for (const p of projects) {
    const root = p.repo_path && real(p.repo_path);
    if (!root) continue;
    if (here && !(here === root || here.startsWith(root + path.sep))) continue;
    targets.push({ project: p, root });
  }

  const items = [];
  for (const { project, root } of targets) {
    const rel = (f) => path.relative(root, f);
    const list = [
      ...fromGit(root),
      ...fromEnvFiles(root),
      ...memoFilesOf(root).flatMap((f) => fromMemo(f, rel(f))),
    ];
    for (const it of list) items.push({ ...it, project_id: project.id, key: `${project.id}:${it.key}` });
  }
  // 過去の記録（全体スキャンのときだけ）
  if (!cwd && fs.existsSync(MEM0_DIR)) {
    for (const f of fs.readdirSync(MEM0_DIR).filter((n) => n.endsWith(".md") && n !== "README.md")) {
      const stem = path.basename(f, ".md").normalize("NFC");
      const want = MEM0_ALIAS[stem] ?? stem;
      const p =
        projects.find((x) => x.name.includes(want) && x.status !== "アーカイブ") ??
        projects.find((x) => x.name.includes(want)) ??
        projects.find((x) => (x.repo_path ?? "").normalize("NFC").split("/").includes(want));
      for (const it of fromMemo(path.join(MEM0_DIR, f), `mem0-export/${stem}.md`)) {
        items.push({ ...it, project_id: p?.id ?? null, key: `${p?.id ?? "none"}:${it.key}` });
      }
    }
  }

  const state = readState();
  const stat = { 追加: 0, 更新: 0, 変更なし: 0, 保留: 0, 重複: 0 };
  const seen = new Set();
  for (const it of items) {
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    const hasSecret = typeof it.secret === "string";
    // メモ由来は、同じ案件の中で同じサイト・同じパスワードを何度も入れない（照合はこの場かぎり）
    if (it.source === "memo") {
      let mark = null;
      if (hasSecret) mark = `${it.project_id}|s|${sha(it.secret)}`;
      else if (it.url) {
        try {
          mark = `${it.project_id}|u|${new URL(it.url).host.replace(/^www\./, "")}`;
        } catch {
          mark = null;
        }
      }
      if (mark && seen.has(mark)) {
        stat.重複 += 1;
        continue;
      }
      if (mark) seen.add(mark);
    }
    // 同じ案件で同じ URL が手入力済みなら、URL だけの行は足さない
    if (!hasSecret && it.url && manualUrls.has(`${it.project_id ?? ""}|${normUrl(it.url)}`)) {
      stat.重複 += 1;
      continue;
    }
    if (hasSecret && !vault) {
      stat.保留 += 1; // 金庫ができてから入れる
      continue;
    }
    const digest = sha(JSON.stringify([it.label, it.url ?? "", it.account ?? "", it.secret ?? "", it.note ?? ""]));
    const row = byKey.get(it.key);
    if (row && state[it.key] === digest) {
      stat.変更なし += 1;
      continue;
    }
    if (dry) {
      stat[row ? "更新" : "追加"] += 1;
      continue;
    }
    const data = {
      project_id: it.project_id,
      type: hasSecret || it.account ? "account" : "link",
      label: it.label,
      url: it.url ?? null,
      account: it.account ?? null,
      note: it.note ?? null,
      secret_enc: hasSecret ? await encryptSecret(vault.public_key, it.secret) : null,
      source: it.source,
      updated_at: new Date().toISOString(),
    };
    if (row) {
      await api("PATCH", `project_resources?id=eq.${row.id}`, data);
      stat.更新 += 1;
    } else {
      await api("POST", "project_resources", {
        ...data,
        user_id: UID,
        source_key: it.key,
        needs_review: !!it.review,
      });
      stat.追加 += 1;
    }
    state[it.key] = digest;
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  }

  say(`${dry ? "（試し読み）" : ""}案件 ${targets.length} 件を確認: ` + Object.entries(stat).map(([k, v]) => `${k} ${v}`).join(" / "));
  if (stat.保留) say("金庫がまだ無いので、パスワード・キーは保留にしました。アプリの「ログパス」で金庫を作ってから、もう一度 logpass scan を実行してください。");
  if (dry) {
    const perSource = {};
    for (const it of items) {
      const k = `${it.source}${typeof it.secret === "string" ? "（パスワード・キー）" : "（URL）"}`;
      perSource[k] = (perSource[k] ?? 0) + 1;
    }
    say("内訳: " + Object.entries(perSource).map(([k, v]) => `${k} ${v}`).join(" / "));
    if (verbose) {
      // 中身の確認用。パスワード・キーの値は出さない（有無だけ）
      const names = new Map(projects.map((p) => [p.id, p.name]));
      for (const it of items) {
        say(
          [it.source, names.get(it.project_id) ?? "案件なし", it.label, it.url ?? "", it.account ? "ID:あり" : "", typeof it.secret === "string" ? "PW:あり" : ""]
            .filter(Boolean)
            .join(" | "),
        );
      }
    }
  }
}

function parse(argv) {
  const opts = {};
  const flags = new Set(["--dry", "--quiet", "--verbose"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (flags.has(a)) opts[a.slice(2)] = true;
    else if (a.startsWith("--")) opts[a.slice(2)] = argv[++i];
  }
  return opts;
}

function pickProject(projects, name, cwd) {
  if (name) {
    const hits = projects.filter((p) => p.name.includes(name));
    const active = hits.filter((p) => p.status !== "アーカイブ");
    const list = active.length ? active : hits;
    if (list.length === 1) return list[0];
    if (list.length === 0) throw new Error(`案件「${name}」が見つかりません`);
    throw new Error(`案件「${name}」が複数あります: ${list.map((p) => p.name).join(" / ")}`);
  }
  const here = real(cwd);
  let best = null;
  for (const p of projects) {
    const rp = p.repo_path && real(p.repo_path);
    if (!rp || !here) continue;
    if ((here === rp || here.startsWith(rp + path.sep)) && (!best || rp.length > best.len)) best = { p, len: rp.length };
  }
  return best?.p ?? null;
}

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const opts = parse(argv);
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_SERVICE_KEY || !UID) throw new Error(`設定が見つかりません: ${ENV_FILE}`);

  if (cmd === "scan") return scan({ cwd: opts.cwd, dry: !!opts.dry, quiet: !!opts.quiet, verbose: !!opts.verbose });

  if (cmd === "add") {
    if (!opts.label) throw new Error("--label（名前）を指定してください");
    if (opts.secret && STRIPE_LIVE.test(opts.secret)) throw new Error("Stripe の本番キーは記録しません（Stripe Dashboard に保管）");
    const projects = await api("GET", `projects?user_id=eq.${UID}&select=id,name,repo_path,status`);
    const project = pickProject(projects, opts.project, process.cwd());
    let secretEnc = null;
    if (opts.secret) {
      const vault = (await api("GET", `vaults?user_id=eq.${UID}&select=public_key`))[0];
      if (!vault) throw new Error("金庫がまだありません。アプリの「ログパス」で金庫を作ってください");
      secretEnc = await encryptSecret(vault.public_key, opts.secret);
    }
    await api("POST", "project_resources", {
      user_id: UID,
      project_id: project?.id ?? null,
      type: secretEnc || opts.id ? "account" : "link",
      label: opts.label,
      url: opts.url ? cleanUrl(opts.url) : null,
      account: opts.id ?? null,
      note: opts.note ?? null,
      secret_enc: secretEnc,
      source: "claude",
    });
    console.log(`登録: ${opts.label}${project ? `  ［${project.name}］` : ""}${secretEnc ? "（パスワードは暗号化して保存）" : ""}`);
    return;
  }

  if (cmd === "list") {
    const projects = await api("GET", `projects?user_id=eq.${UID}&select=id,name,repo_path,status`);
    const names = new Map(projects.map((p) => [p.id, p.name]));
    let q = `project_resources?user_id=eq.${UID}&select=project_id,label,url,account,secret_enc&order=label`;
    if (opts.project) q += `&project_id=eq.${pickProject(projects, opts.project, process.cwd()).id}`;
    for (const r of await api("GET", q)) {
      console.log(
        [r.label, r.project_id ? `［${names.get(r.project_id) ?? "?"}］` : "", r.url ?? "", r.account ? `ID:${r.account}` : "", r.secret_enc ? "PW:あり（アプリで表示）" : ""]
          .filter(Boolean)
          .join("  "),
      );
    }
    return;
  }

  console.error("使い方: logpass scan [--dry] [--cwd フォルダ] | add --label 名前 [...] | list [--project 案件]");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
