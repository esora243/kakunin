import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { createContentCategory, listContentCategories } from "@/lib/master-data";
import { ValidationError } from "@/lib/errors";

// Master Data > content_categories, owner-only per docs/admin-management-app-spec.md
// "Roles And Permissions" (Master Data is an owner-only surface end to end).
export const GET = adminApiRoute("owner", async () => {
  return { categories: await listContentCategories() };
});

// New categories are not referenced by any Content yet, so creation never
// affects public output — no cache invalidation needed here.
export const POST = adminApiRoute("owner", async (identity, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const { code, name, displayOrder } = body as { code?: unknown; name?: unknown; displayOrder?: unknown };
  if (typeof code !== "string" || typeof name !== "string") {
    throw new ValidationError("code and name are required strings");
  }

  const category = await dbTransaction(async (client) => {
    const created = await createContentCategory(
      client,
      { code, name, displayOrder: typeof displayOrder === "number" ? displayOrder : undefined },
      identity.adminId,
    );

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "master_data.content_category.create",
      resourceType: "content_categories",
      resourceId: created.code,
      beforeSnapshot: null,
      afterSnapshot: created,
    });

    return created;
  });

  return { category, cacheWarning: false };
});
