-- ============================================================
-- 0015_wish_image_push.sql
-- 1) 欲しいものの写真（リンク先の商品画像の URL）
-- 2) 毎朝の通知の届け先（端末ごと。本人の行だけ）
-- ============================================================

alter table wishes add column image_url text;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique,   -- 端末ごとの届け先
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy "own rows" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
