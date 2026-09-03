// Contents domain types shared between the DB access layer (lib/contents.ts)
// and the app/contents/** pages and API routes. Mirrors the parent public
// app's `contents` table shape (lib/content-dto.ts, lib/contents.ts there),
// plus the admin-only created_by_admin_id/updated_by_admin_id columns in
// cloudsql/baseline/20260730000000_schema.sql.

export const CONTENT_TYPES = ["article", "guide", "faq", "story", "sponsor_story"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export function isContentType(value: string): value is ContentType {
  return (CONTENT_TYPES as readonly string[]).includes(value);
}

export type AdminContentRow = {
  id: string;
  slug: string;
  content_type: ContentType;
  category: string;
  title: string;
  dek: string | null;
  body_md: string | null;
  hero_image_url: string | null;
  thumbnail_image_url: string | null;
  related_activity_id: string | null;
  related_job_id: string | null;
  published_at: string | null;
  first_published_at: string | null;
  approval_status: "draft" | "in_review" | "approved" | "changes_requested";
  approval_requested_by_admin_id: string | null;
  approval_requested_at: string | null;
  approved_by_admin_id: string | null;
  approved_at: string | null;
  is_active: boolean;
  click_count: number;
  created_by_admin_id: string | null;
  updated_by_admin_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ContentCategoryOption = {
  code: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

/** Input shape for both create and update. Update uses a Partial<> of this. */
export type ContentInput = {
  title: string;
  slug: string;
  contentType: ContentType;
  category: string;
  bodyMd: string;
  dek: string | null;
  heroImageUrl: string | null;
  thumbnailImageUrl: string | null;
  relatedActivityId: string | null;
  relatedJobId: string | null;
};

export type ContentFilters = {
  q?: string;
  type?: string;
  category?: string;
  state?: string;
};

/** Patch fields for the dedicated thumbnail endpoint. */
export type ContentThumbnailPatch = {
  thumbnailImageUrl: string | null;
  expectedUpdatedAt?: string;
};
