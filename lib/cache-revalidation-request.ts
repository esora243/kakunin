import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const ALLOWED_TAGS = new Set(["jobs", "activities", "contents", "timetable", "profile-options"]);

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status, headers: NO_STORE_HEADERS });
}

function isAuthorized(request: Request, expected: string): boolean {
  const provided = request.headers.get("x-admin-revalidate-secret");
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function handleCacheRevalidation(
  request: Request,
  expectedSecret: string | undefined,
  revalidate: (tag: string) => void,
) {
  const expected = expectedSecret?.trim();
  if (!expected) {
    return errorResponse("service_unavailable", "Cache revalidation is temporarily unavailable", 503);
  }
  if (!isAuthorized(request, expected)) {
    return errorResponse("unauthorized", "Missing or invalid revalidation secret", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", "Request body must be JSON", 400);
  }

  const tags = (body as { tags?: unknown })?.tags;
  if (!Array.isArray(tags) || tags.length === 0 || !tags.every((tag) => typeof tag === "string")) {
    return errorResponse("invalid_request", "`tags` must be a non-empty string array", 400);
  }
  const invalidTags = tags.filter((tag) => !ALLOWED_TAGS.has(tag));
  if (invalidTags.length > 0) {
    return errorResponse("invalid_request", `Unknown cache tags: ${invalidTags.join(", ")}`, 400);
  }
  for (const tag of tags) revalidate(tag);
  return NextResponse.json({ ok: true, revalidated: tags }, { headers: NO_STORE_HEADERS });
}
