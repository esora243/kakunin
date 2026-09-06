import assert from "node:assert/strict";
import test from "node:test";
import {
  apiErrorResult,
  invalidRequestResult,
  notFoundResult,
  publicCacheHeadersForResult,
  unauthorizedResult,
  withRequiredSession,
} from "../lib/api-results";

const session = {
  userId: "user-1",
};

test("API error helpers preserve their public status and error contract", () => {
  assert.deepEqual(apiErrorResult("conflict", "Already exists", 409), {
    body: { ok: false, error: { code: "conflict", message: "Already exists" } },
    status: 409,
  });
  assert.deepEqual(unauthorizedResult(), {
    body: { ok: false, error: { code: "unauthorized", message: "Login is required" } },
    status: 401,
  });
  assert.deepEqual(invalidRequestResult("Invalid input"), {
    body: { ok: false, error: { code: "invalid_request", message: "Invalid input" } },
    status: 400,
  });
  assert.deepEqual(notFoundResult("Missing"), {
    body: { ok: false, error: { code: "not_found", message: "Missing" } },
    status: 404,
  });
});

test("required-session boundary skips handlers when unauthenticated and passes the verified session otherwise", async () => {
  let handlerCalls = 0;
  const handler = async (receivedSession: typeof session) => {
    handlerCalls += 1;
    assert.equal(receivedSession, session);
    return { body: { ok: true as const, userId: receivedSession.userId } };
  };

  assert.deepEqual(await withRequiredSession(async () => null, handler), unauthorizedResult());
  assert.equal(handlerCalls, 0);
  assert.deepEqual(await withRequiredSession(async () => session, handler), {
    body: { ok: true, userId: "user-1" },
  });
  assert.equal(handlerCalls, 1);
});

test("public cache policy caches only successful responses", () => {
  const publicCache = "public, max-age=30, stale-while-revalidate=300";

  for (const result of [
    { body: { ok: true } },
    { body: { ok: true }, status: 200 },
    { body: null, status: 204 },
  ]) {
    assert.deepEqual(publicCacheHeadersForResult(result, publicCache), { "Cache-Control": publicCache });
  }

  for (const status of [301, 400, 404, 500, 503]) {
    assert.deepEqual(
      publicCacheHeadersForResult({ body: { ok: false }, status }, publicCache),
      { "Cache-Control": "no-store" },
    );
  }
});
