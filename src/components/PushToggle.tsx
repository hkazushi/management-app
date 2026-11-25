"use client";

import { useEffect, useState, useTransition } from "react";
import { removePush, savePush, testPush } from "@/app/(app)/settings/actions";
import { cheer } from "@/lib/cheer";

// 鍵（base64url）を、ブラウザが受け取る形にする
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))) : "");

type State = "loading" | "unsupported" | "needs-home" | "off" | "on" | "blocked";

// 毎朝の通知を、この端末でオン・オフする
export function PushToggle({ vapidKey }: { vapidKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      // iPhone は、ホーム画面に追加したアプリの中でしか通知を使えない
      if (ios && !standalone) return setState("needs-home");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, []);

  function turnOn() {
    setMessage("");
    start(async () => {
      try {
        if (!vapidKey) return setMessage("通知の鍵がサーバーに設定されていません");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
        const res = await savePush({ endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")) });
        if (res.error) {
          await sub.unsubscribe();
          return setMessage(res.error);
        }
        setState("on");
        cheer("毎朝お知らせします");
      } catch {
        setMessage("通知をオンにできませんでした");
      }
    });
  }

  function turnOff() {
    setMessage("");
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  }

  function test() {
    setMessage("");
    start(async () => {
      const res = await testPush();
      setMessage(res.error ?? "送りました。数秒で届きます");
    });
  }

  return (
    <div className="card space-y-3 p-4">
      {state === "loading" && <p className="text-sm text-muted">確認しています…</p>}
      {state === "needs-home" && (
        <p className="text-sm leading-relaxed text-ink">
          iPhone では、ホーム画面に追加した「ふたり手帖」から開いたときだけ通知を使えます。
          Safari の共有ボタン →「ホーム画面に追加」で追加し、そのアイコンから開いて、もう一度この画面を見てください。
        </p>
      )}
      {state === "unsupported" && <p className="text-sm leading-relaxed text-ink">このブラウザは通知に対応していません。</p>}
      {state === "blocked" && (
        <p className="text-sm leading-relaxed text-ink">
          この端末で通知が「許可しない」になっています。端末の「設定」→「通知」→「ふたり手帖」で許可してから、もう一度開いてください。
        </p>
      )}
      {state === "off" && (
        <button type="button" onClick={turnOn} disabled={pending} className="btn-primary w-full">
          {pending ? "…" : "この端末で通知をオンにする"}
        </button>
      )}
      {state === "on" && (
        <>
          <p className="text-sm font-bold text-ink">この端末は通知がオンです。</p>
          <div className="flex gap-2">
            <button type="button" onClick={test} disabled={pending} className="btn-primary flex-1">
              {pending ? "…" : "今日の内容で試しに送る"}
            </button>
            <button type="button" onClick={turnOff} disabled={pending} className="btn-ghost shrink-0">
              オフにする
            </button>
          </div>
        </>
      )}
      {message && <p className="text-xs font-bold text-ink">{message}</p>}
    </div>
  );
}
