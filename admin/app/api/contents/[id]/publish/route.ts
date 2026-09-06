import { adminApiRoute } from "@/lib/api-route";
import { assertPublishable, getContentRowById, setPublishedAt } from "@/lib/contents";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { requireUuidParam } from "@/lib/query-params";
import { parseScheduledAt } from "@/lib/publishing";
import { readOptionalJsonObject } from "@/lib/optional-json-object";
import { assertManagedPublicAssetReadable } from "@/lib/gcs";
import { ConflictError, NotFoundError } from "@/lib/errors";

function contentIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/");
  return requireUuidParam(segments[segments.length - 2], "Content id");
}

export const POST = adminApiRoute("any", async (identity, request) => {
  const id = contentIdFromRequest(request);
  const body = await readOptionalJsonObject(request);
  const scheduledAt = parseScheduledAt(body.scheduledAt);
  const current = await getContentRowById(id);
  if (!current) throw new NotFoundError("Content not found");
  assertPublishable(current);
  await assertManagedPublicAssetReadable(current.hero_image_url);

  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId,
    (client) => setPublishedAt(client, id, scheduledAt, identity.adminId, {
      expectedUpdatedAt: current.updated_at,
      assertBeforePublish: (lockedBefore) => {
        assertPublishable(lockedBefore);
        if (lockedBefore.hero_image_url !== current.hero_image_url) {
          throw new ConflictError("Content hero image changed during publish", "stale_write");
        }
      },
    }),
    { resourceType: "contents", resourceId: id, tags: ["contents"] },
  );
  return { content: after, cacheWarning: !cacheResult.ok, alreadyPublished: before.published_at != null };
});
