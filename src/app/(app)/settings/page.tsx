import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { ColorPick, WhoSelect } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { DEFAULT_COLOR, onColor } from "@/lib/colors";
import { fmtTimeRange } from "@/lib/format";
import { getMembers, whoOf } from "@/lib/members";
import { addPreset, deletePreset, updateMe } from "./actions";
import type { EventPreset } from "@/types/database";

// 設定：自分の名前と色、よく使う予定
export default async function SettingsPage() {
  const supabase = await createClient();
  const [
    members,
    pRes,
    {
      data: { user },
    },
  ] = await Promise.all([
    getMembers(supabase),
    supabase.from("event_presets").select("id,title,start_time,end_time,member_id,color,sort").order("sort", { ascending: true }),
    supabase.auth.getUser(),
  ]);
  const presets = (pRes.data as unknown as EventPreset[] | null) ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const other = members.find((m) => m.user_id !== user?.id);

  return (
    <section className="stagger space-y-6">
      <PageTitle title="設定" label="SETTINGS" tone="bg-ink text-[#FAF4E4]" />

      <div className="space-y-3">
        <SectionTitle tone="bg-primary">じぶん</SectionTitle>
        {me ? (
          <ActionForm action={updateMe} keep cheer="保存しました" className="card space-y-3 p-4">
            <label className="block text-[11px] font-bold text-muted">
              名前（予定や支払いに出ます）
              <input name="name" required maxLength={12} defaultValue={me.name} className="input mt-0.5" />
            </label>
            <div>
              <p className="mb-1.5 text-[11px] font-bold text-muted">じぶんの色</p>
              <ColorPick defaultValue={me.color} />
            </div>
            <button type="submit" className="btn-primary w-full">
              保存
            </button>
          </ActionForm>
        ) : (
          <p className="card p-4 text-sm font-bold text-muted">このアカウントはまだ登録されていません。</p>
        )}
        {other && (
          <p className="flex items-center gap-2 text-xs font-bold text-muted">
            もうひとり：
            <span className="chip" style={{ background: other.color, color: onColor(other.color) }}>
              {other.name}
            </span>
            （名前と色は、本人のあいことばで入ったときに変えられます）
          </p>
        )}
      </div>

      <div id="presets" className="scroll-mt-20 space-y-3">
        <SectionTitle tone="bg-accent">よく使う予定</SectionTitle>
        <p className="text-xs font-bold text-muted">ここに登録した予定は、カレンダーでワンタップで入れられます。</p>
        {presets.length > 0 && (
          <ul className="space-y-2">
            {presets.map((p) => {
              const color = p.color ?? (p.member_id ? whoOf(members, p.member_id).color : DEFAULT_COLOR);
              return (
                <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 py-2">
                  <span className="h-5 w-5 shrink-0 rounded-full border border-line" style={{ background: color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{p.title}</p>
                    <p className="text-xs font-bold text-muted">
                      {[fmtTimeRange(p.start_time, p.end_time) || "時間なし", whoOf(members, p.member_id).name].join("・")}
                    </p>
                  </div>
                  <ActionForm action={deletePreset.bind(null, p.id)} confirmText={`「${p.title}」を消しますか？（入れ済みの予定は消えません）`}>
                    <button type="submit" aria-label="消す" className="p-1.5 text-muted hover:text-danger">
                      <Icon name="trash" size={16} />
                    </button>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        )}
        <ActionForm action={addPreset} cheer="よく使う予定に入れました" className="card space-y-3 p-4">
          <input name="title" required placeholder="予定の名前（仕事・デート・ジムなど）" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-bold text-muted">
              はじまり
              <input name="start_time" type="time" className="input mt-0.5" />
            </label>
            <label className="text-[11px] font-bold text-muted">
              おわり
              <input name="end_time" type="time" className="input mt-0.5" />
            </label>
          </div>
          <WhoSelect members={members} />
          <ColorPick />
          <button type="submit" className="btn-primary w-full">
            <Icon name="plus" size={16} />
            よく使う予定に追加
          </button>
        </ActionForm>
      </div>
    </section>
  );
}
