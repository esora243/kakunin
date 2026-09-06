import { NextResponse } from "next/server";
import { isSessionInfrastructureError, readSessionFromCookies } from "@/lib/auth/session";
import { DatabaseConfigError } from "@/lib/db/postgres";
import { ProfileValidationError, validateUpdateProfileRequest } from "@/lib/profile";
import { readJsonRequestBody, rejectCrossSiteRequest } from "@/lib/security/request";
import { rejectSharedRateLimitedRequest } from "@/lib/security/shared-rate-limit";
import { updateProfileForSession } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const crossSiteResponse = rejectCrossSiteRequest(request);
  if (crossSiteResponse) return crossSiteResponse;

  try {
    const session = await readSessionFromCookies();
    if (!session) {
      return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Login is required" } }, { status: 401 });
    }

    const rateLimitResponse = await rejectSharedRateLimitedRequest(request, {
      namespace: "authenticated-mutation:PUT:/api/me/profile",
      identity: `user:${session.userId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const jsonBody = await readJsonRequestBody(request);
    if (!jsonBody.ok) return jsonBody.response;
    const body = jsonBody.body;
    const profileRequest = validateUpdateProfileRequest(body);
    const me = await updateProfileForSession(session, profileRequest);
    if (!me) {
      return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Login is required" } }, { status: 401 });
    }
    return NextResponse.json({ ok: true, item: me });
  } catch (error) {
    if (error instanceof ProfileValidationError) {
      return NextResponse.json(
        { ok: false, error: { code: "validation_error", message: error.issues.join(", ") } },
        { status: 400 },
      );
    }
    if (error instanceof DatabaseConfigError || isSessionInfrastructureError(error)) {
      return NextResponse.json(
        { ok: false, error: { code: "service_unavailable", message: "Service temporarily unavailable" } },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "internal_error", message: "Failed to update profile" } },
      { status: 500 },
    );
  }
}
