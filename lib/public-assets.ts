const PUBLIC_ASSET_PREFIX = "contents/";

export const PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

const ALLOWED_PUBLIC_ASSET_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export function normalizePublicAssetObjectPath(parts: string[]): string | null {
  const objectPath = parts.join("/");
  if (!objectPath.startsWith(PUBLIC_ASSET_PREFIX)) return null;
  if (objectPath.length <= PUBLIC_ASSET_PREFIX.length) return null;
  if (objectPath.includes("\\")) return null;

  for (const part of parts) {
    if (!part || part === "." || part === "..") return null;
  }

  return objectPath;
}

export function isAllowedPublicAssetContentType(contentType: string | undefined): contentType is string {
  if (!contentType) return false;
  return ALLOWED_PUBLIC_ASSET_CONTENT_TYPES.has(contentType.split(";")[0]?.trim().toLowerCase() ?? "");
}
