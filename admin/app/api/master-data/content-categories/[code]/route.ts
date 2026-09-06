import { adminApiRoute } from "@/lib/api-route";
import { writeAuditLog } from "@/lib/audit";
import { updateContentCategory } from "@/lib/master-data";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { ValidationError } from "@/lib/errors";
import { singleStringParam } from "@/lib/query-params";

function resolveCodeFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const raw = singleStringParam(segments[segments.length - 1]);
  if (!raw) throw new ValidationError("Content category code must be a valid string", "invalid_id");
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ValidationError("Content category code must be a valid string", "invalid_id");
  }
}

// Rename/reorder/deactivate a content category. Renaming/deactivating a
// category changes public labels and filtering on the Contents list per the
// spec's cache table row "Master data category update" -> invalidate the
// "contents" tag. Deactivation is blocked in the lib layer while active
// Contents still reference the category.
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const code = resolveCodeFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const { name, displayOrder, isActive } = body as {
    name?: unknown;
    displayOrder?: unknown;
    isActive?: unknown;
  };

  const patch: { name?: string; displayOrder?: number; isActive?: boolean } = {};
  if (name !== undefined) {
    if (typeof name !== "string") throw new ValidationError("name must be a string");
    patch.name = name;
  }
  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number") throw new ValidationError("displayOrder must be a number");
    patch.displayOrder = displayOrder;
  }
  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") throw new ValidationError("isActive must be a boolean");
    patch.isActive = isActive;
  }

  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(identity.adminId, async (client) => {
    const result = await updateContentCategory(client, code, patch, identity.adminId);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "master_data.content_category.update",
      resourceType: "content_categories",
      resourceId: code,
      beforeSnapshot: result.before,
      afterSnapshot: result.after,
    });

    return result;
  }, { resourceType: "content_categories", resourceId: code, tags: ["contents"] });

  return { category: after, before, cacheWarning: !cacheResult.ok };
});
