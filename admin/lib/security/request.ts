import "server-only";

import { createHash } from "node:crypto";

function trustedProxyHops() {
  const parsed = Number(process.env.HUGMEID_TRUSTED_PROXY_HOPS ?? 0);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

export function clientIp(request: Request): string {
  const chain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (chain.length === 1) return chain[0] ?? "unknown";
  const trustedHops = trustedProxyHops();
  return trustedHops > 0 && chain.length === trustedHops + 1 ? chain[0] ?? "unknown" : "unknown";
}

export function clientKey(request: Request): string {
  return createHash("sha256").update(clientIp(request)).digest("hex");
}
