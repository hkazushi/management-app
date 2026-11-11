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
議事録アプリに必要なのは `0001`（projects テーブル）、`0002`（RLS）、`0006`（meetings ほか）。

## 検証

```bash
npx tsc --noEmit
npm run lint
npm run build
```
