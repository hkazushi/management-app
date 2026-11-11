"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// 録音開始時に打ち合わせの行を作る
export async function startMeeting(
  projectId: string | null,
  title: string,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient();
  const row: Record<string, unknown> = { project_id: projectId || null };
  if (title.trim()) row.title = title.trim();
  const { data, error } = await supabase.from("meetings").insert(row).select("id").single();
  if (error) return { error: error.message };
  return { id: (data as unknown as { id: string }).id };
}

export async function updateMeeting(id: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "") || null;
  const supabase = await createClient();
  const patch: Record<string, unknown> = { project_id: projectId };
  if (title) patch.title = title;
  await supabase.from("meetings").update(patch).eq("id", id);
  // 宿題も同じ案件に付け替える
  await supabase.from("action_items").update({ project_id: projectId }).eq("meeting_id", id);
  revalidatePath("/", "layout");
}

export async function deleteMeeting(id: string) {
  const supabase = await createClient();
  await supabase.from("meetings").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect("/meetings");
}

export async function toggleAction(id: string, done: boolean) {
  const supabase = await createClient();
  await supabase
    .from("action_items")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteAction(id: string) {
  const supabase = await createClient();
  await supabase.from("action_items").delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function addAction(
  meetingId: string | null,
  projectId: string | null,
  formData: FormData,
) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;
  const supabase = await createClient();
  await supabase.from("action_items").insert({
    meeting_id: meetingId,
    project_id: projectId,
    content,
    owner: String(formData.get("owner") ?? "").trim() || "自分",
    due_date: String(formData.get("due_date") ?? "") || null,
  });
  revalidatePath("/", "layout");
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("projects").insert({
    name,
    client: String(formData.get("client") ?? "").trim() || null,
    status: "運用中",
  });
  revalidatePath("/", "layout");
}
