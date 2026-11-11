"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startMeeting } from "@/app/(app)/meetings/actions";
import { Icon } from "./Icon";

const TARGET_RATE = 16000; // 文字起こし用に 16kHz モノラルへ落とす
const CHUNK_SEC = 60; // 60秒ごとに区切って送る（1断片 約1.9MB）
const SILENCE_RMS = 0.0015; // これ未満の断片は無音として送らない

// マイク入力の生データをメインスレッドへ渡すだけの処理
const WORKLET_SRC = `
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("pcm-tap", PcmTap);
`;

type Segment = { seq: number; text: string; state: "pending" | "ok" | "silent" | "error" };
type Phase = "idle" | "starting" | "recording" | "finishing";

function downsample(input: Float32Array, inRate: number): Float32Array {
  if (inRate === TARGET_RATE) return input;
  const ratio = inRate / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // モノラル
  v.setUint32(24, TARGET_RATE, true);
  v.setUint32(28, TARGET_RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

const clock = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export function Recorder({
  projects,
  defaultProjectId,
}: {
  projects: { id: string; name: string }[];
  defaultProjectId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [title, setTitle] = useState("");
  const [online, setOnline] = useState(false);
  const [canShareAudio, setCanShareAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [failedId, setFailedId] = useState("");

  const ctxRef = useRef<AudioContext | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const buffersRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const seqRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const meetingIdRef = useRef("");
  const startedAtRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // タブ音声の共有は PC のブラウザのみ
    setCanShareAudio(
      typeof navigator.mediaDevices?.getDisplayMedia === "function" &&
        !/iPhone|iPad|Android/i.test(navigator.userAgent),
    );
  }, []);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)),
      1000,
    );
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(timer);
      window.removeEventListener("beforeunload", warn);
    };
  }, [phase]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [segments]);

  // 画面を離れたら録音デバイスを必ず解放する
  useEffect(
    () => () => {
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      void ctxRef.current?.close().catch(() => {});
      void wakeLockRef.current?.release().catch(() => {});
    },
    [],
  );

  const patchSegment = (seq: number, patch: Partial<Segment>) =>
    setSegments((prev) => prev.map((s) => (s.seq === seq ? { ...s, ...patch } : s)));

  async function upload(seq: number, wav: Blob) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/meetings/${meetingIdRef.current}/chunk?seq=${seq}`, {
          method: "POST",
          headers: { "Content-Type": "audio/wav" },
          body: wav,
        });
        if (res.ok) {
          const j = (await res.json()) as { text: string };
          patchSegment(seq, { text: j.text, state: j.text ? "ok" : "silent" });
          return;
        }
      } catch {
        /* 通信エラーは下で待ってから再試行 */
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    patchSegment(seq, { state: "error" });
  }

  // 溜まった音声を1断片として切り出し、文字起こしの列に積む
  function cutChunk(inRate: number) {
    const total = sampleCountRef.current;
    if (total === 0) return;
    const merged = new Float32Array(total);
    let offset = 0;
    for (const b of buffersRef.current) {
      merged.set(b, offset);
      offset += b.length;
    }
    buffersRef.current = [];
    sampleCountRef.current = 0;

    const samples = downsample(merged, inRate);
    let sq = 0;
    for (let i = 0; i < samples.length; i++) sq += samples[i] * samples[i];
    const rms = Math.sqrt(sq / Math.max(1, samples.length));

    const seq = seqRef.current++;
    if (rms < SILENCE_RMS) {
      setSegments((prev) => [...prev, { seq, text: "", state: "silent" }]);
      return;
    }
    setSegments((prev) => [...prev, { seq, text: "", state: "pending" }]);
    const wav = encodeWav(samples);
    queueRef.current = queueRef.current.then(() => upload(seq, wav));
  }

  async function start() {
    setError("");
    setNotice("");
    setFailedId("");
    setPhase("starting");

    // クリック直後（ユーザー操作の中）で作っておく。Safari 対策。
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamsRef.current = [mic];

      let tabAudio: MediaStream | null = null;
      if (online) {
        try {
          const shared = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          streamsRef.current.push(shared);
          if (shared.getAudioTracks().length > 0) tabAudio = shared;
          else setNotice("相手側の音声が共有されていません。マイクの音だけ録音します。");
        } catch {
          setNotice("画面共有がキャンセルされたため、マイクの音だけ録音します。");
        }
      }

      const created = await startMeeting(projectId || null, title);
      if (!created.id) throw new Error(created.error ?? "打ち合わせを作成できませんでした");
      meetingIdRef.current = created.id;

      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      await ctx.resume();

      const tap = new AudioWorkletNode(ctx, "pcm-tap", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      const inRate = ctx.sampleRate;
      tap.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const data = e.data;
        buffersRef.current.push(data);
        sampleCountRef.current += data.length;
        if (meterRef.current) {
          let sq = 0;
          for (let i = 0; i < data.length; i++) sq += data[i] * data[i];
          const level = Math.min(100, Math.sqrt(sq / data.length) * 600);
          meterRef.current.style.width = `${level}%`;
        }
        if (sampleCountRef.current >= CHUNK_SEC * inRate) cutChunk(inRate);
      };

      ctx.createMediaStreamSource(mic).connect(tap);
      if (tabAudio) ctx.createMediaStreamSource(tabAudio).connect(tap);
      // 出力先につながないと処理が回らないブラウザがあるため、無音で接続する
      const mute = ctx.createGain();
      mute.gain.value = 0;
      tap.connect(mute).connect(ctx.destination);

      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen").catch(() => null);
      }

      seqRef.current = 0;
      buffersRef.current = [];
      sampleCountRef.current = 0;
      queueRef.current = Promise.resolve();
      setSegments([]);
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
    } catch (e) {
      streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      streamsRef.current = [];
      void ctx.close().catch(() => {});
      ctxRef.current = null;
      const denied = e instanceof DOMException && e.name === "NotAllowedError";
      setError(
        denied
          ? "マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。"
          : e instanceof Error
            ? e.message
            : "録音を開始できませんでした",
      );
      setPhase("idle");
    }
  }

  async function stop() {
    const ctx = ctxRef.current;
    if (!ctx) return;
    setPhase("finishing");
    const durationSec = Math.round((Date.now() - startedAtRef.current) / 1000);
    const inRate = ctx.sampleRate;

    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    await ctx.close().catch(() => {});
    ctxRef.current = null;
    void wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;

    cutChunk(inRate); // 最後の端数
    await queueRef.current;

    const id = meetingIdRef.current;
    try {
      const res = await fetch(`/api/meetings/${id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSec }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "議事録の作成に失敗しました");
      }
      router.push(`/meetings/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "議事録の作成に失敗しました");
      setFailedId(id);
      setPhase("idle");
    }
  }

  const pending = segments.filter((s) => s.state === "pending").length;
  const failed = segments.filter((s) => s.state === "error").length;

  if (phase === "finishing") {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="font-semibold text-ink">議事録を作成しています</p>
        <p className="text-sm text-muted">
          要約・決定事項・宿題をまとめています。1分ほどかかります。この画面のままお待ちください。
        </p>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="space-y-4">
        <div className="card flex flex-col items-center gap-4 px-6 py-8">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" />
            録音中
          </p>
          <p className="text-5xl font-bold tabular-nums tracking-tight text-ink">{clock(elapsed)}</p>
          <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-black/[0.06]">
            <div ref={meterRef} className="h-full rounded-full bg-success transition-[width] duration-100" style={{ width: 0 }} />
          </div>
          <button
            onClick={stop}
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-danger px-8 py-3.5 text-base font-semibold text-white transition hover:brightness-95 active:scale-[0.98]"
          >
            <Icon name="stop" size={18} filled />
            終了して議事録を作る
          </button>
          <p className="text-xs text-muted">録音中はこの画面を開いたままにしてください。</p>
          {notice && <p className="text-xs text-warning">{notice}</p>}
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">文字起こし（1分ごとに追加）</h2>
            <span className="text-xs text-muted">
              {pending > 0 && `処理中 ${pending}件`}
              {failed > 0 && <span className="ml-2 text-danger">失敗 {failed}件</span>}
            </span>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto text-sm leading-relaxed text-ink">
            {segments.length === 0 && (
              <p className="text-muted">最初の1分が終わると、ここに表示されます。</p>
            )}
            {segments.map((s) => (
              <p key={s.seq} className="whitespace-pre-wrap">
                {s.state === "pending" && <span className="text-faint">文字起こし中…</span>}
                {s.state === "silent" && <span className="text-faint">（無音）</span>}
                {s.state === "error" && (
                  <span className="text-danger">この1分は文字起こしに失敗しました</span>
                )}
                {s.state === "ok" && s.text}
              </p>
            ))}
            <div ref={listEndRef} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <label htmlFor="rec-project" className="text-sm font-medium text-muted">
            案件（あとから変更できます）
          </label>
          <select
            id="rec-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input mt-1"
          >
            <option value="">案件を選ばない</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rec-title" className="text-sm font-medium text-muted">
            タイトル（空欄なら自動で付きます）
          </label>
          <input
            id="rec-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input mt-1"
            placeholder="例: 11月定例"
          />
        </div>
        {canShareAudio && (
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={online}
              onChange={(e) => setOnline(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
            />
            <span>
              オンライン会議の相手の声も録る
              <span className="mt-0.5 block text-xs text-muted">
                開始時に共有ダイアログが出ます。会議のタブを選び「タブの音声も共有」をオンにしてください。
              </span>
            </span>
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
          {failedId && (
            <>
              {" "}
              文字起こしは保存されています。
              <Link href={`/meetings/${failedId}`} className="font-semibold underline">
                議事録の画面
              </Link>
              から作り直せます。
            </>
          )}
        </div>
      )}

      <button
        onClick={start}
        disabled={phase === "starting"}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-white shadow-glow transition hover:bg-primary-deep active:scale-[0.99] disabled:opacity-60"
      >
        <Icon name="mic" size={22} />
        {phase === "starting" ? "準備中…" : "録音を開始"}
      </button>
      <p className="text-center text-xs text-muted">
        マイクの許可を求められたら「許可」を選んでください。
      </p>
    </div>
  );
}
