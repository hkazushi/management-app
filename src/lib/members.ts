import type { SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/types/database";

// 使う人（2人）を並び順で返す
export async function getMembers(supabase: SupabaseClient): Promise<Member[]> {
  const { data } = await supabase.from("members").select("user_id,name,color,sort").order("sort", { ascending: true });
  return (data as unknown as Member[] | null) ?? [];
}

// 「誰の」の表示名と色。null は「2人」
export function whoOf(members: Member[], memberId: string | null): { name: string; color: string } {
  const m = members.find((x) => x.user_id === memberId);
  return m ? { name: m.name, color: m.color } : { name: "ふたり", color: "#C9A862" };
}
