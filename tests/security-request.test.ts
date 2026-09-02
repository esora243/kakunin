import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { rejectRateLimitedRequest } from "../lib/security/rate-limit";
import { readJsonRequestBody, rejectCrossSiteRequest } from "../lib/security/request";

test("mutating request guard accepts same-origin requests", () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { origin: "https://hugmeid.example" },
  });

  assert.equal(rejectCrossSiteRequest(request), null);
});

test("mutating request guard rejects cross-site browser requests", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { origin: "https://evil.example" },
  });

  const response = rejectCrossSiteRequest(request);
  assert.ok(response);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: { code: "forbidden_origin", message: "Request origin is not allowed" },
  });
});

test("mutating request guard fails closed for missing browser origin in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true, enumerable: true, writable: true });
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
  });

  const response = rejectCrossSiteRequest(request);
  Object.defineProperty(process.env, "NODE_ENV", { value: previousNodeEnv, configurable: true, enumerable: true, writable: true });
  assert.ok(response);
  assert.equal(response.status, 403);
});

test("mutating request guard rejects same-site requests without origin", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { "sec-fetch-site": "same-site" },
  });

  const response = rejectCrossSiteRequest(request);
  assert.ok(response);
  assert.equal(response.status, 403);
});

test("mutating request guard accepts same-origin fetch metadata without origin", () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { "sec-fetch-site": "same-origin" },
  });

  assert.equal(rejectCrossSiteRequest(request), null);
});

test("mutating request guard rejects oversized declared bodies", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: {
      origin: "https://hugmeid.example",
      "content-length": String(16 * 1024 + 1),
    },
  });

  const response = rejectCrossSiteRequest(request);
  assert.ok(response);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: { code: "request_too_large", message: "Request body is too large" },
  });
});

test("limited JSON reader rejects oversized bodies without content-length", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(16 * 1024) }),
  });

  assert.equal(request.headers.get("content-length"), null);
  const result = await readJsonRequestBody(request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 413);
  assert.deepEqual(await result.response.json(), {
    ok: false,
    error: { code: "request_too_large", message: "Request body is too large" },
  });
});

test("limited JSON reader rejects non-JSON content types", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify({ value: "ok" }),
  });

  const result = await readJsonRequestBody(request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 415);
  assert.deepEqual(await result.response.json(), {
    ok: false,
    error: { code: "unsupported_media_type", message: "JSON content-type is required" },
  });
});

test("limited JSON reader rejects malformed JSON bodies", async () => {
  const request = new Request("https://hugmeid.example/api/me/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{",
  });

  const result = await readJsonRequestBody(request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.response.status, 400);
  assert.deepEqual(await result.response.json(), {
    ok: false,
    error: { code: "validation_error", message: "Invalid JSON body" },
  });
});

test("rate limiter rejects repeated requests from the same client", async () => {
  const request = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  assert.equal(rejectRateLimitedRequest(request, { namespace: "test-rate", limit: 2, windowMs: 60_000, now: 1 }), null);
  assert.equal(rejectRateLimitedRequest(request, { namespace: "test-rate", limit: 2, windowMs: 60_000, now: 2 }), null);
  const response = rejectRateLimitedRequest(request, { namespace: "test-rate", limit: 2, windowMs: 60_000, now: 3 });
  assert.ok(response);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("rate limiter ignores spoofed leading forwarded-for values", async () => {
  const first = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.10, 35.191.0.1" },
  });
  const second = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.2, 203.0.113.10, 35.191.0.1" },
  });

  assert.equal(rejectRateLimitedRequest(first, { namespace: "test-spoofed-rate", limit: 1, windowMs: 60_000, now: 1 }), null);
  const response = rejectRateLimitedRequest(second, { namespace: "test-spoofed-rate", limit: 1, windowMs: 60_000, now: 2 });
  assert.ok(response);
  assert.equal(response.status, 429);
});

