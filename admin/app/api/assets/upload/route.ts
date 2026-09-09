import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { insertAssetRow, insertAssetVariants, type AssetRow } from "@/lib/assets";
import { deleteStoredObjects, probePublicUrl, uploadPublicContentImage } from "@/lib/gcs";
import { readImageUpload } from "@/lib/upload-request";
import { enforceSharedRateLimit } from "@/lib/security/rate-limit";
import { acquireUploadPermit } from "@/lib/security/upload-semaphore";
import { logSafeError } from "@/lib/safe-log";
import { HttpError } from "@/lib/errors";

export const runtime = "nodejs";

const EXTENSION_TO_CONTENT_TYPE: Record<string, "image/jpeg" | "image/png" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function normalizeClientMimeType(raw: string | null | undefined): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!raw) return null;
  const lowered = raw.trim().toLowerCase().split(";")[0]?.trim();
  if (!lowered) return null;
  if (lowered === "image/jpg") return "image/jpeg";
  if (lowered === "image/jpeg" || lowered === "image/png" || lowered === "image/webp") return lowered;
  return null;
}

function inferContentTypeFromFilename(name: string | null | undefined): "image/jpeg" | "image/png" | "image/webp" | null {
  if (!name) return null;
  const ext = name.toLowerCase().split("?")[0]?.split("#")[0]?.split(".").pop();
  if (!ext) return null;
  return EXTENSION_TO_CONTENT_TYPE[ext] ?? null;
}

/**
 * Image upload route — 記事 (Contents) / 求人 (Jobs) / 課外活動 (Activities) の
 * サムネイル・ヒーロー画像フィールドはすべてこのエンドポイントを共有する。
 * MIME と拡張子はブラウザが送ったヘッダー・クエリのどれからでも正規化するため、
 * ブラウザが予期しない Content-Type (multipart/form-data など) を生成しても
 * 415 やサイレントな 500 にはならない。
 *
 * Both owners and editors may upload (editors upload for Contents; only
 * owners delete), per docs/admin-management-app-spec.md "Permissions".
 */
export const POST = adminApiRoute("any", async (identity, request) => {
  await enforceSharedRateLimit(request, { namespace: "admin-asset-upload", identity: identity.adminId, limit: 10, windowMs: 60_000 });
  const release = acquireUploadPermit();
  try {
    const requestUrl = new URL(request.url);
    const target = requestUrl.searchParams.get("target");
    // バグ修正: "jobs" ターゲットが未対応だったため、求人フォームからの
    // サムネイルアップロードが 400 で失敗していた。記事・求人・課外活動の
    // すべてで同じアップロード経路を許可する。
    if (target && target !== "contents" && target !== "activities" && target !== "jobs") {
      throw new HttpError("Unsupported upload target", 400, "invalid_upload_target");
    }

    // バグ修正: ブラウザの FormData 送信は Content-Type が
    // "multipart/form-data; boundary=..." になるため、従来の判定では必ず 415 に
    // なりサムネイル・記事上部画像を追加できなかった。multipart の場合は実際の
    // ファイル種別は後段の sharp デコードで検証するため、ここでは受理する。
    const rawContentType = request.headers.get("content-type");
    const isMultipart = rawContentType?.toLowerCase().startsWith("multipart/form-data") ?? false;
    const clientHint = normalizeClientMimeType(rawContentType) ??
      normalizeClientMimeType(requestUrl.searchParams.get("contentType")) ??
      inferContentTypeFromFilename(requestUrl.searchParams.get("filename"));
    if (!isMultipart && clientHint === null) {
      throw new HttpError("Unsupported image type. Use JPEG, PNG, or WebP.", 415, "unsupported_media_type");
    }

    let uploaded;
    try {
      uploaded = await uploadPublicContentImage(await readImageUpload(request));
    } catch (error) {
      logSafeError({
        event: "asset_upload_failed",
        code: (error as { code?: string })?.code ?? "upload_failed",
        resourceId: `${identity.adminId}/${Date.now()}`,
      });
      throw error;
    }

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
      target: target ?? "contents",
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
