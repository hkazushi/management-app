-- ============================================================
-- 0005_calendar_notes.sql
-- カレンダー画面で日付ごとに紐付ける自由メモ（タスクとは別）。
-- 1ユーザー × 同じ日付に複数メモOK。RLSで本人のみ。
-- ============================================================

create table calendar_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  date date not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on calendar_notes (user_id, date);

alter table calendar_notes enable row level security;

create policy "own rows" on calendar_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
