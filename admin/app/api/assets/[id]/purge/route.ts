import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { getAssetRowById } from "@/lib/assets";
import { purgeDeletedAsset } from "@/lib/asset-purge";
import { deleteStoredObjects } from "@/lib/gcs";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { uuidParam } from "@/lib/query-params";

function resolveAssetIdFromRequest(request: Request): string | undefined {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  // .../api/assets/[id]/purge
  return uuidParam(segments[segments.length - 2], "Asset id");
}

// Owner-only physical deletion maintenance operation. Requires the asset to
// already be logically deleted; the assets table itself is never physically
// deleted from (hugmeid_admin_runtime has no delete grant on assets). Cloud Storage
// deletion happens first; the audit row is only written after it succeeds so
// the log never claims the object was purged when it still exists.
export const POST = adminApiRoute("owner", async (identity, request) => {
  const id = resolveAssetIdFromRequest(request);
  if (!id) throw new NotFoundError("Asset not found");
  const asset = await getAssetRowById(id);
  if (!asset) throw new NotFoundError("Asset not found");
  if (asset.purgedAt) {
    return { id: asset.id, purged: true };
  }
  if (!asset.deletedAt) {
    throw new ValidationError("Asset must be logically deleted before it can be purged", "not_logically_deleted");
  }
  return purgeDeletedAsset({
    actorAdminId: identity.adminId,
    asset,
    deleteStoredObjects,
    dbTransaction,
    writeAuditLog,
  });
});
