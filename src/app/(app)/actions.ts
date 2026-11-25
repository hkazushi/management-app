"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  // scope を local にしないと、同じ人のほかの端末までログアウトされる
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
