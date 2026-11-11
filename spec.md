# 議事録アプリ 仕様書

個人用の議事録アプリ。打ち合わせを録音すると、文字起こし・要約・決定事項・宿題の抽出まで自動で行う。

2026-11-11 に、案件・タスク管理アプリから作り替えた（Supabase と Vercel は同じものを使い続けている）。
旧アプリのコードは git 履歴（`298dbbc` 以前）に、旧テーブル（phases / tasks など）は DB に残っている。

---

## 1. 設計の軸

- **入力しない**。録音ボタンを押すだけで記録が残る。旧アプリは手入力が続かず使われなくなった。
- **読み返さなくても役に立つ**。議事録から宿題を抜き出して一覧にし、次の打ち合わせ前に前回のまとめを出す。
- **事実だけを書く**。AI は文字起こしにある内容だけを使い、決定事項や宿題を推測で作らない。
- 宿題の完了は人が手でチェックする。AI が勝手に完了にしない。

## 2. 技術構成

| 領域 | 採用 |
|---|---|
| フロント / サーバー | Next.js（App Router）+ TypeScript + Tailwind |
| DB / 認証 | Supabase（PostgreSQL + Auth + RLS） |
| ホスティング | Vercel |
| 文字起こし | OpenRouter 経由の `google/gemini-2.5-flash`（音声入力） |
| 議事録の整理 | OpenRouter 経由の `anthropic/claude-sonnet-4.6` |

環境変数 `ANTHROPIC_API_KEY` には **OpenRouter のキー（`sk-or-`）** が入っている（名前は歴史的経緯）。
AI の呼び出しは `src/lib/ai.ts` にまとめ、Route Handler からのみ使う。

## 3. 画面

| パス | 内容 |
|---|---|
| `/` | ホーム。録音ボタン、自分の宿題、相手の対応待ち、最近の議事録、Claude Code の最近の作業 |
| `/record` | 録音。案件とタイトルは任意。録音中は1分ごとに文字起こしが増える |
| `/meetings` | 議事録の一覧。タイトル・要約・文字起こしを横断検索 |
| `/meetings/[id]` | 議事録。要約、決まったこと、宿題、次回確認すること、メール下書き、文字起こし全文 |
| `/actions` | 宿題の一覧。自分の分と相手待ちを分け、期限の近い順 |
| `/projects` | 案件の一覧。最後に動いた日（打ち合わせ・Claude Code の作業）、作業日数、未完了の宿題数 |
| `/projects/[id]` | 案件。次の打ち合わせ前に見る前回のまとめ、未完了の宿題、議事録、Claude Code の作業ログ |
| `/accounts` | ログパス。案件ごとの URL・ログインID・パスワード（8章） |
| `/login` | PIN でロック解除 |

## 4. 録音から議事録までの流れ

1. ブラウザがマイクの音を取り、16kHz モノラルの WAV に変換する（`src/components/Recorder.tsx`）。
   PC のブラウザでは、オンライン会議のタブ音声も一緒に録れる。
2. 60秒ごとに1断片（約1.9MB）を `POST /api/meetings/[id]/chunk?seq=N` へ送る。
   サーバーが文字起こしして `meeting_segments` に保存し、画面に表示する。
   ほぼ無音の断片は送らない。送信は3回まで再試行する。
3. 終了ボタンで `POST /api/meetings/[id]/finalize` を呼ぶ。断片をつないで議事録を作り、
   `meetings` を更新し、宿題を `action_items` に入れる。
4. 録音が途中で切れた場合、議事録の画面から「ここまでの内容で議事録を作る」で救済できる。
   議事録の作り直しも同じ API を使う（その打ち合わせの宿題は作り直される）。

### 宿題の担当（owner）

- 録音した本人の宿題は `自分`、相手側は名前や会社名、判別できなければ `未定`。
- 画面では `自分` とそれ以外（相手の対応待ち）に分けて表示する。

## 5. データベース

案件は既存の `projects`（name / client / status）をそのまま使う。status が `アーカイブ` の案件は一覧に出さない。
追加したテーブルは `supabase/migrations/0006_meetings.sql` の3つで、すべて RLS で本人のみ。
ログパス用の `vaults` と `project_resources` の拡張は `0007_vault.sql`（8章）。

| テーブル | 役割 |
|---|---|
| `meetings` | 打ち合わせ1回分。status は `recording`（議事録未作成）/ `done` |
| `meeting_segments` | 録音中に届く文字起こし断片。`(meeting_id, seq)` で一意 |
| `action_items` | 宿題。owner / content / due_date / done |

## 6. 認証

PIN を入れると、サーバーが環境変数に持つ Supabase アカウントでサインインする（PIN ごとに別アカウント）。
`APP_PIN` / `APP_PIN_2` の2アカウント。データは RLS でアカウントごとに分かれる。

## 7. Claude Code との連携

