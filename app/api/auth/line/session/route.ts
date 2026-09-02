import { NextResponse } from "next/server";
import { LineTokenVerifyError, verifyLineIdToken } from "@/lib/auth/line";
import { LoginUserRejectedError } from "@/lib/auth/line-session";
import { clearSessionCookie, setSessionCookie, SessionError } from "@/lib/auth/session";
import { isCurrentLegalConsentVersion } from "@/lib/legal-consent";
import { rejectSharedRateLimitedRequest } from "@/lib/security/shared-rate-limit";
import { readJsonRequestBody, rejectCrossSiteRequest } from "@/lib/security/request";
import { upsertUserByLineUid } from "@/lib/users";

export const dynamic = "force-dynamic";

function logLineVerifyFailure(error: LineTokenVerifyError) {
  if (error.upstreamStatus || error.lineRequestId) {
    console.warn("LINE ID token verification failed", {
      code: error.code,
      upstreamStatus: error.upstreamStatus,
      lineRequestId: error.lineRequestId,
    });
  }
}

function lineVerifyClientMessage(error: LineTokenVerifyError) {
  if (error.code === "line_verify_rate_limited") return "LINE authentication is rate limited";
  if (error.code === "line_verify_unavailable" || error.code === "line_channel_id_missing") {
    return "LINE authentication is temporarily unavailable";
  }
  return "LINE authentication failed";
}

function lineVerifyClientCode(error: LineTokenVerifyError) {
  if (error.code === "line_verify_rate_limited") return "line_verify_rate_limited";
  if (error.code === "line_verify_unavailable" || error.code === "line_channel_id_missing") return "line_verify_unavailable";
  return "line_token_invalid";
}

export async function POST(request: Request) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;
  try {
    const rateLimitResponse = await rejectSharedRateLimitedRequest(request, {
      namespace: "line-session",
      identity: "anonymous",
      limit: 10,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const jsonBody = await readJsonRequestBody(request);
    if (!jsonBody.ok) return jsonBody.response;
    const body = jsonBody.body;

    const legalConsentVersion =
      body && typeof body === "object"
        ? (body as { legalConsentVersion?: unknown }).legalConsentVersion
        : null;
    if (!isCurrentLegalConsentVersion(legalConsentVersion)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "legal_consent_required",
            message: "Current legal consent is required",
          },
        },
        { status: 400 },
      );
    }

    const idToken = body && typeof body === "object" ? (body as { idToken?: unknown }).idToken : null;
    if (typeof idToken !== "string" || !idToken) {
      return NextResponse.json({ ok: false, error: { code: "validation_error", message: "idToken is required" } }, { status: 400 });
    }

    const lineUid = (await verifyLineIdToken({ idToken })).lineUid;
    const me = await upsertUserByLineUid(lineUid, legalConsentVersion);
    await setSessionCookie({ userId: me.id, legalConsentVersion });
    return NextResponse.json({ ok: true, item: me });
  } catch (error) {
    if (error instanceof LineTokenVerifyError) {
      logLineVerifyFailure(error);
      return NextResponse.json(
        { ok: false, error: { code: lineVerifyClientCode(error), message: lineVerifyClientMessage(error) } },
        { status: error.httpStatus },
      );
    }
    if (error instanceof LoginUserRejectedError) {
      await clearSessionCookie();
      return NextResponse.json(
        { ok: false, error: { code: "login_unavailable", message: "Login is not available" } },
        { status: error.httpStatus },
      );
    }
    if (error instanceof SessionError) {
      return NextResponse.json(
        { ok: false, error: { code: "session_unavailable", message: "Login session is temporarily unavailable" } },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "internal_error", message: "LINE session creation failed" } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
