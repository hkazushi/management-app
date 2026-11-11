// AI 呼び出し（サーバー専用。Route Handler からのみ使う）。
// ANTHROPIC_API_KEY には OpenRouter のキー（sk-or-）が入っている。
// 文字起こしは音声入力対応の Gemini、議事録の整理は Claude を OpenRouter 経由で呼ぶ。

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TRANSCRIBE_MODEL = "google/gemini-2.5-flash";
const MINUTES_MODEL = "anthropic/claude-sonnet-4.6";

export type MinutesResult = {
  title: string;
  summary: string;
  decisions: string[];
  action_items: { owner: string; content: string; due_date: string | null }[];
  next_agenda: string[];
  email_draft: string;
};

function apiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI のキー（ANTHROPIC_API_KEY）が未設定です");
  return key;
}

async function chat(body: Record<string, unknown>): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `AI の呼び出しに失敗しました（HTTP ${res.status}）`);
  }
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

// 16kHz モノラル WAV の断片を文字起こしする。無音なら空文字を返す。
export async function transcribeWav(wav: ArrayBuffer, hint: string): Promise<string> {
  const text = await chat({
    model: TRANSCRIBE_MODEL,
    temperature: 0,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "次の音声は日本語の打ち合わせの一部です。聞こえた発言をそのまま日本語で文字起こししてください。" +
              "要約・補足・前置きは書かず、文字起こしの本文だけを出力します。話者が変わったら改行してください。" +
              "無音、雑音、聞き取れない音声しかない場合は「（無音）」とだけ出力してください。" +
              (hint ? `\n参考（固有名詞の表記）: ${hint}` : ""),
          },
          {
            type: "input_audio",
            input_audio: { data: Buffer.from(wav).toString("base64"), format: "wav" },
          },
        ],
      },
    ],
  });
  return /^[（(\[]?\s*無音\s*[）)\]]?$/.test(text) ? "" : text;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
}

// 文字起こし全文から議事録（要約・決定事項・宿題・次回の議題・メール下書き）を作る。
export async function writeMinutes(
  transcript: string,
  ctx: { today: string; project: string | null; client: string | null },
): Promise<MinutesResult> {
  const raw = await chat({
    model: MINUTES_MODEL,
    temperature: 0.2,
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content:
          "あなたは打ち合わせの議事録を作る秘書です。文字起こしに書かれている事実だけを使い、推測で決定事項や宿題を作りません。" +
          "出力は次の形の JSON オブジェクトだけにします（前後に文章やコードブロックを付けない）。\n" +
          '{"title": "20字以内の打ち合わせ名", "summary": "3〜6文の要約", "decisions": ["決まったこと"], ' +
          '"action_items": [{"owner": "担当", "content": "やること", "due_date": "YYYY-MM-DD または null"}], ' +
          '"next_agenda": ["次回確認すること"], "email_draft": "相手に送る議事録メールの本文"}\n' +
          "owner は、録音した本人の宿題なら「自分」、相手側なら名前か会社名、判別できなければ「未定」にします。" +
          "「来週金曜」のような相対的な期限は今日の日付から計算し、期限の言及がなければ null にします。" +
          "email_draft は件名を含めず、丁寧語で、決定事項と双方の宿題を箇条書きにまとめます。",
      },
      {
        role: "user",
        content:
          `今日の日付: ${ctx.today}\n` +
          (ctx.project ? `案件: ${ctx.project}\n` : "") +
          (ctx.client ? `クライアント: ${ctx.client}\n` : "") +
          `\n--- 文字起こし ---\n${transcript}`,
      },
    ],
  });

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("議事録の生成結果を読み取れませんでした");
  const j = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

  const items = Array.isArray(j.action_items) ? j.action_items : [];
  return {
    title: typeof j.title === "string" && j.title.trim() ? j.title.trim() : "打ち合わせ",
    summary: typeof j.summary === "string" ? j.summary.trim() : "",
    decisions: strings(j.decisions),
    next_agenda: strings(j.next_agenda),
    email_draft: typeof j.email_draft === "string" ? j.email_draft.trim() : "",
    action_items: items
      .map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        const due = typeof o.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.due_date) ? o.due_date : null;
        return {
          owner: typeof o.owner === "string" && o.owner.trim() ? o.owner.trim() : "未定",
          content: typeof o.content === "string" ? o.content.trim() : "",
          due_date: due,
        };
      })
      .filter((it) => it.content !== ""),
  };
}
