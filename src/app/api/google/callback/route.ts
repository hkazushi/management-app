import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google OAuth コールバック：codeをトークンに交換し、ログイン中アカウントに紐付けて保存。
// トークンは service key でサーバー側からのみ書き込み（クライアントに露出させない）。
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const settings = (q: string) => NextResponse.redirect(`${origin}/settings?${q}`);

  if (!code) return settings("error=denied");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return settings("error=noconfig");

  // ログイン中のアプリアカウントを特定
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // code → token 交換
  let tok: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    tok = await res.json();
  } catch {
    return settings("error=token");
  }
  if (!tok.access_token) return settings("error=token");

  // 連携した Google アカウントのメール取得
  let email = "";
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    email = (await ui.json()).email ?? "";
  } catch {
    /* メール取得失敗は致命ではない */
  }

  // service key で保存（クライアントには出さない）
  const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SECRET = process.env.SUPABASE_SECRET_KEY;
  if (!SECRET) return settings("error=server");
  await fetch(`${SUPA}/rest/v1/google_connections`, {
    method: "POST",
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      user_id: user.id,
      google_email: email,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token ?? null,
      expiry: tok.expires_in
        ? new Date(Date.now() + tok.expires_in * 1000).toISOString()
        : null,
      scope: tok.scope ?? null,
      updated_at: new Date().toISOString(),
    }),
  });

  return settings("connected=1");
}
