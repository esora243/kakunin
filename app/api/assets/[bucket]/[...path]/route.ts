import type { NextRequest } from "next/server";

/**
 * Same-tab passthrough for any /api/assets/<bucket>/... URL the admin form
 * may link to from a freshly uploaded thumbnail. Without this route the
 * admin would see an opaque 404 in the preview pane every time.
 */

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const upstream =
    process.env.GCS_PUBLIC_ASSET_BASE_URL ?? process.env.NEXT_PUBLIC_GCS_PUBLIC_ASSET_BASE_URL ?? "";
  if (!upstream) {
    return new Response("GCS_PUBLIC_ASSET_BASE_URL not configured", { status: 503 });
  }
  const target = `${upstream.replace(/\/+$/, "")}${url.pathname.replace(/^\/api\/assets\/[^/]+\//, "/")}${url.search}`;
  return Response.redirect(target, 302);
}
