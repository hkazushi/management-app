-- ============================================================
-- 0009_one_offs.sql
-- 単発のお金（その月だけの出費・収入）。車検、旅行、ボーナスなど。
-- ほかのお金のテーブルと同じく、入れた本人にしか見えない。
-- ============================================================

create table one_offs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,  -- 持ち主
  kind text not null default 'expense' check (kind in ('expense', 'income')),            -- 出費 / 収入
  name text not null,
  amount int not null,
  date date not null,              -- 出費なら支払う期限、収入なら入る日。この日付の月に数える
  paid_at timestamptz,             -- 出費を払った日時（収入では使わない）
  memo text,
  created_at timestamptz not null default now()
);
create index on one_offs (user_id, date);

alter table one_offs enable row level security;
create policy "own rows" on one_offs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- カレンダーの外部公開（iCal 形式）。
-- iPhone のカレンダーや TimeTree（外部カレンダーの表示）から、このアプリの予定を読めるようにする。
-- カレンダーアプリはログインできないので、長い合言葉（token）を知っていれば読める、という形にする。
-- token は設定画面で作り、いつでも作り直し・停止ができる。
-- ============================================================

create table calendar_feeds (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,  -- 1人1つ
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

alter table calendar_feeds enable row level security;
create policy "own rows" on calendar_feeds
  for all using (user_id = auth.uid() and is_member()) with check (user_id = auth.uid() and is_member());

-- token が正しければ、共有の予定（60日前から先）を返す。ログインしていなくても呼べる。
-- お金のデータは返さない。
create function calendar_feed(feed_token text)
  returns table (id uuid, date date, title text, start_time time, end_time time, memo text, member_name text, created_at timestamptz)
  language sql stable security definer set search_path = public
  as $$
    select e.id, e.date, e.title, e.start_time, e.end_time, e.memo, m.name, e.created_at
    from events e
    left join members m on m.user_id = e.member_id
    where exists (select 1 from calendar_feeds f where f.token = feed_token)
      and e.date >= (now() at time zone 'Asia/Tokyo')::date - 60
    order by e.date, e.start_time nulls first
  $$;

revoke all on function calendar_feed(text) from public;
grant execute on function calendar_feed(text) to anon, authenticated;
