import type { NextRequest } from "next/server";

/**
 * Stable URL surfaced in admin/app forms so uploaded hero/thumbnail URLs can
 * be opened directly in the browser without round-tripping through signed GCS
 * links. This route is configured in next.config.mjs as a no-store response
 * and serves a same-tab redirect to the configured public GCS host.
 */

export const runtime = "nodejs";

const REMOTE_PUBLIC_HOST = (
  process.env.GCS_PUBLIC_ASSET_BASE_URL ?? process.env.NEXT_PUBLIC_GCS_PUBLIC_ASSET_BASE_URL ?? ""
).replace(/\/+$/, "");

export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const segments = url.pathname.split("/api/assets/public/")[1] ?? "";
  const target = `${REMOTE_PUBLIC_HOST}/${segments}${url.search}`;
  return Response.redirect(target, 302);
}
