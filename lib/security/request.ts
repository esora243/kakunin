import { NextResponse } from "next/server";

const MAX_MUTATION_CONTENT_LENGTH_BYTES = 16 * 1024;

function sameOriginForbidden() {
  return NextResponse.json(
    { ok: false, error: { code: "forbidden_origin", message: "Request origin is not allowed" } },
    { status: 403 },
  );
}

function contentTooLarge() {
  return NextResponse.json(
    { ok: false, error: { code: "request_too_large", message: "Request body is too large" } },
    { status: 413 },
  );
}

function invalidJsonBody() {
  return NextResponse.json(
    { ok: false, error: { code: "validation_error", message: "Invalid JSON body" } },
    { status: 400 },
  );
}

function unsupportedJsonContentType() {
  return NextResponse.json(
    { ok: false, error: { code: "unsupported_media_type", message: "JSON content-type is required" } },
    { status: 415 },
  );
}

function configuredSiteOrigin() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
  }
}

export function rejectCrossSiteRequest(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (!Number.isFinite(parsedLength) || parsedLength > MAX_MUTATION_CONTENT_LENGTH_BYTES) return contentTooLarge();
  }

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set([requestOrigin, configuredSiteOrigin()].filter((origin): origin is string => Boolean(origin)));
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return sameOriginForbidden();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin && fetchSite && fetchSite !== "same-origin") return sameOriginForbidden();
  if (!origin && !fetchSite && process.env.NODE_ENV === "production") return sameOriginForbidden();

  return null;
}

function hasJsonContentType(request: Request) {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return Boolean(contentType
    .split(";")[0]
    ?.trim()
    .toLowerCase()
    .match(/^(?:application\/json|[^/]+\/[^+]+\+json)$/));
}

async function readLimitedTextBody(request: Request) {
  if (!request.body) return "";

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  const reader = request.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_MUTATION_CONTENT_LENGTH_BYTES) return { ok: false as const, response: contentTooLarge() };
    chunks.push(value);
  }

  const bytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true as const, body: new TextDecoder().decode(bytes) };
}

export async function readJsonRequestBody(request: Request) {
  if (request.body && !hasJsonContentType(request)) return { ok: false as const, response: unsupportedJsonContentType() };
  const textResult = await readLimitedTextBody(request);
  if (typeof textResult !== "string" && !textResult.ok) return textResult;

  const text = typeof textResult === "string" ? textResult : textResult.body;
  if (!text.trim()) return { ok: true as const, body: null };

  try {
    return { ok: true as const, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, response: invalidJsonBody() };
  }
}
