import assert from "node:assert/strict";
import test from "node:test";
import { adminApiRoute } from "../lib/api-route";

test("unauthenticated admin API access is rejected with 403 by the route wrapper", async () => {
  const route = adminApiRoute("owner", async () => {
    throw new Error("handler should not run without a verified admin identity");
  });

  const response = await route(new Request("https://hugmeid.example/admin/app/api/admin-users"));

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: {
      code: "unauthenticated",
      message: "No verified admin identity",
    },
  });
});

test("admin API fails with 503 before mutation when non-local runtime config is incomplete", async () => {
  let handled = false;
  const route = adminApiRoute(
    "any",
    async () => { handled = true; return { ok: true }; },
    { assertRuntimeConfig: () => { throw new Error("missing runtime config"); } },
  );
  const response = await route(new Request("https://admin.example.test/api/school", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.equal(handled, false);
  assert.deepEqual(await response.json(), {
    error: { code: "service_unavailable", message: "Admin service is temporarily unavailable" },
  });
});
