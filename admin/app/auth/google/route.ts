import { NextResponse } from "next/server";
import { createGoogleAuthorizationRedirect, normalizeReturnTo, publicAdminOrigin } from "../../../lib/auth/google-oauth";
import { AdminAuthError, adminAuthErrorStatus, adminAuthPublicMessage } from "../../../lib/auth/types";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const canonicalOrigin = publicAdminOrigin();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const externalOrigin = forwardedHost ? `${forwardedProto || "https"}://${forwardedHost}` : url.origin;
    if (externalOrigin !== canonicalOrigin) {
      const canonicalStartUrl = new URL("/auth/google", canonicalOrigin);
      const returnTo = normalizeReturnTo(url.searchParams.get("returnTo"));
      if (returnTo !== "/") canonicalStartUrl.searchParams.set("returnTo", returnTo);
      return NextResponse.redirect(canonicalStartUrl, { headers: { "Cache-Control": "no-store" } });
    }
    const { redirectUrl, setCookieHeader } = createGoogleAuthorizationRedirect(
      normalizeReturnTo(url.searchParams.get("returnTo")),
    );
    const response = NextResponse.redirect(redirectUrl, { headers: { "Cache-Control": "no-store" } });
    response.headers.append("Set-Cookie", setCookieHeader);
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
