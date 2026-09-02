import { adminApiRoute } from "@/lib/api-route";
import { setActivityPublishState } from "@/lib/activities";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { requireUuidParam } from "@/lib/query-params";
import { parseScheduledAt } from "@/lib/publishing";
import { readOptionalJsonObject } from "@/lib/optional-json-object";

function idFromUrl(request: Request): string {
  const id: string = requireUuidParam(new URL(request.url).pathname.split("/").at(-2), "Activity id");
  return id;
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = idFromUrl(request);
  const body = await readOptionalJsonObject(request);
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => setActivityPublishState(client, id, "publish", identity.adminId, scheduledAt),
    { resourceType: "activities", resourceId: id, tags: ["activities"] },
  );
  return { activity: after, cacheWarning: !cacheResult.ok };
});
