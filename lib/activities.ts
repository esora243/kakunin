import type { ActivityActionType, ActivityDetailDto, ActivityListItemDto } from "./activity-dto";
import { normalizeExternalHttpsUrl, pickBestThumbnailVariant } from "./contents";

type RelationRow = { code: string; name: string };

export type ActivityRow = {
  id: string;
  slug: string;
  kind: string;
  title: string;
  host_name: string;
  summary: string | null;
  description_md: string | null;
  action_type: ActivityActionType;
  action_url: string | null;
  target_audience: string | null;
  location_pref: string | null;
  location_detail: string | null;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  capacity_display: string | null;
  requirements_json: unknown;
  benefits_json: unknown;
  source_name: string | null;
  source_url: string | null;
  source_last_modified_at: string | null;
  synced_at: string;
  published_at: string | null;
  thumbnail_image_url: string | null;
  activity_kinds: RelationRow | null;
};

export type ActivityFilters = {
  q?: string;
  kind?: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function activityLocation(row: ActivityRow) {
  return row.location_detail ?? row.location_pref;
}

export function mapActivityListItem(row: ActivityRow, isSaved = false): ActivityListItemDto {
  return {
    id: row.id,
    slug: row.slug,
    kind: { code: row.activity_kinds?.code ?? row.kind, name: row.activity_kinds?.name ?? row.kind },
    title: row.title,
    hostName: row.host_name,
    summary: row.summary,
    actionType: row.action_type,
    targetAudience: row.target_audience,
    location: activityLocation(row),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    deadlineAt: row.deadline_at,
    capacityDisplay: row.capacity_display,
    thumbnailImageUrl: pickBestThumbnailVariant(row.thumbnail_image_url, 320),
    publishedAt: row.published_at,
    isSaved,
  };
}

function mapActivityDetail(row: ActivityRow, isSaved = false): ActivityDetailDto {
  return {
    ...mapActivityListItem(row, isSaved),
    description: row.description_md,
    actionUrl: normalizeExternalHttpsUrl(row.action_url),
    requirements: asStringArray(row.requirements_json),
    benefits: asStringArray(row.benefits_json),
    source: {
      sourceName: row.source_name,
      sourceUrl: normalizeExternalHttpsUrl(row.source_url),
      sourceLastModifiedAt: row.source_last_modified_at,
      syncedAt: row.synced_at,
    },
  };
}

function matchesFilters(activity: ActivityListItemDto, filters: ActivityFilters) {
  if (filters.q) {
    const query = filters.q.trim().toLowerCase();
    const searchableText = [activity.title, activity.hostName, activity.summary, activity.kind.name, activity.location]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!searchableText.includes(query)) return false;
  }
  if (filters.kind && activity.kind.code !== filters.kind && activity.kind.name !== filters.kind) return false;
  return true;
}

export function filterActivityListItems(activities: ActivityListItemDto[], filters: ActivityFilters = {}) {
  return activities.filter((activity) => matchesFilters(activity, filters));
}

async function fetchActiveActivityRows() {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<ActivityRow>(`
    select
      a.id::text,
      a.slug,
      a.kind,
      a.title,
      a.host_name,
      a.summary,
      a.description_md,
      a.action_type,
      a.action_url,
      a.target_audience,
      a.location_pref,
      a.location_detail,
      a.starts_at::text,
      a.ends_at::text,
      a.deadline_at::text,
      a.capacity_display,
      a.requirements_json,
      a.benefits_json,
      a.source_name,
      a.source_url,
      a.source_last_modified_at::text,
      a.synced_at::text,
      a.published_at::text,
      a.thumbnail_image_url,
      json_build_object('code', ak.code, 'name', ak.name) as activity_kinds
    from activities a
    join activity_kinds ak on ak.code = a.kind
    where a.is_active = true
      and a.published_at is not null
      and a.published_at <= now()
    order by a.deadline_at asc nulls last, a.published_at desc nulls last
  `);
  return rows;
}

export async function getActiveActivityRowById(activityId: string) {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<ActivityRow>(
    `
      select
        a.id::text,
        a.slug,
        a.kind,
        a.title,
        a.host_name,
        a.summary,
        a.description_md,
        a.action_type,
        a.action_url,
        a.target_audience,
        a.location_pref,
        a.location_detail,
        a.starts_at::text,
        a.ends_at::text,
        a.deadline_at::text,
        a.capacity_display,
        a.requirements_json,
        a.benefits_json,
        a.source_name,
        a.source_url,
        a.source_last_modified_at::text,
        a.synced_at::text,
        a.published_at::text,
        a.thumbnail_image_url,
        json_build_object('code', ak.code, 'name', ak.name) as activity_kinds
      from activities a
      join activity_kinds ak on ak.code = a.kind
      where a.id = $1
        and a.is_active = true
        and a.published_at is not null
        and a.published_at <= now()
      limit 1
    `,
    [activityId],
  );
  return rows[0] ?? null;
}

export async function listActivities(filters: ActivityFilters = {}) {
  const rows = await fetchActiveActivityRows();
  return filterActivityListItems(rows.map((row) => mapActivityListItem(row)), filters);
}

export async function getActivityBySlug(slug: string) {
  const rows = await fetchActiveActivityRows();
  const row = rows.find((item) => item.slug === slug);
  return row ? mapActivityDetail(row) : null;
}