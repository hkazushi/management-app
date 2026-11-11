import { createClient } from "@/lib/supabase/server";
import { Recorder } from "@/components/Recorder";

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id,name")
    .neq("status", "アーカイブ")
    .order("name");
  const projects = (data as unknown as { id: string; name: string }[] | null) ?? [];
  const defaultProjectId = projects.some((p) => p.id === project) ? (project as string) : "";

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight text-ink">録音</h1>
      <Recorder projects={projects} defaultProjectId={defaultProjectId} />
    </section>
  );
}
