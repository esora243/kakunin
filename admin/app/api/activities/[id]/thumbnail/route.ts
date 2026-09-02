import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { isPubliclyVisible } from "@/lib/publishing";
import { requireUuidParam } from "@/lib/query-params";
import { requireExpectedUpdatedAt } from "@/lib/concurrency";
import { updateActivityThumbnail, pickActivityThumbnailPatch } from "@/lib/activities";
import { assertThumbnailUrlSafe } from "@/lib/thumbnails";
import { ValidationError } from "@/lib/errors";

export const PATCH = adminApiRoute("owner", async (identity, request) => {
  const id = requireUuidParam(new URL(request.url).pathname.match(/\/activities\/([^/]+)\/thumbnail/)?.[1] ?? null, "Activity id");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") throw new ValidationError("Request body must be a JSON object", "invalid_body");
  const expectedUpdatedAt = requireExpectedUpdatedAt((body as Record<string, unknown>).expectedUpdatedAt);
  const { thumbnailImageUrl } = pickActivityThumbnailPatch(body as Record<string, unknown>);
  const safeUrl = await assertThumbnailUrlSafe(thumbnailImageUrl);

  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId,
    (client) => updateActivityThumbnail(client, id, safeUrl, identity.adminId, expectedUpdatedAt),
    (value) => isPubliclyVisible(value.after) ? { resourceType: "activities", resourceId: id, tags: ["activities"] } : null,
  );
  return { activity: after, cacheWarning: !cacheResult.ok };
});
