import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/types/database";

// 使う人（2人）を並び順で返す
export async function getMembers(supabase: SupabaseClient): Promise<Member[]> {
  const { data } = await supabase.from("members").select("user_id,name,color,sort").order("sort", { ascending: true });
  return (data as unknown as Member[] | null) ?? [];
}

// ほかのカレンダー（TimeTree）の予定の色。
// 入れた人の名前がふたり手帖の名前と同じならその人の色、違えば TimeTree 上の色、どちらも無ければ灰色。
export function externalColor(members: Member[], e: { author_name?: string | null; label_color?: string | null }): string {
  const m = e.author_name ? members.find((x) => x.name === e.author_name) : undefined;
  if (m) return m.color;
  return e.label_color && /^#[0-9a-fA-F]{6}$/.test(e.label_color) ? e.label_color : "#A39F90";
}

// 「誰の」の表示名と色。null は「2人」
export function whoOf(members: Member[], memberId: string | null): { name: string; color: string } {
  const m = members.find((x) => x.user_id === memberId);
  return m ? { name: m.name, color: m.color } : { name: "ふたり", color: "#C9A862" };
}
