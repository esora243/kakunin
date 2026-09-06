import { adminApiRoute } from "@/lib/api-route";
import { getContentRowById, setActive } from "@/lib/contents";
import { NotFoundError } from "@/lib/errors";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { requireUuidParam } from "@/lib/query-params";

// Owner-only: the spec's Editor allowed list only names publish/unpublish for
// Contents, while Owner's list explicitly includes deactivate.
function contentIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/");
  return requireUuidParam(segments[segments.length - 2], "Content id");
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = contentIdFromRequest(request);
  const current = await getContentRowById(id);
  if (!current) throw new NotFoundError("Content not found");

  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => setActive(client, id, false, identity.adminId),
    { resourceType: "contents", resourceId: id, tags: ["contents"] },
  );
  return { content: after, cacheWarning: !cacheResult.ok };
});
