import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { restoreContentVersion } from "@/lib/contents";
import { ValidationError } from "@/lib/errors";
import { isPubliclyVisible } from "@/lib/publishing";
import { uuidParam } from "@/lib/query-params";

function pathParts(request: Request) {
  const segments = new URL(request.url).pathname.split("/");
  return {
    id: uuidParam(segments[segments.length - 4], "Content id"),
    versionNo: Number(segments[segments.length - 2]),
  };
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const { id, versionNo } = pathParts(request);
  if (!id) throw new ValidationError("Content id must be a valid UUID", "invalid_id");
  if (!Number.isInteger(versionNo) || versionNo < 1) throw new ValidationError("Invalid version number", "invalid_version");
  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId, (client) => restoreContentVersion(client, id, versionNo, identity.adminId),
    (value) => isPubliclyVisible(value.before) || isPubliclyVisible(value.after)
      ? { resourceType: "contents", resourceId: id, tags: ["contents"] } : null,
  );
  return { content: after, cacheWarning: !cacheResult.ok };
});
