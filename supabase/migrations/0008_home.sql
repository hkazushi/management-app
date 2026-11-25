-- ============================================================
-- 0008_home.sql
-- 2人で使うアプリ（カレンダー・欲しいもの・お金）のテーブル。
--
-- これまでのテーブルは「自分の行だけ見える」だったが、ここからは「2人とも同じ行が見える」。
-- 誰でも見えるわけではなく、members に登録された人だけが読み書きできる。
-- （members への登録は SQL Editor かサービスキーでのみ行う。画面からは増やせない）
-- ============================================================

-- 使う人（PIN ごとの Supabase アカウントに名前と色を付ける）
create table members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#14463A',
  sort int not null default 0
);

-- ログイン中の人が members に入っているか。RLS の条件に使う
create function is_member() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from members where user_id = auth.uid()) $$;

alter table members enable row level security;
create policy "members read" on members for select using (is_member());
create policy "members rename self" on members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 予定。複数の日にまとめて入れたものは batch_id が同じ
create table events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  title text not null,
  start_time time,
  end_time time,
  member_id uuid references members(user_id) on delete set null,  -- null は「2人」
  color text,
  memo text,
  batch_id uuid,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on events (date);

-- よく使う予定（ワンタップで追加するための型）
create table event_presets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_time time,
  end_time time,
  member_id uuid references members(user_id) on delete set null,
  color text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- 欲しいもの
create table wishes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text,
  price int,
  memo text,
  member_id uuid references members(user_id) on delete set null,  -- 誰が欲しいか。null は「2人」
  done boolean not null default false,                             -- 買った
  done_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- 毎月の固定費
create table fixed_costs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount int not null,
  due_day int not null check (due_day between 1 and 31),          -- 支払日。31 は「月末」として扱う
  member_id uuid references members(user_id) on delete set null,  -- 誰が払うか。null は「2人」
  memo text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 固定費を払った記録（固定費 × 月で1件）
create table fixed_payments (
  id uuid primary key default gen_random_uuid(),
  fixed_cost_id uuid not null references fixed_costs(id) on delete cascade,
  month text not null,                                             -- 'YYYY-MM'
  amount int not null,
  paid_at timestamptz not null default now(),
  unique (fixed_cost_id, month)
);

-- 毎月の収入
create table incomes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount int not null,
  member_id uuid references members(user_id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- その月だけ金額が違うときの上書き（収入 × 月で1件）
create table income_actuals (
  id uuid primary key default gen_random_uuid(),
  income_id uuid not null references incomes(id) on delete cascade,
  month text not null,
  amount int not null,
  unique (income_id, month)
);

-- 貯金の目標
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target int,                                                      -- 目標額（無くてもよい）
  monthly int not null default 0,                                  -- 毎月ためる予定の額
  member_id uuid references members(user_id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 貯金の出し入れ（引き出しはマイナス）
create table savings_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references savings_goals(id) on delete cascade,
  amount int not null,
  date date not null default (now() at time zone 'Asia/Tokyo')::date,
  memo text,
  created_at timestamptz not null default now()
);
create index on savings_entries (goal_id);

alter table events          enable row level security;
alter table event_presets   enable row level security;
alter table wishes          enable row level security;
alter table fixed_costs     enable row level security;
alter table fixed_payments  enable row level security;
alter table incomes         enable row level security;
alter table income_actuals  enable row level security;
alter table savings_goals   enable row level security;
alter table savings_entries enable row level security;

create policy "members all" on events          for all using (is_member()) with check (is_member());
create policy "members all" on event_presets   for all using (is_member()) with check (is_member());
create policy "members all" on wishes          for all using (is_member()) with check (is_member());
create policy "members all" on fixed_costs     for all using (is_member()) with check (is_member());
create policy "members all" on fixed_payments  for all using (is_member()) with check (is_member());
create policy "members all" on incomes         for all using (is_member()) with check (is_member());
create policy "members all" on income_actuals  for all using (is_member()) with check (is_member());
create policy "members all" on savings_goals   for all using (is_member()) with check (is_member());
create policy "members all" on savings_entries for all using (is_member()) with check (is_member());

-- いまある2つのアカウントを登録する。先に作ったほう（APP_PIN）が「ず」、あとのほう（APP_PIN_2）が「お」。
-- 名前と色は、あとで設定画面から本人が変えられる
insert into members (user_id, name, color, sort)
select id, case row_number() over (order by created_at) when 1 then 'ず' else 'お' end,
       case row_number() over (order by created_at) when 1 then '#14463A' else '#9B2C3A' end,
       row_number() over (order by created_at)
from auth.users;
