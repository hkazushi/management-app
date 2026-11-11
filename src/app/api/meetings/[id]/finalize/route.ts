import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { writeMinutes } from "@/lib/ai";
import { todayJST } from "@/lib/format";

export const maxDuration = 120;

const DEFAULT_TITLE = "無題の打ち合わせ";

// 文字起こし断片をつなぎ、議事録（要約・決定事項・宿題・次回の議題・メール下書き）を作って保存する。
// 作り直しにも使う（その場合、この打ち合わせの宿題は作り直される）。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { durationSec?: number };

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id,title,project_id,duration_sec")
    .eq("id", id)
    .maybeSingle();
  const m = meeting as unknown as {
    id: string;
    title: string;
    project_id: string | null;
    duration_sec: number | null;
  } | null;
  if (!m) return NextResponse.json({ error: "打ち合わせが見つかりません" }, { status: 404 });

  const { data: segs } = await supabase
    .from("meeting_segments")
    .select("seq,text")
    .eq("meeting_id", id)
    .order("seq");
  const transcript = ((segs as unknown as { seq: number; text: string }[] | null) ?? [])
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join("\n");

  const duration =
    typeof body.durationSec === "number" && body.durationSec > 0
      ? Math.round(body.durationSec)
      : m.duration_sec;

  if (!transcript) {
    await supabase
      .from("meetings")
      .update({
        status: "done",
        transcript: "",
        summary: "音声を認識できませんでした。",
        duration_sec: duration,
      })
      .eq("id", id);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, empty: true });
  }

  // 生成に失敗しても文字起こしは失わないよう、先に保存しておく
  await supabase
    .from("meetings")
    .update({ transcript, duration_sec: duration })
    .eq("id", id);

  let project: { name: string; client: string | null } | null = null;
  if (m.project_id) {
    const { data: p } = await supabase
      .from("projects")
      .select("name,client")
      .eq("id", m.project_id)
      .maybeSingle();
    project = p as unknown as { name: string; client: string | null } | null;
  }

  let minutes;
  try {
    minutes = await writeMinutes(transcript, {
      today: todayJST(),
      project: project?.name ?? null,
      client: project?.client ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "議事録の生成に失敗しました" },
      { status: 502 },
    );
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      status: "done",
      title: m.title === DEFAULT_TITLE ? minutes.title : m.title,
      summary: minutes.summary,
      decisions: minutes.decisions,
      next_agenda: minutes.next_agenda,
      email_draft: minutes.email_draft,
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("action_items").delete().eq("meeting_id", id);
  if (minutes.action_items.length > 0) {
    await supabase.from("action_items").insert(
      minutes.action_items.map((a) => ({
        meeting_id: id,
        project_id: m.project_id,
        owner: a.owner,
        content: a.content,
        due_date: a.due_date,
      })),
    );
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
