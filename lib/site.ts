import { normalizeEmailAddress, normalizeExternalHttpsUrl, normalizeSiteUrl } from "@/lib/security/url";

const isLocal = !process.env.HUGMEID_DEPLOY_ENV || process.env.HUGMEID_DEPLOY_ENV === "local";

function requiredSiteUrl(): string {
  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  if (isLocal) return "http://localhost:3000/";
  throw new Error("NEXT_PUBLIC_SITE_URL must be configured outside local development");
}

function requiredContactEmail(): string {
  const configured = normalizeEmailAddress(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "");
  if (configured) return configured;
  if (isLocal) return "contact@example.com";
  throw new Error("NEXT_PUBLIC_CONTACT_EMAIL must be configured outside local development");
}

export const siteConfig = {
  // kakunin 移植: ヘッダーにはサイト名/タグラインを表示しない。
  // 値は metadata.siteName 等でのみ参照する。
  name: process.env.NEXT_PUBLIC_APP_NAME || "Hugmeid",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "医学生向けプラットフォーム",
  siteUrl: requiredSiteUrl(),
  lineLoginUrl: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_LINE_LOGIN_URL) || "",
  syllabusUrl: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_SYLLABUS_URL) || "",
  contactEmail: requiredContactEmail(),
};
