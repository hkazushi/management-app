-- ============================================================
-- 0014_external_delete.sql
-- TimeTree から読み取った予定を、ふたり手帖から「消して」と頼めるようにする。
-- 画面は delete_requested_at に時刻を入れるだけ。実際に TimeTree から消すのは、このMacの同期スクリプト。
-- くり返しの予定は、1回分だけを消せない（全部消えてしまう）ので、recurring で見分けて画面では消せなくする。
-- ============================================================

alter table external_events
  add column delete_requested_at timestamptz,          -- 消してほしいと頼まれた時刻
  add column recurring boolean not null default false; -- くり返しの予定か

-- 見えている予定に対して、消す依頼を出せる（行の更新を許す）
create policy "request delete" on external_events for update
  using (user_id = auth.uid() or (shared and is_member()))
  with check (user_id = auth.uid() or (shared and is_member()));
