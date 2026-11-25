import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/ActionForm";
import { ColorPick, WhoSelect } from "@/components/Fields";
import { Icon } from "@/components/Icon";
import { PageTitle, SectionTitle } from "@/components/PageTitle";
import { DEFAULT_COLOR, onColor } from "@/lib/colors";
import { fmtTimeRange } from "@/lib/format";
import { getMembers, whoOf } from "@/lib/members";
import { headers } from "next/headers";
import { CopyField } from "@/components/CopyField";
import { addPreset, createFeed, deleteFeed, deletePreset, updateMe } from "./actions";
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
    fRes,
    hdrs,
  ] = await Promise.all([
    getMembers(supabase),
    supabase.from("event_presets").select("id,title,start_time,end_time,member_id,color,sort").order("sort", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("calendar_feeds").select("token").maybeSingle(),
    headers(),
  ]);
  const presets = (pRes.data as unknown as EventPreset[] | null) ?? [];
  const me = members.find((m) => m.user_id === user?.id);
  const other = members.find((m) => m.user_id !== user?.id);
  // 外に出す URL（自分の分。RLS で自分の行しか返らない）
  const token = (fRes.data as unknown as { token: string } | null)?.token ?? null;
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "";
  const feedPath = token ? `${host}/api/ical/${token}.ics` : "";

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

      <div id="feed" className="scroll-mt-20 space-y-3">
        <SectionTitle>ほかのカレンダーに出す</SectionTitle>
        <p className="text-xs leading-relaxed text-muted">
          このアプリの予定を、iPhone のカレンダーや TimeTree でも見られるようにします（見るだけ。お金は出ません）。
          URL を知っている人は予定を読めるので、人に教えないでください。
        </p>
        {fRes.error ? (
          <p className="rounded-2xl border border-dashed border-line px-3 py-3 text-sm text-muted">
            使うには、Supabase の SQL Editor で supabase/migrations/0010_calendar_feed.sql を実行してください。
          </p>
        ) : token ? (
          <div className="card space-y-3 p-4">
            <a href={`webcal://${feedPath}`} className="btn-primary w-full">
              <Icon name="calendar" size={16} />
              iPhone のカレンダーに追加
            </a>
            <CopyField value={`https://${feedPath}`} label="カレンダーのURL" />
            <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
              <li>上のボタンを iPhone で押し、「照会」を選ぶ（iPhone のカレンダーに「ふたり手帖」が増えます）</li>
              <li>TimeTree を開き、設定の「外部カレンダーの表示」をオンにして「ふたり手帖」を選ぶ</li>
              <li>Google カレンダーなら、「URL で追加」に上の URL を貼る</li>
            </ol>
            <p className="text-xs leading-relaxed text-muted">
              反映には数時間かかることがあります。TimeTree では自分の端末にだけ表示され、TimeTree の共有相手には出ません。
            </p>
            <div className="flex items-center justify-center gap-5 text-xs font-bold">
              <ActionForm action={createFeed} confirmText="URL を作り直しますか？ 前の URL は使えなくなり、登録し直しが必要です。">
                <button type="submit" className="text-muted">
                  URL を作り直す
                </button>
              </ActionForm>
              <ActionForm action={deleteFeed} confirmText="外に出すのをやめますか？ URL が使えなくなります。">
                <button type="submit" className="text-danger">
                  出すのをやめる
                </button>
              </ActionForm>
            </div>
          </div>
        ) : (
          <ActionForm action={createFeed} cheer="URL を作りました">
            <button type="submit" className="btn-ghost w-full">
              <Icon name="link" size={16} />
              外に出すための URL を作る
            </button>
          </ActionForm>
        )}
      </div>
    </section>
  );
}
