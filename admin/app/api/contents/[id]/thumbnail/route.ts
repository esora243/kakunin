import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { updateContentThumbnail } from "@/lib/contents";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { isPubliclyVisible } from "@/lib/publishing";
import { requireUuidParam } from "@/lib/query-params";
import { requireExpectedUpdatedAt } from "@/lib/concurrency";
import { assertThumbnailUrlSafe } from "@/lib/thumbnails";
import { ValidationError } from "@/lib/errors";

export const PATCH = adminApiRoute("any", async (identity, request) => {
  const id = requireUuidParam(new URL(request.url).pathname.match(/\/contents\/([^/]+)\/thumbnail/)?.[1] ?? null, "Content id");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const expectedUpdatedAt = requireExpectedUpdatedAt((body as Record<string, unknown>).expectedUpdatedAt);
  const rawUrl = (body as { thumbnailImageUrl?: unknown }).thumbnailImageUrl;
  const thumbnailImageUrl = rawUrl === null || rawUrl === "" || rawUrl === undefined
    ? null
    : String(rawUrl);
  const safeUrl = await assertThumbnailUrlSafe(thumbnailImageUrl);

  const { value: { after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId,
    (client) => updateContentThumbnail(client, id, safeUrl, identity.adminId, { expectedUpdatedAt }),
    (value) => isPubliclyVisible(value.after) ? { resourceType: "contents", resourceId: id, tags: ["contents"] } : null,
  );

  return { content: after, cacheWarning: !cacheResult.ok };
});
