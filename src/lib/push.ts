import webpush from "web-push";

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export const pushReady = () => !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

// 1台に送る。届け先がもう無い（アプリを消した・通知を切った）なら "gone" を返すので、呼ぶ側で消す
export async function sendPush(sub: PushSub, msg: PushMessage): Promise<"ok" | "gone" | "error"> {
  if (!pushReady()) return "error";
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(msg),
      {
        TTL: 60 * 60 * 6, // 6時間たっても届けられなければ捨てる（朝の通知が夜に来ても意味がない）
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || "https://management-app-ruddy.vercel.app",
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!,
        },
      },
    );
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}
