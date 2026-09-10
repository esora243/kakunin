import { normalizeEmailAddress, normalizeExternalHttpsUrl, normalizeSiteUrl } from "@/lib/security/url";

// テスト環境用: 環境変数が未設定でもエラーにせずデフォルト値でフォールバックする

function requiredSiteUrl(): string {
  const configured = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;
  return "http://localhost:3000/";
}

function requiredContactEmail(): string {
  const configured = normalizeEmailAddress(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "");
  if (configured) return configured;
  return "contact@example.com";
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
