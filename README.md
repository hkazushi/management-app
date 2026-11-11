# 議事録アプリ

打ち合わせを録音すると、文字起こし・要約・決定事項・宿題の抽出まで行う個人用アプリ。
仕様は [spec.md](./spec.md)、実装時の注意は [CLAUDE.md](./CLAUDE.md) を参照。

## 技術構成

- Next.js（App Router）+ TypeScript + Tailwind
- Supabase（PostgreSQL + Auth + RLS）
- Vercel ホスティング（`main` への反映で自動デプロイ）
- AI は OpenRouter 経由（文字起こし: Gemini、議事録の整理: Claude）

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を記入
npm run dev
```

DB は `supabase/migrations/` の SQL を番号順に Supabase の SQL Editor で実行する。
議事録アプリに必要なのは `0001`（projects テーブル）、`0002`（RLS）、`0006`（meetings ほか）、`0007`（ログパス）。

## Claude Code との連携（任意）

```bash
cp claude/session-log.mjs ~/.claude/hooks/session-log.mjs
cp claude/shukudai.mjs ~/bin/shukudai && chmod +x ~/bin/shukudai
cp claude/logpass.mjs ~/bin/logpass && chmod +x ~/bin/logpass
```

`~/.claude/hooks/management-app.env` に `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` / `MANAGEMENT_USER_ID` /
`OPENROUTER_API_KEY` を書き、`~/.claude/settings.json` の Stop と SessionEnd フックに
`node ~/.claude/hooks/session-log.mjs hook` を登録する。詳しくは spec.md の 7 章。

## 検証

```bash
npx tsc --noEmit
npm run lint
npm run build
```
