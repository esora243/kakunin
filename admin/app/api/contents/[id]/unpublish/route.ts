import { adminApiRoute } from "@/lib/api-route";
import { getContentRowById, setPublishedAt } from "@/lib/contents";
import { NotFoundError } from "@/lib/errors";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { requireUuidParam } from "@/lib/query-params";

function contentIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/");
  return requireUuidParam(segments[segments.length - 2], "Content id");
}

export const POST = adminApiRoute("any", async (identity, request) => {
  const id = contentIdFromRequest(request);
  const current = await getContentRowById(id);
  if (!current) throw new NotFoundError("Content not found");

  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => setPublishedAt(client, id, null, identity.adminId),
    { resourceType: "contents", resourceId: id, tags: ["contents"] },
  );
  return { content: after, cacheWarning: !cacheResult.ok };
});