アプリの外（このPC）で動く仕組み。ソースは `claude/` にあり、`~/.claude/hooks/` と `~/bin/` へコピーして使う。
どちらも Supabase を直接読み書きする（設定は `~/.claude/hooks/management-app.env`）。

### 7.1 作業ログの自動記録（`claude/session-log.mjs`）

- Claude Code の Stop / SessionEnd フックから呼ばれる。最後のやりとりから20分動きが無いとき、
  またはセッション終了時に、会話を AI（OpenRouter の `google/gemini-2.5-flash`）で要約する。
- **記録の単位は「セッション × 日付（日本時間）」で、1日1行**。Claude Code のセッションは何か月も続くことがあるため。
  同じ日の続きがあれば、その日の行を書き直す。
- 送るのは1日あたり最大1万6千字。キーやトークンらしい文字列は送る前に伏せ字にする。
- **案件は、その日に触ったファイルの場所の多数決で決める**（作業フォルダがホームでも案件が分かる）。
  `projects.repo_path` に当てはまればその案件。未登録でも、git リポジトリか `~/workspace/projects/` の
  決まった階層のフォルダなら案件を作る。2026-09 以降に作業があったアーカイブ案件は「運用中」に戻す。
- 「やったこと・残り」を `activity_log`（action = `session`）に保存し、ホーム・案件一覧・案件ページに表示する。
- 直近2日の会話については、残りのうち本人が後でやる必要があるものを `action_items`（担当 `自分`）に追加する。
  既存の未完了の宿題と同じ内容は追加しない。**完了チェックは付けない**。
- `node ~/.claude/hooks/session-log.mjs backfill [--dry] [--since 日付]` で、過去の会話（`~/.claude/projects/`）を
  まとめて取り込める。取り込みでは宿題を作らず、安いモデル（`gemini-2.5-flash-lite`）を使う。

### 7.2 宿題の読み書き（`claude/shukudai.mjs` → `~/bin/shukudai`）

`shukudai`（一覧）/ `add` / `done` / `undo` / `log` / `projects`。
Claude Code に「今日やることは？」「これ終わった」と言うと、Claude がこのコマンドを使う
（使い方は `~/.claude/CLAUDE.md` に書いてある）。完了にするのはユーザーが言ったときだけ。

### 7.3 URL・ログイン情報の自動収集（`claude/logpass.mjs` → `~/bin/logpass`）

- `logpass scan` が、各案件の `.env`、git の接続先、`CLAUDE.md` と `notes/`、過去の記録
  （`~/workspace/notes/mem0-export/`）から URL・ログインID・パスワード・キーを集めて `project_resources` に入れる。
  作業ログの記録のあとに、その案件の分だけ自動で走る。
- 集める処理はこのPCの中だけで行い、AI には送らない。
- パスワード・キー・Webhook の URL は、金庫の公開鍵で暗号化してから保存する。金庫が無いあいだは保留にする。
- メモから機械的に拾ったものは精度が高くないので `needs_review`（要確認）を付ける。
- Stripe の本番キー（`sk_live_` / `rk_live_`）は保存しない。
- Claude Code の会話に出てきたログイン情報は、Claude が `logpass add` で登録する（`~/.claude/CLAUDE.md` に指示がある）。

## 8. ログパス（URL・ログインID・パスワード）

画面は `/accounts`。案件ごとに URL・ログインID・パスワードを並べる。データは `project_resources`（旧アプリのテーブルを拡張）。

- **パスワードは暗号化した文字列（`secret_enc`）だけを DB に置く**。URL・名前・ログインID は平文。
- 利用者ごとに RSA の鍵ペアを1つ持つ（`vaults`）。公開鍵で暗号化し、秘密鍵で復号する。
  秘密鍵は、マスターパスワードから作った鍵（PBKDF2 60万回 → AES-GCM）で暗号化して置く。
- 保存（追加・自動収集）はマスターパスワード無しでできる。表示・コピーは、画面でマスターパスワードを入れたあいだだけ。
  復号はブラウザの中で行い、マスターパスワードも復号後の値もサーバーに送らない。再読み込みするとロックされる。
- マスターパスワードは PIN とは別（10文字以上）。**忘れると復元できない**。
  作り直すときは `vaults` の行と `secret_enc` のある行を消して、金庫を作り直し、`logpass scan` をやり直す。
- 暗号の実装は `src/lib/vault.ts`（ブラウザ）と `claude/logpass.mjs`（PC）。形式を変えるときは両方直す。

## 9. 制約と未対応

- スマホは画面を閉じたりアプリを切り替えたりすると録音が止まる。録音中は画面を開いたままにする。
- 話者の区別はしていない。
- 60秒の区切りで言葉が途切れることがある（議事録の内容にはほぼ影響しない）。
- 音声ファイル自体は保存していない。残るのは文字起こしだけ。
