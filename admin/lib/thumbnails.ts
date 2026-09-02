import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "@/lib/db/postgres";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { assertManagedPublicAssetReadable } from "@/lib/gcs";
import { isManagedPublicAssetUrl } from "@/lib/asset-public-url";

export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_THUMBNAIL_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedThumbnailContentType = (typeof ACCEPTED_THUMBNAIL_CONTENT_TYPES)[number];

export type ThumbnailUploadResult = {
  assetId: string;
  publicUrl: string;
  variants: Array<{ publicUrl: string; contentType: string; width: number; height: number }>;
  warning?: { reason: string; status?: string; httpStatus?: number };
};

export type ThumbnailValidationOptions = {
  field: "thumbnail" | "hero";
};

export async function assertThumbnailUrlSafe(
  url: string | null | undefined,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<string | null> {
  if (url === null || url === undefined || url === "") return null;
  if (typeof url !== "string") {
    throw new ValidationError("Thumbnail URL must be a string", "thumbnail_url_invalid");
  }
  if (!isManagedPublicAssetUrl(url, options)) {
    throw new ValidationError(
      "Thumbnail must reference a managed public asset uploaded via /admin/api/assets/upload",
      "thumbnail_url_unmanaged",
    );
  }
  await assertManagedPublicAssetReadable(url);
  return url;
}

export async function updateContentThumbnail(
  client: PoolClient,
  contentId: string,
  thumbnailUrl: string | null,
): Promise<{ id: string; thumbnailImageUrl: string | null }> {
  const { rows } = await client.query<{ id: string; thumbnail_image_url: string | null }>(
    `update contents
       set thumbnail_image_url = $2,
           updated_at = now()
     where id = $1
     returning id::text, thumbnail_image_url`,
    [contentId, thumbnailUrl],
  );
  if (!rows[0]) throw new NotFoundError("Content not found");
  return { id: rows[0].id, thumbnailImageUrl: rows[0].thumbnail_image_url };
}

export async function fetchContentThumbnailUrl(contentId: string): Promise<string | null> {
  const { rows } = await dbQuery<{ thumbnail_image_url: string | null }>(
    `select thumbnail_image_url from contents where id = $1 limit 1`,
    [contentId],
  );
  return rows[0]?.thumbnail_image_url ?? null;
}

export async function updateActivityThumbnail(
  client: PoolClient,
  activityId: string,
  thumbnailUrl: string | null,
): Promise<{ id: string; thumbnailImageUrl: string | null }> {
  const { rows } = await client.query<{ id: string; thumbnail_image_url: string | null }>(
    `update activities
       set thumbnail_image_url = $2,
           synced_at = now()
     where id = $1
     returning id::text, thumbnail_image_url`,
    [activityId, thumbnailUrl],
  );
  if (!rows[0]) throw new NotFoundError("Activity not found");
  return { id: rows[0].id, thumbnailImageUrl: rows[0].thumbnail_image_url };
}

export async function countContentsReferencingThumbnail(
  client: PoolClient,
  url: string,
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count from contents where thumbnail_image_url = $1`,
    [url],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countActivitiesReferencingThumbnail(
  client: PoolClient,
  url: string,
): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `select count(*)::text as count from activities where thumbnail_image_url = $1`,
    [url],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function assertNoThumbnailReference(
  client: PoolClient,
  asset: { publicUrl: string; sourcePublicUrl: string },
): Promise<void> {
  const contentsRef = await countContentsReferencingThumbnail(client, asset.publicUrl);
  const activitiesRef = await countActivitiesReferencingThumbnail(client, asset.publicUrl);
  if (contentsRef + activitiesRef > 0) {
    throw new ConflictError(
      "Cannot delete: this asset is the thumbnail of an existing Content or Activity",
      "thumbnail_referenced",
    );
  }
  void asset.sourcePublicUrl;
}
