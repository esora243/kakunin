import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { setJobPublishState } from "@/lib/jobs";
import { requireUuidParam } from "@/lib/query-params";

function idFromUrl(request: Request): string {
  const id: string = requireUuidParam(new URL(request.url).pathname.split("/").at(-2), "Job id");
  return id;
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = idFromUrl(request);
  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => setJobPublishState(client, id, "deactivate", identity.adminId),
    { resourceType: "jobs", resourceId: id, tags: ["jobs"] },
  );
  return { job: after, cacheWarning: !cacheResult.ok };
});
