import { NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

function trustedProxyHops() {
  const value = process.env.HUGMEID_TRUSTED_PROXY_HOPS;
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function rateLimitClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return "unknown";

  const chain = forwardedFor
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (chain.length === 0) return "unknown";
  if (chain.length === 1) return chain[0] ?? "unknown";

  const trustedHops = trustedProxyHops();
  if (trustedHops === 0) return "unknown";
  return chain.length === trustedHops + 1 ? chain[0] ?? "unknown" : "unknown";
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { ok: false, error: { code: "rate_limited", message: "Too many requests" } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function rejectRateLimitedRequest(
  request: Request,
  {
    namespace,
    identity,
    limit,
    windowMs,
    now = Date.now(),
  }: {
    namespace: string;
    identity?: string;
    limit: number;
    windowMs: number;
    now?: number;
  },
) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  const key = `${namespace}:${identity ?? "anonymous"}:${rateLimitClientIp(request)}`;
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  existing.count += 1;
  if (existing.count > limit) {
    return rateLimitedResponse(Math.max(1, Math.ceil((existing.resetAt - now) / 1000)));
  }

  return null;
}
