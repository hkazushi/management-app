import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeWav } from "@/lib/ai";

export const maxDuration = 60;

// 録音中に約60秒ごとに届く WAV 断片を文字起こしして保存する。
// 未ログインや他人の打ち合わせは RLS で meeting が取れず 404 になる。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const seq = Number(new URL(req.url).searchParams.get("seq"));
  if (!Number.isInteger(seq) || seq < 0) {
    return NextResponse.json({ error: "seq が不正です" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: meeting } = await supabase
    .from("meetings")
    .select("id,project_id")
    .eq("id", id)
    .maybeSingle();
  const m = meeting as unknown as { id: string; project_id: string | null } | null;
  if (!m) return NextResponse.json({ error: "打ち合わせが見つかりません" }, { status: 404 });

  const wav = await req.arrayBuffer();
  // Vercel のリクエスト上限（4.5MB）より手前で弾く。60秒の断片は約1.9MB。
  if (wav.byteLength < 1000 || wav.byteLength > 4_400_000) {
    return NextResponse.json({ error: "音声データのサイズが不正です" }, { status: 413 });
  }

  let hint = "";
  if (m.project_id) {
    const { data: p } = await supabase
      .from("projects")
      .select("name,client")
      .eq("id", m.project_id)
      .maybeSingle();
    const proj = p as unknown as { name: string; client: string | null } | null;
    if (proj) hint = [proj.name, proj.client].filter(Boolean).join("、");
  }

  let text: string;
  try {
    text = await transcribeWav(wav, hint);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "文字起こしに失敗しました" },
      { status: 502 },
    );
  }

  const { error } = await supabase
    .from("meeting_segments")
    .upsert({ meeting_id: id, seq, text }, { onConflict: "meeting_id,seq" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ seq, text });
}