test("rate limiter does not trust spoofable two-hop forwarded-for chains", async () => {
  const first = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.1, 35.191.0.1" },
  });
  const second = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.2, 35.191.0.1" },
  });

  assert.equal(rejectRateLimitedRequest(first, { namespace: "test-two-hop-spoofed-rate", limit: 1, windowMs: 60_000, now: 1 }), null);
  const response = rejectRateLimitedRequest(second, { namespace: "test-two-hop-spoofed-rate", limit: 1, windowMs: 60_000, now: 2 });
  assert.ok(response);
  assert.equal(response.status, 429);
});

test("rate limiter uses single-hop forwarded-for instead of a global fallback bucket", async () => {
  const first = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const second = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.11" },
  });
  const repeatedFirst = new Request("https://hugmeid.example/api/auth/line/session", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  assert.equal(rejectRateLimitedRequest(first, { namespace: "test-single-hop-rate", limit: 1, windowMs: 60_000, now: 1 }), null);
  assert.equal(rejectRateLimitedRequest(second, { namespace: "test-single-hop-rate", limit: 1, windowMs: 60_000, now: 2 }), null);
  const response = rejectRateLimitedRequest(repeatedFirst, { namespace: "test-single-hop-rate", limit: 1, windowMs: 60_000, now: 3 });
  assert.ok(response);
  assert.equal(response.status, 429);
});

test("rate limiter only trusts configured proxy hop counts", async () => {
  const previousTrustedProxyHops = process.env.HUGMEID_TRUSTED_PROXY_HOPS;
  process.env.HUGMEID_TRUSTED_PROXY_HOPS = "1";
  try {
    const first = new Request("https://hugmeid.example/api/auth/line/session", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10, 35.191.0.1" },
    });
    const repeatedFirst = new Request("https://hugmeid.example/api/auth/line/session", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10, 35.191.0.1" },
    });
    const spoofedExtraHop = new Request("https://hugmeid.example/api/auth/line/session", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.99, 203.0.113.10, 35.191.0.1" },
    });

    assert.equal(rejectRateLimitedRequest(first, { namespace: "test-trusted-proxy-rate", limit: 1, windowMs: 60_000, now: 1 }), null);
    const repeatedResponse = rejectRateLimitedRequest(repeatedFirst, { namespace: "test-trusted-proxy-rate", limit: 1, windowMs: 60_000, now: 2 });
    assert.ok(repeatedResponse);
    assert.equal(repeatedResponse.status, 429);
    assert.equal(rejectRateLimitedRequest(spoofedExtraHop, { namespace: "test-trusted-proxy-rate", limit: 1, windowMs: 60_000, now: 3 }), null);
  } finally {
    if (previousTrustedProxyHops === undefined) {
      delete process.env.HUGMEID_TRUSTED_PROXY_HOPS;
    } else {
      process.env.HUGMEID_TRUSTED_PROXY_HOPS = previousTrustedProxyHops;
    }
  }
});

test("all mutating API routes call the cross-site request guard", () => {
  const apiFiles = [
    "app/api/auth/line/session/route.ts",
    "app/api/me/bookmarks/activities/[activityId]/route.ts",
    "app/api/me/bookmarks/contents/[contentId]/route.ts",
    "app/api/me/bookmarks/jobs/[jobId]/route.ts",
    "app/api/me/class-memos/[classId]/route.ts",
    "app/api/me/class-tags/[classId]/route.ts",
    "app/api/me/class-task-statuses/[taskId]/route.ts",
    "app/api/me/profile/route.ts",
    "app/api/me/inquiries/route.ts",
    "app/api/me/timetable/classes/[classId]/route.ts",
    "app/api/me/timetable/route.ts",
    "app/api/syllabus/classes/[classId]/resources/route.ts",
    "app/api/syllabus/classes/[classId]/tasks/route.ts",
  ];
  const routeHelper = readFileSync(join(process.cwd(), "lib/next-json-route.ts"), "utf8");

  for (const file of apiFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(source, /rejectCrossSiteRequest|guardedSessionJsonRoute|guardedSessionJsonBodyRoute/);
  }
  assert.match(routeHelper, /rejectCrossSiteRequest/);
});

