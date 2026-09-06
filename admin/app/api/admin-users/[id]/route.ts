import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { invalidateAdminIdentityCache } from "@/lib/auth/admin-session";
import { removeAdminUserFromList, toAdminUserSnapshot } from "@/lib/admin-users";

function resolveAdminUserIdFromRequest(request: Request): string {
  return new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
}

export const DELETE = adminApiRoute("owner", async (identity, request) => {
  const id = resolveAdminUserIdFromRequest(request);
  const removed = await dbTransaction(async (client) => {
    const before = await removeAdminUserFromList(client, id, identity);
    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "admin_user.remove",
      resourceType: "admin_users",
      resourceId: id,
      beforeSnapshot: toAdminUserSnapshot(before),
      afterSnapshot: null,
    });
    return before;
  });

  invalidateAdminIdentityCache(removed.email);
  return { removed: true };
});
