import { adminApiRoute } from "@/lib/api-route";
import { writeAuditLog } from "@/lib/audit";
import { updateEmploymentType } from "@/lib/master-data";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { ValidationError } from "@/lib/errors";
import { singleStringParam } from "@/lib/query-params";

function resolveIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const raw = singleStringParam(segments[segments.length - 1]);
  if (!raw) throw new ValidationError("Employment type id must be a valid string", "invalid_id");
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new ValidationError("Employment type id must be a valid string", "invalid_id");
  }
}

// Rename only, per docs/admin-management-app-spec.md Master Data row for
// `employment_types` ("No create/deactivate at launch"). Renamed labels
// affect the Jobs list/detail pages, so invalidate the "jobs" tag even though
// the spec's cache table doesn't list this row explicitly.
export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = resolveIdFromRequest(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { name?: unknown }).name !== "string") {
    throw new ValidationError("name is required");
  }
  const { name } = body as { name: string };

  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(identity.adminId, async (client) => {
    const result = await updateEmploymentType(client, id, name, identity.adminId);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "master_data.employment_type.update",
      resourceType: "employment_types",
      resourceId: id,
      beforeSnapshot: result.before,
      afterSnapshot: result.after,
    });

    return result;
  }, { resourceType: "employment_types", resourceId: id, tags: ["jobs"] });

  return { employmentType: after, before, cacheWarning: !cacheResult.ok };
});
