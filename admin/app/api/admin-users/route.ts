import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { createAdminUser, listAdminUserRows, normalizeAdminEmail, toAdminUserSnapshot } from "@/lib/admin-users";
import { ValidationError } from "@/lib/errors";
import type { AdminRole } from "@/lib/auth/types";

// Owner-only per docs/admin-management-app-spec.md "Owner": "Manage admin users."
export const GET = adminApiRoute("owner", async () => {
  const adminUsers = await listAdminUserRows();
  return { adminUsers };
});

function parseRole(value: unknown): AdminRole {
  if (value === "owner" || value === "editor") return value;
  throw new ValidationError('role must be "owner" or "editor"', "invalid_role");
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const body = (await request.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  if (!body) throw new ValidationError("A JSON body is required", "invalid_body");

  const email = normalizeAdminEmail(body.email);
  const role = parseRole(body.role);

  const created = await dbTransaction(async (client) => {
    const inserted = await createAdminUser(client, { email, role }, identity.adminId);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "admin_user.create",
      resourceType: "admin_users",
      resourceId: inserted.id,
      afterSnapshot: toAdminUserSnapshot(inserted),
    });

    return inserted;
  });

  return { adminUser: created };
});
