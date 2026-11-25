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
