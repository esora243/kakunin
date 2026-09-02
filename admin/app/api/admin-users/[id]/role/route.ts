import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { invalidateAdminIdentityCache } from "@/lib/auth/admin-session";
import { toAdminUserSnapshot, updateAdminUserRole } from "@/lib/admin-users";
import { ValidationError } from "@/lib/errors";
import type { AdminRole } from "@/lib/auth/types";

function resolveAdminUserIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // .../api/admin-users/[id]/role
  return segments[segments.length - 2];
}

function parseRole(value: unknown): AdminRole {
  if (value === "owner" || value === "editor") return value;
  throw new ValidationError('role must be "owner" or "editor"', "invalid_role");
}

// Owner-only per docs/admin-management-app-spec.md "Owner guardrails":
// last-active-owner and self-demotion checks live in updateAdminUserRole.
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = resolveAdminUserIdFromRequest(request);
  const body = (await request.json().catch(() => null)) as { role?: unknown } | null;
  if (!body) throw new ValidationError("A JSON body is required", "invalid_body");
  const role = parseRole(body.role);

  const { before, after } = await dbTransaction(async (client) => {
    const result = await updateAdminUserRole(client, id, role, identity);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "admin_user.role_update",
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
