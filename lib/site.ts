/**
 * サイト全体設定
 * - Hugmeid mock のサブコピー「6万人の医学生で創る縁」を default に。
 * - LINE LIFF / 応募先 / シラバス URL を環境変数で差し替え可能。
 */
export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Hugmeid",
  tagline: process.env.NEXT_PUBLIC_APP_TAGLINE || "6万人の医学生で創る縁",
  description:
    process.env.NEXT_PUBLIC_APP_DESCRIPTION ||
    "Hugmeidは医学生のためのキャリア・学習・ネットワーキングを支援するプラットフォームです。",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://your-project.vercel.app",
  lineLoginUrl: process.env.NEXT_PUBLIC_LINE_LOGIN_URL || "",
  defaultApplyUrl: process.env.NEXT_PUBLIC_DEFAULT_APPLY_URL || "",
  syllabusUrl: process.env.NEXT_PUBLIC_SYLLABUS_URL || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@example.com",
};
