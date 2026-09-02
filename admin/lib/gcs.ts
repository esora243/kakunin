import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { isManagedPublicAssetUrl, publicAssetUrlFor, requiredEnv } from "./asset-public-url";
import { HttpError, ValidationError } from "./errors";
import { logSafeError } from "./safe-log";

// Image upload per docs/admin-management-app-spec.md "Image Upload":
// server-generated non-guessable object paths that are never overwritten,
// content-sniffed/decoded validation (not trusted browser MIME type), and
// metadata stripped by re-encoding before public delivery.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const RESPONSIVE_IMAGE_WIDTHS = [320, 640, 1280] as const;
const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;
const STORAGE_DELETE_TIMEOUT_MS = 10_000;
export const PUBLIC_URL_PROBE_TIMEOUT_MS = 5_000;

const FORMAT_TO_CONTENT_TYPE: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadedImage = {
  source: StoredImageObject;
  variants: UploadedImageVariant[];
  delivery: UploadedImageVariant;
};

export type StoredImageObject = {
  bucket: string;
  objectPath: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  checksum: string;
};

export type UploadedImageVariant = Omit<StoredImageObject, "contentType"> & {
  contentType: "image/webp" | "image/avif";
  width: number;
  height: number;
};

export type GeneratedImageVariant = {
  extension: "webp" | "avif";
  contentType: "image/webp" | "image/avif";
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  buffer: Buffer;
};

const globalForStorage = globalThis as typeof globalThis & { hugmeidStorageClient?: Storage };

export function isNotFoundStorageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, statusCode } = error as { code?: unknown; statusCode?: unknown };
  return code === 404 || statusCode === 404;
}

function getStorageClient(): Storage {
  if (!globalForStorage.hugmeidStorageClient) {
    globalForStorage.hugmeidStorageClient = new Storage();
  }
  return globalForStorage.hugmeidStorageClient;
}

export const publicUrlFor = publicAssetUrlFor;

/**
 * Validates and uploads a Contents hero image. Decodes and re-encodes the
 * image (dropping EXIF/metadata) rather than trusting the browser-declared
 * MIME type, and rejects anything that fails to decode as JPEG/PNG/WebP.
 */
export async function buildResponsiveImageVariants(
  normalizedSource: Buffer,
  sourceWidth: number,
): Promise<GeneratedImageVariant[]> {
  const widths = [...new Set(RESPONSIVE_IMAGE_WIDTHS.map((width) => Math.min(width, sourceWidth)))];
  const variants: GeneratedImageVariant[] = [];

  for (const width of widths) {
    for (const extension of ["webp", "avif"] as const) {
      variants.push(await generateResponsiveImageVariant(normalizedSource, width, extension));
    }
  }
  return variants;
}

async function generateResponsiveImageVariant(
  normalizedSource: Buffer,
  width: number,
  extension: "webp" | "avif",
): Promise<GeneratedImageVariant> {
  const pipeline = sharp(normalizedSource).resize({ width, withoutEnlargement: true });
  const { data, info } = await (extension === "webp"
    ? pipeline.webp({ quality: 82, effort: 4 })
    : pipeline.avif({ quality: 50, effort: 4 })
  ).toBuffer({ resolveWithObject: true });
  return {
    extension,
    contentType: `image/${extension}`,
    width: info.width,
    height: info.height,
    byteSize: data.byteLength,
    checksum: createHash("sha256").update(data).digest("hex"),
    buffer: data,
  };
}

