import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { getAssetRowById, softDeleteAsset } from "@/lib/assets";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { uuidParam } from "@/lib/query-params";

async function resolveAssetIdFromRequest(request: Request): Promise<string | undefined> {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return uuidParam(segments[segments.length - 1], "Asset id");
}

// Logical delete only, owner-only per docs/admin-management-app-spec.md
// "Assets" row: "Upload, inspect, owner delete". Blocked while any Content
// still references the asset's public URL.
export const DELETE = adminApiRoute("owner", async (identity, request) => {
  const id = await resolveAssetIdFromRequest(request);
  if (!id) throw new NotFoundError("Asset not found");
  const asset = await getAssetRowById(id);
  if (!asset) throw new NotFoundError("Asset not found");
  if (asset.purgedAt) {
    throw new ConflictError("Asset has already been purged and can no longer be soft-deleted.", "asset_purged");
  }
  if (asset.deletedAt) return { id: asset.id, deletedAt: asset.deletedAt, purgedAt: asset.purgedAt };

  const deleted = await dbTransaction(async (client) => {
    const updated = await softDeleteAsset(client, id, identity.adminId);

    await writeAuditLog(client, {
      actorAdminId: identity.adminId,
      action: "asset.delete",
      resourceType: "assets",
      resourceId: id,
      beforeSnapshot: asset,
      afterSnapshot: updated,
    });

    return updated;
  });

  return { id: deleted.id, deletedAt: deleted.deletedAt, purgedAt: deleted.purgedAt };
});
