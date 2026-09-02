import "server-only";

import type { AuthSessionPayload } from "./auth/types";
import { dbQuery } from "./db/postgres";
import type { BookmarkDto } from "./job-dto";
import type { ActivityBookmarkDto } from "./activity-dto";
import type { ContentBookmarkDto } from "./content-dto";
import {
  mapActivityBookmarkRowToDto,
  mapBookmarkRowToDto,
  mapContentBookmarkRowToDto,
  sortSavedItemsBySavedAtDesc,
  type ActivityBookmarkRow,
  type BookmarkRow,
  type ContentBookmarkRow,
} from "./bookmark-requests";
import { getActiveActivityRowById } from "./activities";
import { getActiveContentRowById } from "./contents";
import { getActiveJobRowById } from "./jobs";
import type { SavedItemDto } from "./saved-items";

type ActiveUser = {
  id: string;
  deactivated_at: string | null;
};

async function requireActiveUser(session: AuthSessionPayload) {
  const { rows } = await dbQuery<ActiveUser>(
    `
      select id::text, deactivated_at::text
      from users
      where id = $1
        and deactivated_at is null
      limit 1
    `,
    [session.userId],
  );
  return rows[0] ?? null;
}

async function getActivePublishedJob(jobId: string) {
  return getActiveJobRowById(jobId);
}

async function listJobBookmarksForSession(session: AuthSessionPayload): Promise<BookmarkDto[] | null> {
  const user = await requireActiveUser(session);
  if (!user) return null;

  const { rows } = await dbQuery<BookmarkRow>(
    `
      select
        b.id::text,
        b.created_at::text,
        json_build_object(
          'id', j.id::text,
          'slug', j.slug,
          'title', j.title,
          'location_pref', j.location_pref,
          'location_detail', j.location_detail,
          'summary', j.summary,
          'description_md', j.description_md,
          'published_at', j.published_at::text,
          'salary_min', j.salary_min,
          'salary_display', j.salary_display,
          'work_schedule', j.work_schedule,
          'company_name', j.company_name,
          'company_type', j.company_type,
          'requirements_summary', j.requirements_summary,
          'requirements_list', j.requirements_list,
          'benefits', j.benefits,
          'apply_url', j.apply_url,
          'external_source', j.external_source,
          'external_id', j.external_id,
          'external_slug', j.external_slug,
          'source_last_modified_at', j.source_last_modified_at::text,
          'synced_at', j.synced_at::text,
          'job_categories', json_build_object('code', jc.code, 'name', jc.name),
          'employment_types', json_build_object('code', et.code, 'name', et.name)
        ) as jobs
      from job_bookmarks b
      join jobs j on j.id = b.job_id
      join job_categories jc on jc.id = j.job_category_id
      join employment_types et on et.id = j.employment_type_id
      where b.user_id = $1
        and j.is_active = true
        and j.published_at is not null
        and j.published_at <= now()
      order by b.created_at desc
    `,
    [session.userId],
  );
  return rows.map(mapBookmarkRowToDto).filter((item): item is BookmarkDto => item !== null);
}

async function listActivityBookmarksForSession(session: AuthSessionPayload): Promise<ActivityBookmarkDto[]> {
  const { rows } = await dbQuery<ActivityBookmarkRow>(
    `
      select
        b.id::text,
        b.created_at::text,
        json_build_object(
          'id', a.id::text,
          'slug', a.slug,
          'kind', a.kind,
          'title', a.title,
          'host_name', a.host_name,
          'summary', a.summary,
          'description_md', a.description_md,
          'action_type', a.action_type,
          'action_url', a.action_url,
          'target_audience', a.target_audience,
          'location_pref', a.location_pref,
          'location_detail', a.location_detail,
          'starts_at', a.starts_at::text,
          'ends_at', a.ends_at::text,
          'deadline_at', a.deadline_at::text,
          'capacity_display', a.capacity_display,
          'requirements_json', a.requirements_json,
          'benefits_json', a.benefits_json,
          'source_name', a.source_name,
          'source_url', a.source_url,
          'source_last_modified_at', a.source_last_modified_at::text,
          'synced_at', a.synced_at::text,
          'published_at', a.published_at::text,
          'activity_kinds', json_build_object('code', ak.code, 'name', ak.name)
        ) as activities
      from activity_bookmarks b
      join activities a on a.id = b.activity_id
      join activity_kinds ak on ak.code = a.kind
      where b.user_id = $1
        and a.is_active = true
        and a.published_at is not null
        and a.published_at <= now()
      order by b.created_at desc
    `,
    [session.userId],
  );
  return rows.map(mapActivityBookmarkRowToDto).filter((item): item is ActivityBookmarkDto => item !== null);
}

