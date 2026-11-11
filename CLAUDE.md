# 議事録アプリ

打ち合わせを録音すると、文字起こし・要約・決定事項・宿題の抽出まで行う個人用アプリ。
2026-11-11 に案件・タスク管理アプリから作り替えた（フォルダ名は旧名のまま）。

**仕様は [spec.md](spec.md)、セットアップは [README.md](README.md) に詳しくある。**
ここには実装時に気をつけることを書く。

## 技術構成

- Next.js（App Router）+ TypeScript + Tailwind（ライト基調のミニマル）
- Supabase（PostgreSQL + Auth + **RLS**）
- Vercel ホスティング（GitHub `hkazushi/management-app` の `main` で自動デプロイ）
- AI は **OpenRouter** 経由。文字起こし `google/gemini-2.5-flash`、議事録の整理 `anthropic/claude-sonnet-4.6`

---

## 変更後の検証（必須）

コードを変更したら、完了報告の前に必ず以下を順に実行し、すべて通ることを確認する。

1. `npx tsc --noEmit` … 型エラーの検出
2. `npm run lint` … Lint（設定は `.eslintrc.json`）
3. `npm run build` … ビルド通過

エラーが残っている状態で「完了しました」と報告しない。

---

## 実装時の注意

### AI のキーはサーバー側のみ。中身は OpenRouter のキー

`ANTHROPIC_API_KEY` という名前だが、入っているのは **OpenRouter のキー（`sk-or-`）**。
AI の呼び出しは `src/lib/ai.ts` にまとめてあり、Route Handler（`src/app/api/`）からのみ使う。
`NEXT_PUBLIC_` を付けない。クライアントコンポーネントから直接 AI を呼ばない。

### マイグレーションは番号順に手動実行

`supabase/migrations/` の SQL を、**番号順**に Supabase の SQL Editor で実行する運用。
サービスキーでは DDL を流せないので、テーブルの追加・変更は必ず人が SQL Editor で実行する。

| ファイル | 内容 |
|---|---|
| `0001`〜`0003` | 旧アプリのテーブル・RLS・ビュー（`projects` は今も使う） |
| `0004` / `0005` | 旧アプリの Google 連携・カレンダーメモ（未使用） |
| `0006_meetings.sql` | 議事録アプリの `meetings` / `meeting_segments` / `action_items` |

新しい SQL を追加するときは、既存ファイルを書き換えず**連番で追加**する。

### RLS が有効

「なぜかデータが0件で返る」ときは、まず RLS ポリシーを疑う。認証済みセッションで実行されているかを確認する。
API も未ログインだと行が取れず 404 を返す作りにしている。

### `claude/` のスクリプトは、直したら設置先へコピーする

`claude/session-log.mjs`（作業ログの自動記録）と `claude/shukudai.mjs`（宿題コマンド）は、
アプリ本体ではなくこのPCで動く。実際に使われるのはコピー先なので、直したら必ずコピーする。

```bash
cp claude/session-log.mjs ~/.claude/hooks/session-log.mjs
cp claude/shukudai.mjs ~/bin/shukudai
```

動作確認は `node claude/session-log.mjs run end <session_id> <会話ログのパス> "$PWD" --dry`（保存せず結果だけ出す）。
実行の記録は `~/.claude/hooks/session-log.log` に残る。

### 仕様変更は spec.md にも反映する

仕様に関わる変更を実装したら、**コードだけでなく spec.md も更新する**。

---

## 過去に実際に踏んだ罠

- **supabase-js に手書きの `Database` 型を渡すと結果が `never` になる**（2026-06）。
  `select` も `insert` も型が壊れる。クライアントは型引数なしで作り、結果を `as unknown as 型` でキャストする。
  `.single()` / `.maybeSingle()` の結果も同じ。
- **`select` の `defaultValue` はサーバー更新後も古い表示のまま残る**（2026-06）。
  値で `key` を付けて作り直させる（例: `<select key={value} defaultValue={value}>`）。
- **`@apply` は `/12` や `/[0.045]` のような透明度指定を解決できずビルドが落ちる**（2026-06）。
  `globals.css` のコンポーネントクラスでは、透明度つきの色は生の CSS で書く。JSX の className では使える。
- **Vercel の環境変数は、変更後に再デプロイしないと反映されない**（2026-06）。
  環境変数が無い状態でデプロイすると middleware が落ちて全ページ 500 になる。
- **Vercel のリクエスト本文は 4.5MB まで**（2026-11）。
  録音は 16kHz モノラルの WAV を 60 秒ごとに区切って送っている（1断片 約1.9MB）。区切りを長くしたり音質を上げたりすると上限を超える。
- **`npm run lint` は ESLint の設定ファイルが無いと対話プロンプトで止まる**（2026-11）。`.eslintrc.json` を消さない。
- **zsh では未クォートの変数が単語分割されない**（2026-06）。
  `for f in $files` は1要素として回る。ファイル一括処理は `find -print0 | while read -d ''` を使う。`--include=*.tsx` もクォートが必要。
- **日本語のパスは `fs.realpathSync` の結果と DB の文字列が一致しないことがある**（2026-11）。
  macOS は「ダ」「プ」などを NFD（濁点が別の文字）で返す場合があり、見た目が同じでも `===` が false になる。
  パスを比べる前に両方 `.normalize("NFC")` する。
- **`projects.repo_path` は 2026-09 のフォルダ移動前のパス（`~/my-work/...`）のまま**（2026-11）。
  ホーム直下のシンボリックリンクで今も有効。案件の照合は文字列ではなく実体のパス（realpath）で比べる。
