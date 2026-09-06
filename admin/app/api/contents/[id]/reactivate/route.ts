import { adminApiRoute } from "@/lib/api-route";
import { mutateWithPublicCacheInvalidation } from "@/lib/cache-invalidate";
import { reactivateContent } from "@/lib/content-workflow";
import { getContentRowById, setActive } from "@/lib/contents";
import { requireUuidParam } from "@/lib/query-params";
import { assertManagedPublicAssetReadable } from "@/lib/gcs";
import { ConflictError } from "@/lib/errors";

function contentIdFromRequest(request: Request): string {
  const segments = new URL(request.url).pathname.split("/");
  return requireUuidParam(segments[segments.length - 2], "Content id");
}

export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = contentIdFromRequest(request);
  return reactivateContent(identity, id, {
    getContentRowById,
    assertBeforeReactivate: async (current) => {
      if (current.published_at) {
        await assertManagedPublicAssetReadable(current.hero_image_url);
      }
    },
    setActiveWithInvalidation: async (contentId, actorAdminId, current) => {
      const result = await mutateWithPublicCacheInvalidation(
        actorAdminId,
        (client) => setActive(client, contentId, true, actorAdminId, {
          expectedUpdatedAt: current.updated_at,
          assertBeforeActivation: (lockedBefore) => {
            if (lockedBefore.hero_image_url !== current.hero_image_url) {
              throw new ConflictError("Content hero image changed during reactivation", "stale_write");
            }
          },
        }),
        { resourceType: "contents", resourceId: contentId, tags: ["contents"] },
      );
      return { after: result.value.after, cacheResult: result.cacheResult };
    },
  });
});
