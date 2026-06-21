"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES } from "@/lib/constants";
import type { ProjectStatus } from "@/types/database";

// カテゴリが1つも無ければ既定3つを生成（冪等）。新規フォーム/一覧で必要時に呼ぶ。
export async function ensureDefaultCategories() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("categories")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    await supabase.from("categories").insert(DEFAULT_CATEGORIES);
  }
}

function parseProjectForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    client: String(formData.get("client") ?? "").trim() || null,
    category_id: String(formData.get("category_id") ?? "") || null,
    status: (String(formData.get("status") ?? "active") as ProjectStatus),
    due_date: String(formData.get("due_date") ?? "") || null,
    note: String(formData.get("note") ?? "").trim() || null,
  };
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const data = parseProjectForm(formData);
  if (!data.name) throw new Error("案件名は必須です");

  const { data: row, error } = await supabase
    .from("projects")
    .insert(data)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  redirect(`/projects/${row!.id}`);
}

export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient();
  const data = parseProjectForm(formData);
  if (!data.name) throw new Error("案件名は必須です");

  const { error } = await supabase.from("projects").update(data).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

export async function deleteProject(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  redirect("/projects");
}

export async function createCategory(formData: FormData) {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#FF8C42");
  if (!name) return;

  const { error } = await supabase.from("categories").insert({ name, color });
  if (error) throw new Error(error.message);

  revalidatePath("/projects");
  revalidatePath("/projects/new");
}
