# ふたり手帖

2人で使う個人用アプリ（予定・欲しいもの・お金）。
仕様は [spec.md](./spec.md)、実装時の注意は [CLAUDE.md](./CLAUDE.md) を参照。

## 技術構成

- Next.js（App Router）+ TypeScript + Tailwind
- Supabase（PostgreSQL + Auth + RLS）
- Vercel ホスティング（`main` への反映で自動デプロイ）

## セットアップ

```bash
npm install
cp .env.example .env.local   # 値を記入
npm run dev
```

DB は `supabase/migrations/0008_home.sql` を Supabase の SQL Editor で実行する。
最後の `insert into members ...` が、いまある Supabase アカウントを「使う人」として登録する。

## 検証

```bash
npx tsc --noEmit
npm run lint
npm run build
```