async function listContentBookmarksForSession(session: AuthSessionPayload): Promise<ContentBookmarkDto[]> {
  const { rows } = await dbQuery<ContentBookmarkRow>(
    `
      select
        b.id::text,
        b.created_at::text,
        json_build_object(
          'id', c.id::text,
          'slug', c.slug,
          'content_type', c.content_type,
          'category', c.category,
          'title', c.title,
          'dek', c.dek,
          'body_md', c.body_md,
          'hero_image_url', c.hero_image_url,
          'related_activity_id', c.related_activity_id::text,
          'related_job_id', c.related_job_id::text,
          'published_at', c.published_at::text,
          'content_categories', json_build_object('code', cc.code, 'name', cc.name)
        ) as contents
      from content_bookmarks b
      join contents c on c.id = b.content_id
      join content_categories cc on cc.code = c.category
      where b.user_id = $1
        and c.is_active = true
        and c.published_at is not null
        and c.published_at <= now()
      order by b.created_at desc
    `,
    [session.userId],
  );
  return rows.map(mapContentBookmarkRowToDto).filter((item): item is ContentBookmarkDto => item !== null);
}

export async function listBookmarksForSession(session: AuthSessionPayload): Promise<SavedItemDto[] | null> {
  const user = await requireActiveUser(session);
  if (!user) return null;

  const [jobs, activities, contents] = await Promise.all([
    listJobBookmarksForSession(session),
    listActivityBookmarksForSession(session),
    listContentBookmarksForSession(session),
  ]);
  if (!jobs) return null;
  return sortSavedItemsBySavedAtDesc([...jobs, ...activities, ...contents]);
}

export async function saveJobBookmarkForSession(session: AuthSessionPayload, jobId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  const job = await getActivePublishedJob(jobId);
  if (!job) return "not_found" as const;

  await dbQuery(
    `
      insert into job_bookmarks (user_id, job_id)
      values ($1, $2)
      on conflict (user_id, job_id) do nothing
    `,
    [session.userId, jobId],
  );
  return "saved" as const;
}

export async function deleteJobBookmarkForSession(session: AuthSessionPayload, jobId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  await dbQuery("delete from job_bookmarks where user_id = $1 and job_id = $2", [session.userId, jobId]);
  return "deleted" as const;
}

export async function saveActivityBookmarkForSession(session: AuthSessionPayload, activityId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  const activity = await getActiveActivityRowById(activityId);
  if (!activity) return "not_found" as const;

  await dbQuery(
    `
      insert into activity_bookmarks (user_id, activity_id)
      values ($1, $2)
      on conflict (user_id, activity_id) do nothing
    `,
    [session.userId, activityId],
  );
  return "saved" as const;
}

export async function deleteActivityBookmarkForSession(session: AuthSessionPayload, activityId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  await dbQuery("delete from activity_bookmarks where user_id = $1 and activity_id = $2", [session.userId, activityId]);
  return "deleted" as const;
}

export async function saveContentBookmarkForSession(session: AuthSessionPayload, contentId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  const content = await getActiveContentRowById(contentId);
  if (!content) return "not_found" as const;

  await dbQuery(
    `
      insert into content_bookmarks (user_id, content_id)
      values ($1, $2)
      on conflict (user_id, content_id) do nothing
    `,
    [session.userId, contentId],
  );
  return "saved" as const;
}

export async function deleteContentBookmarkForSession(session: AuthSessionPayload, contentId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  await dbQuery("delete from content_bookmarks where user_id = $1 and content_id = $2", [session.userId, contentId]);
  return "deleted" as const;
}
