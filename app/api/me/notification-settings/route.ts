import { NextResponse } from "next/server";
import { isSessionInfrastructureError, readSessionFromCookies } from "@/lib/auth/session";
import { DatabaseConfigError } from "@/lib/db/postgres";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/notification-settings";
import { NotificationSettingsValidationError, validateNotificationSettings } from "@/lib/notification-settings-contract";
import { readJsonRequestBody, rejectCrossSiteRequest } from "@/lib/security/request";
import { rejectSharedRateLimitedRequest } from "@/lib/security/shared-rate-limit";

export const dynamic = "force-dynamic";

async function session() { return readSessionFromCookies(); }
const unauthorized = () => NextResponse.json({ ok: false, error: { code: "unauthorized", message: "Login is required" } }, { status: 401 });
const unavailable = (error: unknown) => error instanceof DatabaseConfigError || isSessionInfrastructureError(error);

export async function GET() {
  try {
    const current = await session(); if (!current) return unauthorized();
    const item = await getNotificationSettings(current); return item ? NextResponse.json({ ok: true, item }) : unauthorized();
  }
  catch (error) { return NextResponse.json({ ok: false, error: { code: unavailable(error) ? "service_unavailable" : "internal_error", message: "通知設定を取得できませんでした" } }, { status: unavailable(error) ? 503 : 500 }); }
}

export async function PUT(request: Request) {
  const rejected = rejectCrossSiteRequest(request); if (rejected) return rejected;
  try {
    const current = await session(); if (!current) return unauthorized();
    const limited = await rejectSharedRateLimitedRequest(request, { namespace: "authenticated-mutation:PUT:/api/me/notification-settings", identity: `user:${current.userId}`, limit: 30, windowMs: 60_000 }); if (limited) return limited;
    const json = await readJsonRequestBody(request); if (!json.ok) return json.response;
    const item = await updateNotificationSettings(current, validateNotificationSettings(json.body));
    return item ? NextResponse.json({ ok: true, item }) : unauthorized();
  } catch (error) {
    if (error instanceof NotificationSettingsValidationError) return NextResponse.json({ ok: false, error: { code: "validation_error", message: error.message } }, { status: 400 });
    return NextResponse.json({ ok: false, error: { code: unavailable(error) ? "service_unavailable" : "internal_error", message: "通知設定を保存できませんでした" } }, { status: unavailable(error) ? 503 : 500 });
  }
}
