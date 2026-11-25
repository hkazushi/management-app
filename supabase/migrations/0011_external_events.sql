-- ============================================================
-- 0011_external_events.sql
-- ほかのカレンダー（TimeTree）から読み取った予定。見るだけで、このアプリからは編集しない。
-- このMacで動く tools/timetree-sync.mjs が、サービスキーで入れ替える。
--
-- 見える範囲：取り込んだ本人（user_id）には必ず見える。shared が true の行は、もう1人にも見える。
-- ============================================================

create table external_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- 取り込んだ人
  source text not null default 'timetree',
  calendar_name text,                 -- 例: 家族
  uid text not null,                  -- 元の予定のID（くり返しは 日付つき）
  date date not null,
  title text not null,
  start_time time,
  end_time time,
  memo text,
  shared boolean not null default false,
  synced_at timestamptz not null default now(),
  unique (user_id, source, uid)
);
create index on external_events (date);

alter table external_events enable row level security;
-- 読むだけ。書き込みは同期スクリプト（サービスキー）だけが行う
create policy "read own or shared" on external_events for select
  using (user_id = auth.uid() or (shared and is_member()));
