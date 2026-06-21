# 案件・タスク管理アプリ

複数のクライアント案件を、フェーズで可視化しながら一元管理する個人用（1ユーザー）アプリ。
Claude Code での開発作業が自動で記録・反映されるのが特徴。仕様は [spec.md](./spec.md) を参照。

## 技術構成

- **Next.js（App Router）+ TypeScript**
- **Supabase**（PostgreSQL + Auth + RLS）
- **Tailwind CSS**（warm / vibrant トーン）
- **Vercel** ホスティング
- AIサマリーは Route Handler 経由で **Anthropic API**（サーバー側のみ）

## セットアップ

### 1. 依存をインストール

```bash
npm install
```

### 2. 環境変数

```bash
cp .env.example .env.local
```

`.env.local` に Supabase プロジェクトの値を記入:

- `NEXT_PUBLIC_SUPABASE_URL` … Supabase > Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` … 同 > anon public key
- `ANTHROPIC_API_KEY` … ステップ7（AIサマリー）で使用。今は空でも可

### 3. DB マイグレーション

`supabase/migrations/` の SQL を **番号順**に Supabase の SQL Editor で実行する。

| ファイル | 内容 |
|---|---|
| `0001_init_tables.sql` | テーブル定義（spec §5.1） |
| `0002_rls_policies.sql` | RLS 有効化＋ポリシー（spec §5.2） |
| `0003_phase_progress_view.sql` | フェーズ進捗ビュー（spec §5.3） |

> Supabase CLI を使う場合は `supabase db push` でも適用可能（CLI 連携はステップ2以降で整備）。

### 4. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 を開いて「Step 1 — Scaffold OK」が表示されれば成功。

## ディレクトリ構成

```
src/
  app/                 画面（ステップ2以降でルーティング追加）
  lib/supabase/        Supabase クライアント（client = ブラウザ / server = サーバー）
  types/database.ts    DB 型定義
supabase/migrations/   SQL マイグレーション
```

## 開発の進め方

spec.md のステップ順（認証 → 案件 → フェーズ/タスク → リソース → 横断機能 → AIサマリー → フック連携）で実装する。
設計の軸は「**記録は自動・判断は手動**」（spec §2）。タスクの done を自動でつけることは絶対にしない。
