import { adminApiRoute } from "@/lib/api-route";
import { retryCacheInvalidation } from "@/lib/cache-invalidate";
import { ValidationError } from "@/lib/errors";
import { requireUuidParam } from "@/lib/query-params";

// Owner-only per docs/admin-management-app-spec.md "Cache Boundary": retry
// jobs for failed invalidation must be visible to owners; the launch scope does not
// need a full queue UI for editors, so this endpoint is owner-only too.
export const POST = adminApiRoute("owner", async (_identity, request) => {
  const body = (await request.json().catch(() => null)) as { jobId?: unknown } | null;
  if (typeof body?.jobId !== "string") throw new ValidationError("jobId is required");
  const jobId = requireUuidParam(body.jobId, "Cache invalidation job id");
  const result = await retryCacheInvalidation(jobId);
  return { ok: result.ok };
});
