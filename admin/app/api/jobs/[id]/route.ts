import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { pickJobInputFields, updateJob } from "@/lib/jobs";
import { ValidationError } from "@/lib/errors";
import { isPubliclyVisible } from "@/lib/publishing";
import { requireUuidParam } from "@/lib/query-params";
import { requireExpectedUpdatedAt } from "@/lib/concurrency";

function idFromUrl(request: Request): string {
  return requireUuidParam(new URL(request.url).pathname.split("/").at(-1), "Job id");
}

export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = idFromUrl(request);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const expectedUpdatedAt = requireExpectedUpdatedAt((body as Record<string, unknown>).expectedUpdatedAt);
  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId,
    (client) => updateJob(client, id, pickJobInputFields(body as Record<string, unknown>), identity.adminId, expectedUpdatedAt),
    (value) => isPubliclyVisible(value.before) || isPubliclyVisible(value.after)
      ? { resourceType: "jobs", resourceId: id, tags: ["jobs"] } : null,
  );
  return { job: after, cacheWarning: !cacheResult.ok };
});
