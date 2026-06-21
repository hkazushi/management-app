"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PHASES } from "@/lib/constants";
import type { PhaseStatus, TaskStatus, TaskPriority } from "@/types/database";

// 案件にフェーズが1つも無ければデフォルト7工程を生成（冪等・spec §3.2）
export async function ensureDefaultPhases(projectId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("phases")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  if ((count ?? 0) === 0) {
    const rows = DEFAULT_PHASES.map((name, i) => ({
      project_id: projectId,
      name,
      position: i,
    }));
    await supabase.from("phases").insert(rows);
  }
}

export async function setPhaseStatus(
  projectId: string,
  phaseId: string,
  formData: FormData,
) {
  const status = String(formData.get("status") ?? "not_started") as PhaseStatus;
  const supabase = await createClient();
  await supabase.from("phases").update({ status }).eq("id", phaseId);
  revalidatePath(`/projects/${projectId}`);
}

export async function createTask(
  projectId: string,
  phaseId: string,
  formData: FormData,
) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const priority = String(formData.get("priority") ?? "mid") as TaskPriority;
  const due_date = String(formData.get("due_date") ?? "") || null;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextOrder = ((last?.[0]?.sort_order as number | undefined) ?? -1) + 1;

  await supabase.from("tasks").insert({
    project_id: projectId,
    phase_id: phaseId,
    title,
    priority,
    due_date,
    sort_order: nextOrder,
  });
  revalidatePath(`/projects/${projectId}`);
}

// 完了は手動トグルのみ（AIが自動でdoneにすることはしない・spec §2/§3.3）
export async function toggleTaskDone(
  projectId: string,
  taskId: string,
  done: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status: done ? "done" : "todo",
      done_at: done ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setTaskStatus(
  projectId: string,
  taskId: string,
  formData: FormData,
) {
  const status = String(formData.get("status") ?? "todo") as TaskStatus;
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({
      status,
      done_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);
  revalidatePath(`/projects/${projectId}`);
}

export async function setTaskPriority(
  projectId: string,
  taskId: string,
  formData: FormData,
) {
  const priority = String(formData.get("priority") ?? "mid") as TaskPriority;
  const supabase = await createClient();
  await supabase.from("tasks").update({ priority }).eq("id", taskId);
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteTask(projectId: string, taskId: string) {
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", taskId);
  revalidatePath(`/projects/${projectId}`);
}

// 並べ替え：同フェーズ内で隣のタスクと sort_order を入れ替える（spec §3.3）
export async function moveTask(
  projectId: string,
  taskId: string,
  phaseId: string,
  direction: "up" | "down",
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id,sort_order")
    .eq("phase_id", phaseId)
    .order("sort_order", { ascending: true });
  const list = (data as { id: string; sort_order: number }[] | null) ?? [];
  const idx = list.findIndex((t) => t.id === taskId);
  if (idx < 0) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  await supabase.from("tasks").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("tasks").update({ sort_order: a.sort_order }).eq("id", b.id);
  revalidatePath(`/projects/${projectId}`);
}
