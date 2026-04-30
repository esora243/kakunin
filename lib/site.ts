import { env } from "@/lib/env";

const fallbackSiteUrl = env.siteUrl() || "https://your-project.vercel.app";

export const siteConfig = {
  name: process.env.NEXT_PUBLIC_APP_NAME || "Hugmeid",
  description: process.env.NEXT_PUBLIC_APP_DESCRIPTION || "医学生向けプラットフォーム",
  siteUrl: fallbackSiteUrl,
  syllabusUrl: process.env.NEXT_PUBLIC_SYLLABUS_URL || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "contact@example.com",
};
