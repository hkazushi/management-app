import { NextRequest, NextResponse } from "next/server";

// Google OAuth 同意画面へリダイレクト（アカウント選択あり）。
// 必要 env: GOOGLE_CLIENT_ID（未設定なら設定画面にエラー表示）。
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const origin = new URL(req.url).origin;
  if (!clientId) {
    return NextResponse.redirect(`${origin}/settings?error=noconfig`);
  }

  const redirectUri = `${origin}/api/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
