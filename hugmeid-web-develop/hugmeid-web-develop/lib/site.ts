export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Hugmeid",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "医学生向けプラットフォーム",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://your-project.vercel.app",
  lineLoginUrl: process.env.NEXT_PUBLIC_LINE_LOGIN_URL || "",
  defaultApplyUrl: process.env.NEXT_PUBLIC_DEFAULT_APPLY_URL || "",
  syllabusUrl: process.env.NEXT_PUBLIC_SYLLABUS_URL || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@example.com",
};
