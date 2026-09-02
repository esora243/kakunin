import { adminApiRoute } from "@/lib/api-route";
import { assertContentSlugChangeAllowed } from "@/lib/content-workflow";
import { getContentRowById, pickContentInputFields, updateContent } from "@/lib/contents";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { isPubliclyVisible } from "@/lib/publishing";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { requireUuidParam } from "@/lib/query-params";
import { requireExpectedUpdatedAt } from "@/lib/concurrency";
import { assertManagedPublicAssetReadable } from "@/lib/gcs";
import { assertThumbnailUrlSafe } from "@/lib/thumbnails";

export const GET = adminApiRoute("any", async (_identity, request) => {
  const id = requireUuidParam(new URL(request.url).pathname.split("/").pop(), "Content id");
  const row = await getContentRowById(id);
  if (!row) throw new NotFoundError("Content not found");
  return { content: row };
});

export const PATCH = adminApiRoute("any", async (identity, request) => {
  const id = requireUuidParam(new URL(request.url).pathname.split("/").pop(), "Content id");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const patch = pickContentInputFields(body);
  const expectedUpdatedAt = requireExpectedUpdatedAt((body as Record<string, unknown>).expectedUpdatedAt);
  const current = await getContentRowById(id);
  if (!current) throw new NotFoundError("Content not found");
  const replacingPublishedHero = isPubliclyVisible(current)
    && typeof patch.heroImageUrl === "string"
    && patch.heroImageUrl !== current.hero_image_url;
  if (replacingPublishedHero) await assertManagedPublicAssetReadable(patch.heroImageUrl ?? null);

  const replacingPublishedThumbnail = isPubliclyVisible(current)
    && "thumbnailImageUrl" in patch
    && patch.thumbnailImageUrl !== current.thumbnail_image_url;
  if (replacingPublishedThumbnail) {
    await assertThumbnailUrlSafe(patch.thumbnailImageUrl ?? null);
  } else if (patch.thumbnailImageUrl === null && current.thumbnail_image_url) {
    // Clearing a thumbnail never needs a probe.
  } else if (typeof patch.thumbnailImageUrl === "string") {
    validateThumbnailSyntax(patch.thumbnailImageUrl);
  }

  const { value: { before, after }, cacheResult } = await mutateWithPublicCacheInvalidation(
    identity.adminId,
    (client) =>
    updateContent(client, id, patch, identity.adminId, {
      expectedUpdatedAt,
      assertBeforeUpdate: (current) => {
        const slugChanging = typeof patch.slug === "string" && patch.slug.trim() !== current.slug;
        if (slugChanging) {
          assertContentSlugChangeAllowed(identity, current, (body as Record<string, unknown>).confirmSlugChange);
        }
      },
    }),
    (value) => isPubliclyVisible(value.before) || isPubliclyVisible(value.after)
      ? { resourceType: "contents", resourceId: id, tags: ["contents"] } : null,
  );

  return {
    content: after,
    cacheWarning: !cacheResult.ok,
    approvalReset: before.approval_status !== "draft" && after.approval_status === "draft",
    scheduleCancelled: before.published_at !== null && after.published_at === null,
  };
});

function validateThumbnailSyntax(url: string): void {
  // Minimal syntax guard for the inline edit; the dedicated thumbnail
  // endpoint performs the full managed-URL probe below.
  if (!/^https:\/\//i.test(url)) {
    throw new ValidationError("thumbnailImageUrl must be an https URL", "thumbnail_url_invalid");
  }
}
