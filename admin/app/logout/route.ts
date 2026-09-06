import { NextResponse } from "next/server";
import { clearAdminAuthCookieHeaders, publicAdminOrigin } from "../../lib/auth/google-oauth";

export async function GET(_request: Request) {
  const response = NextResponse.redirect(new URL("/", publicAdminOrigin()), {
    headers: { "Cache-Control": "no-store" },
  });
  for (const cookie of clearAdminAuthCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  return response;
}
