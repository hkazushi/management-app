-- ============================================================
-- 0006_meetings.sql
-- 議事録アプリへの作り替え（2026-11-11）
-- 打ち合わせ・文字起こし断片・宿題の3テーブル。案件は既存の projects を使う。
-- ============================================================

create table meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  project_id uuid references projects(id) on delete set null,
  title text not null default '無題の打ち合わせ',
  status text not null default 'recording',   -- recording / done
  started_at timestamptz not null default now(),
  duration_sec int,
  transcript text,
  summary text,
  decisions jsonb not null default '[]',
  next_agenda jsonb not null default '[]',
  email_draft text,
  created_at timestamptz not null default now()
);

-- 録音中に60秒ごとに届く文字起こし断片
create table meeting_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  seq int not null,
  text text not null default '',
  created_at timestamptz not null default now(),
  unique (meeting_id, seq)
);

-- 議事録から抜き出した宿題（誰が・何を・いつまでに）
create table action_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  meeting_id uuid references meetings(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  owner text not null default '未定',
  content text not null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index on meetings (user_id, started_at desc);
create index on meetings (project_id);
create index on meeting_segments (meeting_id, seq);
create index on action_items (user_id, done, due_date);
create index on action_items (meeting_id);

alter table meetings         enable row level security;
alter table meeting_segments enable row level security;
alter table action_items     enable row level security;

create policy "own rows" on meetings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on meeting_segments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on action_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
