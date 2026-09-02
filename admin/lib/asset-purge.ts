import type { PoolClient } from "pg";
import {
  countContentReferencesToAssetWithClient,
  lockAssetReferenceMutation,
  type AssetRow,
} from "./assets";
import type { AuditLogEntry } from "./audit";
import { ConflictError } from "./errors";
import { logSafeError } from "./safe-log";

type TransactionRunner = <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;

type PurgeDeletedAssetInput = {
  actorAdminId: string;
  asset: AssetRow;
  deleteStoredObjects: (objects: Array<{ bucket: string; objectPath: string }>) => Promise<void>;
  dbTransaction: TransactionRunner;
  writeAuditLog: (client: PoolClient, entry: AuditLogEntry) => Promise<void>;
};

export async function purgeDeletedAsset({
  actorAdminId,
  asset,
  deleteStoredObjects,
  dbTransaction,
  writeAuditLog,
}: PurgeDeletedAssetInput): Promise<{ id: string; purged: true }> {
  const prepared = await dbTransaction(async (client) => {
    await lockAssetReferenceMutation(client);
    const state = await client.query<{
      bucket: string;
      object_path: string;
      deleted_at: string | null;
      purged_at: string | null;
    }>(
      "select bucket, object_path, deleted_at::text, purged_at::text from assets where id = $1 for update",
      [asset.id],
    );
    const current = state.rows[0];
    if (current?.purged_at) return null;
    if (!current?.deleted_at) {
      throw new ConflictError("Asset must be logically deleted before it can be purged", "not_logically_deleted");
    }
    if ((await countContentReferencesToAssetWithClient(client, asset.id)) > 0) {
      throw new ConflictError(
        "Cannot purge: this asset is still referenced by Contents. Remove the references first.",
        "asset_referenced",
      );
    }

    const variants = await client.query<{ bucket: string; object_path: string }>(
      `select bucket, object_path
       from asset_variants
       where asset_id = $1
       order by width, content_type
       for update`,
      [asset.id],
    );
    return {
      parent: { bucket: current.bucket, objectPath: current.object_path },
      objects: [
        ...variants.rows.map((variant) => ({ bucket: variant.bucket, objectPath: variant.object_path })),
        { bucket: current.bucket, objectPath: current.object_path },
      ],
    };
  });

  if (!prepared) return { id: asset.id, purged: true };

  try {
    await deleteStoredObjects(prepared.objects);
  } catch {
    logSafeError({ event: "asset_purge_storage_delete_failed", code: "storage_delete_failed", resourceId: asset.id });
    throw new ConflictError(
      "Asset was left soft-deleted because Cloud Storage deletion failed. Retry purge after fixing storage access.",
      "purge_storage_delete_failed",
    );
  }

  return dbTransaction(async (client) => {
    await lockAssetReferenceMutation(client);
    const state = await client.query<{ deleted_at: string | null; purged_at: string | null }>(
      "select deleted_at::text, purged_at::text from assets where id = $1 for update",
      [asset.id],
    );
    if (state.rows[0]?.purged_at) return { id: asset.id, purged: true as const };
    if (!state.rows[0]?.deleted_at) {
      throw new ConflictError("Asset is no longer logically deleted; purge cannot be finalized", "not_logically_deleted");
    }
    if ((await countContentReferencesToAssetWithClient(client, asset.id)) > 0) {
      throw new ConflictError(
        "Cannot finalize purge: this asset became referenced. Remove the references and retry.",
        "asset_referenced",
      );
    }
    const { rows } = await client.query<{ id: string; purged_at: string | null }>(
      `update assets
       set purged_at = now()
       where id = $1 and deleted_at is not null and purged_at is null
       returning id, purged_at`,
      [asset.id],
    );
    if (!rows[0]) return { id: asset.id, purged: true as const };
    await writeAuditLog(client, {
      actorAdminId,
      action: "asset.purge",
      resourceType: "assets",
      resourceId: asset.id,
      metadata: prepared.parent,
    });
    return { id: asset.id, purged: true as const };
  });
}
