"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PHASES } from "@/lib/constants";
import type {
  PhaseStatus,
  TaskStatus,
  TaskPriority,
  ResourceType,
} from "@/types/database";

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

// 情報集約（spec §3.5）。パスワード本体は保存しない＝フォームにパスワード欄を作らない。
export async function createResource(projectId: string, formData: FormData) {
  const type = String(formData.get("type") ?? "link") as ResourceType;
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const url = String(formData.get("url") ?? "").trim() || null;
  const account = String(formData.get("account") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const supabase = await createClient();
  await supabase
    .from("project_resources")
    .insert({ project_id: projectId, type, label, url, account, note });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteResource(projectId: string, resourceId: string) {
  const supabase = await createClient();
  await supabase.from("project_resources").delete().eq("id", resourceId);
  revalidatePath(`/projects/${projectId}`);
}

// AIサマリー（spec §3.4）。サーバー側でのみ ANTHROPIC_API_KEY を使用。
// 材料: その案件の activity_log・タスク・フェーズ。結果は projects.summary にキャッシュ。
export type SummaryState = { error: string };

export async function generateSummary(
  projectId: string,
  _prev: SummaryState,
  _formData: FormData,
): Promise<SummaryState> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "ANTHROPIC_API_KEY が未設定です（Vercel と .env.local に設定してください）。",
    };
  }

  const supabase = await createClient();
  const { data: proj } = await supabase
    .from("projects")
    .select("name,client,status,note,due_date")
    .eq("id", projectId)
    .single();
  if (!proj) return { error: "案件が見つかりません。" };
  const p = proj as Record<string, unknown>;

  const { data: phasesRaw } = await supabase
    .from("phases")
    .select("name,status,position")
    .eq("project_id", projectId)
    .order("position");
  const phases =
    (phasesRaw as { name: string; status: string }[] | null) ?? [];

  const { data: tasksRaw } = await supabase
    .from("tasks")
    .select("title,status,priority,due_date")
    .eq("project_id", projectId);
  const tasks =
    (tasksRaw as {
      title: string;
      status: string;
      priority: string;
      due_date: string | null;
    }[] | null) ?? [];

  const { data: actsRaw } = await supabase
    .from("activity_log")
    .select("action,detail,created_at,source")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  const acts =
    (actsRaw as {
      action: string;
      detail: string | null;
      created_at: string;
    }[] | null) ?? [];

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const userContent = [
    `案件名: ${p.name}`,
    p.client ? `クライアント: ${p.client}` : "",
    `ステータス: ${p.status}`,
    p.due_date ? `期限: ${p.due_date}` : "",
    p.note ? `メモ: ${p.note}` : "",
    "",
    `フェーズ(${phases.length}): ${phases.map((ph) => `${ph.name}[${ph.status}]`).join(" / ")}`,
    `タスク: 全${tasks.length}件・完了${doneCount}件`,
    ...tasks
      .slice(0, 40)
      .map(
        (t) =>
          `  - [${t.status}] ${t.title}${t.due_date ? `（〆${t.due_date}）` : ""}`,
      ),
    "",
    `最近の活動(${acts.length}):`,
    ...acts.map(
      (a) =>
        `  - ${a.created_at.slice(0, 10)} ${a.action}${a.detail ? `: ${a.detail}` : ""}`,
    ),
  ]
    .filter((l) => l !== "")
    .join("\n");

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        system:
          "あなたは案件管理アシスタントです。与えられた事実だけを根拠に、案件の『現状・進捗・次にやるべきこと』を日本語で簡潔に（3〜6文）まとめてください。完了や成否を勝手に断定せず、事実ベースで書くこと。",
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch {
    return { error: "Anthropic API への接続に失敗しました。" };
  }

  if (!res.ok) {
    return { error: `生成に失敗しました（HTTP ${res.status}）。` };
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = (data.content?.[0]?.text ?? "").trim();
  if (!text) return { error: "空の応答が返りました。" };

  await supabase
    .from("projects")
    .update({ summary: text, summary_updated_at: new Date().toISOString() })
    .eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  return { error: "" };
}
