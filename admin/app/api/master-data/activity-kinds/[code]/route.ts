import { adminApiRoute } from "@/lib/api-route";
import { writeAuditLog } from "@/lib/audit";
import { updateActivityKind } from "@/lib/master-data";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { ValidationError } from "@/lib/errors";
import { singleStringParam } from "@/lib/query-params";

function resolveCodeFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const raw = singleStringParam(segments[segments.length - 1]);
  if (!raw) throw new ValidationError("Activity kind code must be a valid string", "invalid_id");
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ValidationError("Activity kind code must be a valid string", "invalid_id");
  }
}

// Rename/reorder only, per docs/admin-management-app-spec.md Master Data row
// for `activity_kinds` ("No create/deactivate at launch"). Renamed labels
// affect the Activities list/detail pages, so invalidate the "activities"
// tag even though the spec's cache table doesn't list this row explicitly.
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const code = resolveCodeFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const { name, displayOrder } = body as { name?: unknown; displayOrder?: unknown };

  const patch: { name?: string; displayOrder?: number } = {};
  if (name !== undefined) {
    if (typeof name !== "string") throw new ValidationError("name must be a string");
    patch.name = name;
  }
  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number") throw new ValidationError("displayOrder must be a number");
    patch.displayOrder = displayOrder;
  }

  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(identity.adminId, async (client) => {
    const result = await updateActivityKind(client, code, patch, identity.adminId);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "master_data.activity_kind.update",
      resourceType: "activity_kinds",
      resourceId: code,
      beforeSnapshot: result.before,
      afterSnapshot: result.after,
    });

    return result;
  }, { resourceType: "activity_kinds", resourceId: code, tags: ["activities"] });

  return { activityKind: after, before, cacheWarning: !cacheResult.ok };
});
