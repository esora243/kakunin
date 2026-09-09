import { NextResponse } from "next/server";
import { clearAdminAuthCookieHeaders, publicAdminOrigin } from "../../lib/auth/google-oauth";
import { isOpenAccessEnabled } from "../../lib/auth/open-access";

export async function GET(request: Request) {
  // オープンアクセスモードでは GOOGLE_OAUTH_REDIRECT_URI が未設定なので、
  // 現在のリクエストのオリジンへリダイレクトする。
  const origin = isOpenAccessEnabled() ? new URL(request.url).origin : publicAdminOrigin();
  const response = NextResponse.redirect(new URL("/", origin), {
    headers: { "Cache-Control": "no-store" },
  });
  for (const cookie of clearAdminAuthCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
