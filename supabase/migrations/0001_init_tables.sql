-- ============================================================
-- 0001_init_tables.sql
-- テーブル定義（spec §5.1）
-- 全テーブル user_id を持ち、RLS は 0002 で有効化する。
-- ============================================================

-- カテゴリ（色分け・絞り込み用）
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  color text not null default '#FF8C42',
  created_at timestamptz default now()
);

-- 案件
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  client text,
  category_id uuid references categories(id) on delete set null,
  status text not null default 'active',   -- draft / active / on_hold / done / archived
  repo_path text,                          -- Claude Code の cwd と名寄せするキー
  due_date date,
  note text,
  summary text,                            -- AI生成サマリーのキャッシュ
  summary_updated_at timestamptz,
  created_at timestamptz default now()
);

-- フェーズ
create table phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position int not null default 0,         -- 工程の並び順
  status text not null default 'not_started', -- not_started / in_progress / done
  created_at timestamptz default now()
);

-- タスク
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,  -- フェーズに紐付け
  title text not null,
  status text not null default 'todo',     -- todo / doing / done
  priority text not null default 'mid',    -- low / mid / high
  due_date date,
  sort_order int not null default 0,
  done_at timestamptz,
  created_at timestamptz default now()
);

-- 案件リソース（リンク・アカウント・ツール）
create table project_resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null default 'link',       -- link / account / tool
  label text not null,
  url text,
  account text,                            -- 使用アカウント（例: client-xxx@gmail.com）
  note text,                               -- メモ（パスワードマネージャーの所在など。実体は保存しない）
  created_at timestamptz default now()
);

-- 活動ログ（Claude Code 自動 + 手動）
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid references projects(id) on delete cascade,
  action text not null,                    -- 例: 'commit', 'session', 'note'
  detail text,
  source text not null default 'manual',   -- claude_code / manual
  session_id text,                         -- Claude Code セッションID（任意）
  created_at timestamptz default now()
);

-- インデックス
create index on projects (user_id, status);
create index on projects (repo_path);
create index on phases (project_id, position);
create index on tasks (project_id);
create index on tasks (phase_id);
create index on tasks (user_id, status, due_date);
create index on project_resources (project_id);
create index on activity_log (project_id, created_at desc);