export async function uploadPublicContentImage(buffer: Buffer): Promise<UploadedImage> {
  if (buffer.byteLength === 0) throw new ValidationError("Uploaded file is empty", "empty_file");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError("Image exceeds the 5 MB limit", "file_too_large");
  }

  const metadata = await sharp(buffer)
    .metadata()
    .catch(() => null);
  const detectedFormat = metadata?.format;
  const contentType = detectedFormat ? FORMAT_TO_CONTENT_TYPE[detectedFormat] : undefined;
  if (!detectedFormat || !contentType) {
    throw new ValidationError("File could not be decoded as a JPEG, PNG, or WebP image", "undecodable_image");
  }
  if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    throw new ValidationError("Image dimensions are missing or exceed 12000 pixels", "invalid_dimensions");
  }
  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new ValidationError("Image exceeds the 40 megapixel processing limit", "image_too_many_pixels");
  }

  const reencodePipeline = sharp(buffer).rotate();
  const { data: reencoded, info: sourceInfo } =
    detectedFormat === "jpeg"
      ? await reencodePipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true })
      : detectedFormat === "png"
        ? await reencodePipeline.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
        : await reencodePipeline.webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
  if (reencoded.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError("Normalized image exceeds the 5 MB storage limit", "normalized_file_too_large");
  }

  const extension = CONTENT_TYPE_TO_EXTENSION[contentType];
  const familyId = randomUUID();
  const objectPath = `contents/source/${familyId}/original.${extension}`;
  const bucketName = requiredEnv("GCS_PUBLIC_ASSET_BUCKET");
  const bucket = getStorageClient().bucket(bucketName);
  const storedObjects: StoredImageObject[] = [];
  const saveObject = async (path: string, data: Buffer, storedContentType: string): Promise<StoredImageObject> => {
    await bucket.file(path).save(data, {
      contentType: storedContentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
    });
    const stored = {
      bucket: bucketName,
      objectPath: path,
      publicUrl: publicUrlFor(path),
      contentType: storedContentType,
      byteSize: data.byteLength,
      checksum: createHash("sha256").update(data).digest("hex"),
    };
    storedObjects.push(stored);
    return stored;
  };

  try {
    const source = await saveObject(objectPath, reencoded, contentType);
    const variants: UploadedImageVariant[] = [];
    const widths = [...new Set(RESPONSIVE_IMAGE_WIDTHS.map((width) => Math.min(width, sourceInfo.width)))];
    for (const width of widths) {
      for (const extension of ["webp", "avif"] as const) {
        const variant = await generateResponsiveImageVariant(reencoded, width, extension);
        const variantPath = `contents/variants/${familyId}/w${variant.width}.${variant.extension}`;
        const stored = await saveObject(variantPath, variant.buffer, variant.contentType);
        variants.push({ ...stored, contentType: variant.contentType, width: variant.width, height: variant.height });
      }
    }
    const delivery = [...variants]
      .filter((variant) => variant.contentType === "image/webp")
      .sort((left, right) => right.width - left.width)[0];
    if (!delivery) throw new Error("responsive_webp_missing");
    return { source, variants, delivery };
  } catch (error) {
    await deleteStoredObjects(storedObjects).catch(() => {
      logSafeError({ event: "responsive_image_cleanup_failed", code: "storage_cleanup_failed" });
    });
    throw error;
  }
}

export type PublicUrlProbeResult =
  | { status: "readable"; httpStatus: number }
  | { status: "http_error"; httpStatus: number }
  | { status: "network_error" }
  | { status: "timeout" };

/** Classifies whether the asset can be read through its public delivery URL. */
export async function probePublicUrl(
  url: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<PublicUrlProbeResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? PUBLIC_URL_PROBE_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, { method: "HEAD", signal: controller.signal });
    return response.ok
      ? { status: "readable", httpStatus: response.status }
      : { status: "http_error", httpStatus: response.status };
  } catch {
    return timedOut ? { status: "timeout" } : { status: "network_error" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function assertManagedPublicAssetReadable(
  url: string | null,
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<void> {
  if (!url || !isManagedPublicAssetUrl(url, options.env)) return;
  const result = await probePublicUrl(url, options);
  if (
    result.status === "network_error" ||
    result.status === "timeout" ||
    (result.status === "http_error" && result.httpStatus >= 500)
  ) {
    throw new HttpError(
      "Asset delivery is temporarily unavailable",
      503,
      "asset_probe_unavailable",
    );
  }
  if (result.status !== "readable") {
    throw new ValidationError(
      "Managed hero image is not readable from the public site",
      "managed_asset_unreadable",
    );
  }
}

/** Owner-only maintenance operation: permanently removes the object from Cloud Storage. */
export async function deleteStoredObject(bucketName: string, objectPath: string): Promise<void> {
  try {
    const deletion = getStorageClient().bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        deletion,
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("storage_delete_timeout")), STORAGE_DELETE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  } catch (error) {
    if (isNotFoundStorageError(error)) return;
    throw error;
  }
}

export async function deleteStoredObjects(objects: Array<Pick<StoredImageObject, "bucket" | "objectPath">>): Promise<void> {
  for (const object of objects) {
    try {
      await deleteStoredObject(object.bucket, object.objectPath);
    } catch (error) {
      logSafeError({
        event: "stored_object_cleanup_failed",
        code: "storage_delete_failed",
        resourceId: `${object.bucket}/${object.objectPath}`,
      });
      throw error;
    }
  }
}
