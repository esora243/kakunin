import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { insertAssetRow, insertAssetVariants, type AssetRow } from "@/lib/assets";
import { deleteStoredObjects, probePublicUrl, uploadPublicContentImage } from "@/lib/gcs";
import { readImageUpload } from "@/lib/upload-request";
import { enforceSharedRateLimit } from "@/lib/security/rate-limit";
import { acquireUploadPermit } from "@/lib/security/upload-semaphore";
import { logSafeError } from "@/lib/safe-log";

export const runtime = "nodejs";

// Both owners and editors may upload (editors upload for Contents; only
// owners delete), per docs/admin-management-app-spec.md "Permissions".
export const POST = adminApiRoute("any", async (identity, request) => {
  await enforceSharedRateLimit(request, { namespace: "admin-asset-upload", identity: identity.adminId, limit: 10, windowMs: 60_000 });
  const release = acquireUploadPermit();
  try {
    const uploaded = await uploadPublicContentImage(await readImageUpload(request));

    let asset: AssetRow;
    try {
      asset = await dbTransaction(async (client) => {
        const inserted = await insertAssetRow(client, {
          bucket: uploaded.source.bucket,
          objectPath: uploaded.source.objectPath,
          publicUrl: uploaded.source.publicUrl,
          contentType: uploaded.source.contentType,
          byteSize: uploaded.source.byteSize,
          checksum: uploaded.source.checksum,
          uploadedByAdminId: identity.adminId,
        });
        const variants = await insertAssetVariants(client, inserted.id, uploaded.variants);
        const completeAsset = { ...inserted, variants };

        await writeAuditLog(client, {
          actorAdminId: identity.adminId,
          action: "asset.upload",
          resourceType: "assets",
          resourceId: inserted.id,
          afterSnapshot: completeAsset,
        });

        return completeAsset;
      });
    } catch (error) {
      await deleteStoredObjects([uploaded.source, ...uploaded.variants]).catch(() => {
        logSafeError({
          event: "asset_upload_cleanup_failed",
          code: "storage_cleanup_failed",
          resourceId: `${uploaded.source.bucket}/${uploaded.source.objectPath}`,
        });
      });
      throw error;
    }

    // A delivery probe failure must not fail the draft-safe upload itself. All
    // resource-intensive upload work is complete, so do not hold capacity
    // while probing the public endpoint.
    release();
    const probe = await probePublicUrl(uploaded.delivery.publicUrl);

    return {
      id: asset.id,
      publicUrl: uploaded.delivery.publicUrl,
      contentType: uploaded.delivery.contentType,
      byteSize: uploaded.delivery.byteSize,
      variants: asset.variants.map((variant) => ({
        publicUrl: variant.publicUrl,
        contentType: variant.contentType,
        width: variant.width,
        height: variant.height,
      })),
      ...(probe.status === "readable" ? {} : {
        warning: {
          reason: "public_url_unreadable",
          status: probe.status,
          ...(probe.status === "http_error" ? { httpStatus: probe.httpStatus } : {}),
        },
      }),
    };
  } finally {
    release();
  }
});
