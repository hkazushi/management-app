-- ============================================================
-- 0003_phase_progress_view.sql
-- フェーズ進捗率ビュー（spec §5.3）
-- 完了率 = そのフェーズの done タスク数 ÷ 全タスク数（spec §3.2）
--
-- ★ spec の例から1点だけ追加: `with (security_invoker = true)`
--   これが無いとビューは作成者(postgres)権限で実行され RLS を素通りし、
--   他ユーザー分のタスクまで集計に混ざる恐れがある。
--   spec §4「全データは user_id で分離」を守るため、ビューも
--   問い合わせユーザーの RLS を適用する設定にしている。
--   （不要であれば with (...) 行を削除してください）
-- ============================================================

create view phase_progress
with (security_invoker = true)
as
select
  p.id as phase_id,
  p.project_id,
  count(t.id) filter (where t.status = 'done') as done_count,
  count(t.id) as total_count,
  case when count(t.id) = 0 then 0
       else round(100.0 * count(t.id) filter (where t.status = 'done') / count(t.id))
  end as progress_pct
from phases p
left join tasks t on t.phase_id = p.id
group by p.id, p.project_id;
