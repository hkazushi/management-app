-- ============================================================
-- 0013_timetree_links.sql
-- ふたり手帖の予定を TimeTree に書き込んだときの対応表。
-- どの予定が TimeTree のどの予定になったかを覚えておき、変更・削除を追いかけるのに使う。
-- 予定を消したあとも、TimeTree 側を消し終えるまで行を残す（だから events への外部キーは付けない）。
-- 読み書きするのは、このMacの tools/timetree-sync.mjs（サービスキー）だけ。画面からは見えない。
-- ============================================================

create table timetree_links (
  event_id uuid primary key,            -- ふたり手帖の events.id
  timetree_calendar_id text not null,   -- 書き込んだ TimeTree のカレンダー
  timetree_event_id text not null,      -- TimeTree 側の予定の ID
  hash text not null,                   -- 書き込んだ内容の要約（変更があったかの判定用）
  synced_at timestamptz not null default now()
);

alter table timetree_links enable row level security;  -- ポリシー無し＝サービスキーだけが使える
