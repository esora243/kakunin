import { NextResponse } from "next/server";
import { completeGoogleOAuthCallback, getGoogleOAuthFlowCookieName, publicAdminOrigin } from "../../../lib/auth/google-oauth";
import { AdminAuthError, adminAuthErrorStatus, adminAuthPublicMessage } from "../../../lib/auth/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flowCookie = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${getGoogleOAuthFlowCookieName()}=`))
    ?.slice(getGoogleOAuthFlowCookieName().length + 1) ?? null;

  try {
    const result = await completeGoogleOAuthCallback({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      flowCookie,
    });
    const response = NextResponse.redirect(new URL(result.redirectTo, publicAdminOrigin()), {
      headers: { "Cache-Control": "no-store" },
    });
    for (const cookie of result.setCookieHeaders) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: { code: error.code, message: adminAuthPublicMessage(error) } },
        { status: adminAuthErrorStatus(error), headers: { "Cache-Control": "no-store" } },
      );
    }
    throw error;
  }
}
