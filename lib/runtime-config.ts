import { normalizeEmailAddress, normalizeSiteUrl } from "./security/url";
import { resolveDatabaseRuntimeEnvironment } from "./db/environment";

const REQUIRED_NON_LOCAL_VALUES = [
  "NEXT_PUBLIC_LIFF_ID",
  "LINE_CHANNEL_ID",
  "LINE_CHANNEL_SECRET",
  "REVALIDATE_ADMIN_SECRET",
  "GCS_PUBLIC_ASSET_BUCKET",
  "SESSION_SECRET",
] as const;

const IMAGE_HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

function assertImageAllowedRemoteHosts(value: string | undefined): void {
  const raw = value?.trim() ?? "";
  if (!raw) throw new Error("IMAGE_ALLOWED_REMOTE_HOSTS is required outside local development");
  const hosts = raw.split(",").map((hostname) => hostname.trim());
  if (hosts.some((hostname) => !IMAGE_HOSTNAME_PATTERN.test(hostname))) {
    throw new Error("IMAGE_ALLOWED_REMOTE_HOSTS must contain only comma-separated DNS hostnames");
  }
}

export function assertPublicRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  const runtime = resolveDatabaseRuntimeEnvironment(env);
  if (runtime.deployEnv === "local") return;

  const siteUrl = normalizeSiteUrl(env.NEXT_PUBLIC_SITE_URL);
  if (!siteUrl || new URL(siteUrl).protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid HTTPS URL outside local development");
  }
  if (!normalizeEmailAddress(env.NEXT_PUBLIC_CONTACT_EMAIL, "")) {
    throw new Error("NEXT_PUBLIC_CONTACT_EMAIL must be configured outside local development");
  }
  assertImageAllowedRemoteHosts(env.IMAGE_ALLOWED_REMOTE_HOSTS);
  for (const name of REQUIRED_NON_LOCAL_VALUES) {
    if (!env[name]?.trim()) throw new Error(`${name} is required outside local development`);
  }
  if ((env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters outside local development");
  }
  if (!env.HUGMEID_RELEASE_SHA?.match(/^[0-9a-f]{40}$/i)) {
    throw new Error("HUGMEID_RELEASE_SHA must identify the deployed revision");
  }
}

export function releaseSha(env: NodeJS.ProcessEnv = process.env): string {
  const sha = env.HUGMEID_RELEASE_SHA?.trim();
  if (sha) return sha;
  if (!env.HUGMEID_DEPLOY_ENV || env.HUGMEID_DEPLOY_ENV === "local") return "local";
  throw new Error("HUGMEID_RELEASE_SHA must identify the deployed revision");
}
