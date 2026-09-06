import { resolveDatabaseRuntimeEnvironment } from "./db/environment";

const REQUIRED_ADMIN_VALUES = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "ADMIN_SESSION_SECRET",
  "REVALIDATE_ADMIN_SECRET",
  "GCS_PUBLIC_ASSET_BUCKET",
  "GCS_PUBLIC_ASSET_BASE_URL",
  "PUBLIC_APP_REVALIDATE_URL",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
] as const;

export function assertAdminRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  const runtime = resolveDatabaseRuntimeEnvironment(env);
  if (runtime.deployEnv === "local") return;
  for (const name of REQUIRED_ADMIN_VALUES) {
    if (!env[name]?.trim()) throw new Error(`${name} is required outside local development`);
  }
  if (!env.PGHOST?.trim() && !env.CLOUD_SQL_CONNECTION_NAME?.trim()) {
    throw new Error("PGHOST or CLOUD_SQL_CONNECTION_NAME is required outside local development");
  }
  if ((env.ADMIN_SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters outside local development");
  }
  try {
    const redirect = new URL(env.GOOGLE_OAUTH_REDIRECT_URI!);
    if (redirect.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URI must be an HTTPS URL outside local development");
  }
  try {
    const assetBase = new URL(env.GCS_PUBLIC_ASSET_BASE_URL!);
    const revalidateUrl = new URL(env.PUBLIC_APP_REVALIDATE_URL!);
    const assetPath = assetBase.pathname.replace(/\/+$/, "");
    if (
      assetBase.protocol !== "https:"
      || assetBase.username
      || assetBase.password
      || assetBase.port === "0"
      || assetBase.search
      || assetBase.hash
      || assetPath !== "/api/assets/public"
      || assetBase.origin !== revalidateUrl.origin
      || assetBase.hostname === "storage.googleapis.com"
      || assetBase.hostname.endsWith(".storage.googleapis.com")
      || revalidateUrl.protocol !== "https:"
      || revalidateUrl.username
      || revalidateUrl.password
      || revalidateUrl.port === "0"
      || revalidateUrl.pathname !== "/api/admin/revalidate"
      || revalidateUrl.search
      || revalidateUrl.hash
    ) throw new Error();
  } catch {
    throw new Error(
      "GCS_PUBLIC_ASSET_BASE_URL and PUBLIC_APP_REVALIDATE_URL must use the matching public app HTTPS origin and canonical paths outside local development",
    );
  }
}
