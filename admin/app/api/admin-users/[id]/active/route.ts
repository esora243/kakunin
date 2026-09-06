import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { invalidateAdminIdentityCache } from "@/lib/auth/admin-session";
import { setAdminUserActive, toAdminUserSnapshot } from "@/lib/admin-users";
import { ValidationError } from "@/lib/errors";

function resolveAdminUserIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // .../api/admin-users/[id]/active
  return segments[segments.length - 2];
}

function parseIsActive(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ValidationError("isActive must be a boolean", "invalid_is_active");
  }
  return value;
}

// Owner-only per docs/admin-management-app-spec.md "Owner guardrails":
// last-active-owner and self-action checks live in setAdminUserActive.
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = resolveAdminUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { isActive?: unknown } | null;
  if (!body) throw new ValidationError("A JSON body is required", "invalid_body");
  const isActive = parseIsActive(body.isActive);

  const { before, after } = await dbTransaction(async (client) => {
    const result = await setAdminUserActive(client, id, isActive, identity);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: isActive ? "admin_user.reactivate" : "admin_user.deactivate",
      resourceType: "admin_users",
      resourceId: id,
      beforeSnapshot: toAdminUserSnapshot(result.before),
      afterSnapshot: toAdminUserSnapshot(result.after),
    });

    return result;
  });

  // Take effect on the target's very next request instead of waiting out
  // the up-to-5-minute identity cache TTL.
  invalidateAdminIdentityCache(before.email);
  invalidateAdminIdentityCache(after.email);

  return { adminUser: after };
});
