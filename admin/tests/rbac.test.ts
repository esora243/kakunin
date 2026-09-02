import assert from "node:assert/strict";
import test from "node:test";
import { assertNotActingOnSelf, assertOwner, isOwner } from "../lib/rbac";
import { ForbiddenError } from "../lib/errors";
import type { AdminIdentity } from "../lib/auth/types";

function identity(overrides: Partial<AdminIdentity> = {}): AdminIdentity {
  return { adminId: "admin-1", email: "owner@example.com", role: "owner", isActive: true, ...overrides };
}

test("isOwner/assertOwner distinguish owner from editor", () => {
  assert.equal(isOwner(identity({ role: "owner" })), true);
  assert.equal(isOwner(identity({ role: "editor" })), false);
  assert.doesNotThrow(() => assertOwner(identity({ role: "owner" })));
  assert.throws(() => assertOwner(identity({ role: "editor" })), ForbiddenError);
});

test("assertNotActingOnSelf blocks an owner from targeting their own admin_users row", () => {
  const me = identity({ adminId: "admin-1" });
  assert.throws(() => assertNotActingOnSelf(me, "admin-1", "cannot act on self"), ForbiddenError);
  assert.doesNotThrow(() => assertNotActingOnSelf(me, "admin-2", "cannot act on self"));
});
