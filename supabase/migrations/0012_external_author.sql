-- ============================================================
-- 0012_external_author.sql
-- TimeTree から読み取った予定に、「誰が入れたか」と TimeTree 上の色を持たせる。
-- 画面では、入れた人の名前がふたり手帖の名前（ず・お）と同じなら、その人の色で塗る。
-- ============================================================

alter table external_events
  add column author_name text,   -- TimeTree でその予定を作った人の名前
  add column label_color text;   -- TimeTree 上のラベルの色（#rrggbb）
