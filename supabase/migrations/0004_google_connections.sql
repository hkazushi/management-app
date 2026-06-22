-- ============================================================
-- 0004_google_connections.sql
-- Googleカレンダー連携のOAuthトークン保管（アプリのアカウントごとに1接続）
-- トークンはサーバー側でのみ使用。RLSで本人のみ。
-- ============================================================

create table google_connections (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  google_email text,
  access_token text,
  refresh_token text,
  expiry timestamptz,
  scope text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table google_connections enable row level security;

create policy "own rows" on google_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