test("shared authenticated mutation helper applies user-scoped rate limiting", () => {
  const routeHelper = readFileSync(join(process.cwd(), "lib/next-json-route.ts"), "utf8");
  const profileRoute = readFileSync(join(process.cwd(), "app/api/me/profile/route.ts"), "utf8");
  const sharedRateLimit = readFileSync(join(process.cwd(), "lib/security/shared-rate-limit.ts"), "utf8");
  const cloudSqlBaseline = readFileSync(join(process.cwd(), "cloudsql/baseline/20260730000000_schema.sql"), "utf8");

  assert.match(routeHelper, /authenticated-mutation/);
  assert.match(routeHelper, /identity:\s*`user:\$\{session\.userId\}`/);
  assert.match(routeHelper, /rejectSharedRateLimitedRequest/);
  assert.match(profileRoute, /authenticated-mutation:PUT:\/api\/me\/profile/);
  assert.match(profileRoute, /rejectSharedRateLimitedRequest/);
  assert.match(sharedRateLimit, /rate_limit_buckets/);
  assert.match(sharedRateLimit, /on conflict \(namespace, identity, client_key\)/);
  assert.match(cloudSqlBaseline, /CREATE TABLE public\.rate_limit_buckets/);
});

test("all mutating JSON API routes use the bounded JSON reader", () => {
  const apiFiles = [
    "app/api/auth/line/session/route.ts",
    "app/api/me/inquiries/route.ts",
    "app/api/me/class-memos/[classId]/route.ts",
    "app/api/me/class-tags/[classId]/route.ts",
    "app/api/me/class-task-statuses/[taskId]/route.ts",
    "app/api/me/profile/route.ts",
    "app/api/me/timetable/route.ts",
    "app/api/syllabus/classes/[classId]/resources/route.ts",
    "app/api/syllabus/classes/[classId]/tasks/route.ts",
  ];
  const routeHelper = readFileSync(join(process.cwd(), "lib/next-json-route.ts"), "utf8");

  for (const file of apiFiles) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    assert.match(source, /readJsonRequestBody|guardedSessionJsonBodyRoute/);
    assert.doesNotMatch(source, /request\.json\(/);
  }
  assert.match(routeHelper, /readJsonRequestBody/);
  assert.doesNotMatch(routeHelper, /request\.json\(/);
});

test("inquiry creation requires an active account before inserting", () => {
  const source = readFileSync(join(process.cwd(), "lib/inquiries.ts"), "utf8");
  const activeUserCheck = source.match(/async function sessionHasActiveUser[\s\S]*?\n}/)?.[0] ?? "";
  const createInquiry = source.match(/export async function createInquiryJson[\s\S]*?insert into inquiries/)?.[0] ?? "";

  assert.match(activeUserCheck, /from users/);
  assert.match(activeUserCheck, /deactivated_at is null/);
  assert.match(createInquiry, /sessionHasActiveUser\(session, query\)/);
  assert.ok(
    createInquiry.indexOf("sessionHasActiveUser(session, query)") < createInquiry.indexOf("insert into inquiries"),
    "active account check must run before inquiry insert",
  );
});

test("inquiry creation requires a UUID idempotency key and detects conflicting reuse", () => {
  const source = readFileSync(join(process.cwd(), "lib/inquiries.ts"), "utf8");
  assert.match(source, /UUID_PATTERN\.test\(idempotencyKey\)/);
  assert.match(source, /request_fingerprint/);
  assert.match(source, /on conflict \(user_id, idempotency_key\)/i);
  assert.match(source, /idempotency_key_reused/);
});

test("LINE session creation is rate limited before upstream verification", () => {
  const source = readFileSync(join(process.cwd(), "app/api/auth/line/session/route.ts"), "utf8");

  assert.match(source, /await rejectSharedRateLimitedRequest/);
  assert.match(source, /namespace:\s*"line-session"/);
  assert.match(source, /identity:\s*"anonymous"/);
  assert.ok(source.indexOf("try {") < source.indexOf("await rejectSharedRateLimitedRequest"));
});
