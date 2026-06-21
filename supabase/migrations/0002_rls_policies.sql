-- ============================================================
-- 0002_rls_policies.sql
-- RLS ポリシー（spec §5.2）
-- 全テーブルで RLS を有効化し、本人（auth.uid() = user_id）のみ
-- 参照・追加・更新・削除できるようにする。
-- ============================================================

alter table categories       enable row level security;
alter table projects         enable row level security;
alter table phases           enable row level security;
alter table tasks            enable row level security;
alter table project_resources enable row level security;
alter table activity_log     enable row level security;

create policy "own rows" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on phases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on project_resources
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on activity_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
