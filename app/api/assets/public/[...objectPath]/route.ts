import "server-only";

import { NextResponse } from "next/server";
import {
  isAllowedPublicAssetContentType,
  normalizePublicAssetObjectPath,
  PUBLIC_ASSET_CACHE_CONTROL,
} from "@/lib/public-assets";

export const runtime = "nodejs";

type MetadataTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

const globalForAssetToken = globalThis as typeof globalThis & {
  hugmeidPublicAssetToken?: { token: string; expiresAt: number };
};

async function getCloudRunAccessToken(): Promise<string> {
  const cached = globalForAssetToken.hugmeidPublicAssetToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request -- Cloud Run's link-local metadata endpoint is HTTP by platform contract and requires Metadata-Flavor.
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!response.ok) throw new Error("metadata_token_unavailable");

  const body = (await response.json()) as MetadataTokenResponse;
  if (!body.access_token || typeof body.expires_in !== "number") throw new Error("metadata_token_malformed");

  globalForAssetToken.hugmeidPublicAssetToken = {
    token: body.access_token,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
  return body.access_token;
}

function noStore(status: number) {
  return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ objectPath?: string[] }> }) {
  const bucketName = process.env.GCS_PUBLIC_ASSET_BUCKET?.trim();
  if (!bucketName) return noStore(503);

  const { objectPath: rawParts = [] } = await params;
  const objectPath = normalizePublicAssetObjectPath(rawParts);
  if (!objectPath) return noStore(404);

  try {
    const token = await getCloudRunAccessToken();
    const acceptsAvif = request.headers.get("accept")?.includes("image/avif") ?? false;
    const candidatePaths = acceptsAvif && objectPath.endsWith(".webp")
      ? [objectPath.replace(/\.webp$/, ".avif"), objectPath]
      : [objectPath];
    let response: Response | null = null;
    for (const candidatePath of candidatePaths) {
      const candidate = await fetch(
        `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(candidatePath)}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (candidate.ok) {
        response = candidate;
        break;
      }
      if (candidate.status !== 404 && candidate.status !== 403) return noStore(502);
    }
    if (!response) return noStore(404);

    const contentType = response.headers.get("content-type") ?? undefined;
    if (!isAllowedPublicAssetContentType(contentType)) return noStore(404);

    const buffer = Buffer.from(await response.arrayBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": PUBLIC_ASSET_CACHE_CONTROL,
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Vary": "Accept",
      },
    });
  } catch {
    return noStore(502);
  }
}
