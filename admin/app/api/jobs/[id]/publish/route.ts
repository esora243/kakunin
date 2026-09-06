import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { setJobPublishState } from "@/lib/jobs";
import { requireUuidParam } from "@/lib/query-params";
import { parseScheduledAt } from "@/lib/publishing";
import { readOptionalJsonObject } from "@/lib/optional-json-object";

function idFromUrl(request: Request): string {
  const id: string = requireUuidParam(new URL(request.url).pathname.split("/").at(-2), "Job id");
  return id;
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = idFromUrl(request);
  const body = await readOptionalJsonObject(request);
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => setJobPublishState(client, id, "publish", identity.adminId, scheduledAt),
    { resourceType: "jobs", resourceId: id, tags: ["jobs"] },
  );
  return { job: after, cacheWarning: !cacheResult.ok };
});
