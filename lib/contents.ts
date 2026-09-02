import type { ContentDetailDto, ContentListItemDto, ContentType, FaqItemDto } from "./content-dto";
import { normalizeExternalHttpsUrl } from "./security/url";

type RelationRow = { code: string; name: string };

export type ContentRow = {
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
  related_activity_slug?: string | null;
  related_job_slug?: string | null;
  published_at: string | null;
  content_categories: RelationRow | null;
};

export type ContentFilters = {
  q?: string;
  type?: string;
  category?: string;
};

export type ThumbnailVariant = {
  publicUrl: string;
  width: number;
  height: number;
  contentType: string;
};

/**
 * Picks the most efficient managed webp variant for a list thumbnail. The
 * upload pipeline writes 320 / 640 / 1280 px width renditions; we map a
 * callers' pixel budget onto the closest rendition so the browser does not
 * pull a 1280-wide image for a 96-wide card.
 */
export function pickBestThumbnailVariant(
  thumbnailUrl: string | null,
  targetPx: number,
): string | null {
  const normalized = normalizeExternalHttpsUrl(thumbnailUrl);
  if (!normalized) return null;
  const match = normalized.match(/\/api\/assets\/public\/contents\/variants\/[0-9a-f-]{36}\/w(\d+)\.webp$/);
  if (!match) return normalized;
  const widths = [1280, 640, 320];
  // thumbnail_image_url already references the largest variant; pick the
  // smallest variant that still covers the requested pixel budget.
  const orderedDown = [...widths].reverse();
  const chosen = orderedDown.find((width) => width >= targetPx) ?? widths[0];
  return normalized.replace(/\/w\d+\.webp$/, `/w${chosen}.webp`);
}

export function contentListImageUrl(value: string | null): string | null {
  return pickBestThumbnailVariant(value, 320);
}

export function mapContentListItem(row: ContentRow, isSaved = false): ContentListItemDto {
  return {
    id: row.id,
    slug: row.slug,
    type: row.content_type,
    category: { code: row.content_categories?.code ?? row.category, name: row.content_categories?.name ?? row.category },
    title: row.title,
    dek: row.dek,
    heroImageUrl: contentListImageUrl(row.thumbnail_image_url ?? row.hero_image_url),
    publishedAt: row.published_at,
    isSaved,
  };
}

function mapContentDetail(row: ContentRow, isSaved = false): ContentDetailDto {
  return {
    ...mapContentListItem(row, isSaved),
    heroImageUrl: pickBestThumbnailVariant(row.thumbnail_image_url ?? row.hero_image_url, 1280),
    body: row.body_md,
    relatedActivitySlug: row.related_activity_slug ?? null,
    relatedJobSlug: row.related_job_slug ?? null,
  };
}

function matchesFilters(content: ContentListItemDto, filters: ContentFilters) {
  if (filters.q) {
    const query = filters.q.trim().toLowerCase();
    const searchableText = [content.title, content.dek, content.category.name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!searchableText.includes(query)) return false;
  }
  if (filters.type && content.type !== filters.type) return false;
  if (filters.category && content.category.code !== filters.category && content.category.name !== filters.category) return false;
  return true;
}

export function filterContentListItems(contents: ContentListItemDto[], filters: ContentFilters = {}) {
  return contents.filter((content) => matchesFilters(content, filters));
}

export function mapFaqItems(rows: ContentRow[]): FaqItemDto[] {
  return rows
    .filter((row) => row.content_type === "faq")
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      question: row.title,
      answer: row.body_md ?? "",
    }));
}

async function fetchActiveContentRows() {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<ContentRow>(`
    select
      c.id::text,
      c.slug,
      c.content_type,
      c.category,
      c.title,
      c.dek,
      c.body_md,
      c.hero_image_url,
      c.thumbnail_image_url,
      c.related_activity_id::text,
      c.related_job_id::text,
      related_activity.slug as related_activity_slug,
      related_job.slug as related_job_slug,
      c.published_at::text,
      json_build_object('code', cc.code, 'name', cc.name) as content_categories
    from contents c
    join content_categories cc on cc.code = c.category
    left join activities related_activity on related_activity.id = c.related_activity_id
    left join jobs related_job on related_job.id = c.related_job_id
    where c.is_active = true
      and c.published_at is not null
      and c.published_at <= now()
    order by c.published_at desc nulls last
  `);
  return rows;
}

export async function getActiveContentRowById(contentId: string) {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<ContentRow>(
    `
      select
        c.id::text,
        c.slug,
        c.content_type,
        c.category,
        c.title,
        c.dek,
        c.body_md,
        c.hero_image_url,
        c.thumbnail_image_url,
        c.related_activity_id::text,
        c.related_job_id::text,
        related_activity.slug as related_activity_slug,
        related_job.slug as related_job_slug,
        c.published_at::text,
        json_build_object('code', cc.code, 'name', cc.name) as content_categories
      from contents c
      join content_categories cc on cc.code = c.category
      left join activities related_activity on related_activity.id = c.related_activity_id
      left join jobs related_job on related_job.id = c.related_job_id
      where c.id = $1
        and c.is_active = true
        and c.published_at is not null
        and c.published_at <= now()
      limit 1
    `,
    [contentId],
  );
  return rows[0] ?? null;
}

export async function listContents(filters: ContentFilters = {}) {
  const rows = await fetchActiveContentRows();
  return filterContentListItems(
    rows.filter((row) => row.content_type !== "faq").map((row) => mapContentListItem(row)),
    filters,
  );
}

export async function listFaqs() {
  return mapFaqItems(await fetchActiveContentRows());
}

export async function getContentBySlug(slug: string) {
  const rows = await fetchActiveContentRows();
  const row = rows.find((item) => item.slug === slug);
  return row ? mapContentDetail(row) : null;
}
