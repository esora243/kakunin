import assert from "node:assert/strict";
import test from "node:test";
import { adminApiRoute } from "../lib/api-route";
import { OPEN_ACCESS_ADMIN_ID, OPEN_ACCESS_EMAIL } from "../lib/auth/open-access";

test("admin API access is open: the built-in open-access identity reaches the handler without any login", async () => {
  const route = adminApiRoute("owner", async (identity) => ({ ok: true, identity }));

  const response = await route(new Request("https://hugmeid.example/admin/app/api/admin-users"));

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; identity: { adminId: string; email: string; role: string } };
  assert.equal(body.ok, true);
  assert.deepEqual(body.identity, {
    adminId: OPEN_ACCESS_ADMIN_ID,
    email: OPEN_ACCESS_EMAIL,
    role: "owner",
    isActive: true,
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
