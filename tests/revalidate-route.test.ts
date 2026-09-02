import assert from "node:assert/strict";
import test from "node:test";
import { handleCacheRevalidation } from "../lib/cache-revalidation-request";

test("public revalidation distinguishes missing server configuration from invalid credentials", async () => {
  const request = () => new Request("https://app.example.test/api/admin/revalidate", {
    method: "POST",
    headers: { "x-admin-revalidate-secret": "wrong-secret" },
  });
  const unavailable = await handleCacheRevalidation(request(), undefined, () => undefined);
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error.code, "service_unavailable");

  const unauthorized = await handleCacheRevalidation(request(), "expected-secret", () => undefined);
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error.code, "unauthorized");
});
