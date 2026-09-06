import type { BookmarkDto } from "./job-dto";
import { mapJobListItem, type JobRow } from "./jobs";
import type { ActivityBookmarkDto } from "./activity-dto";
import { mapActivityListItem, type ActivityRow } from "./activities";
import type { ContentBookmarkDto } from "./content-dto";
import { mapContentListItem, type ContentRow } from "./contents";
import type { SavedItemDto } from "./saved-items";

export type BookmarkRow = {
  id: string;
  created_at: string;
  jobs: JobRow | JobRow[] | null;
};

export type ActivityBookmarkRow = {
  id: string;
  created_at: string;
  activities: ActivityRow | ActivityRow[] | null;
};

export type ContentBookmarkRow = {
  id: string;
  created_at: string;
  contents: ContentRow | ContentRow[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function mapBookmarkRowToDto(row: BookmarkRow): BookmarkDto | null {
  const job = firstRelation(row.jobs);
  if (!job) return null;
  return {
    id: row.id,
    type: "job",
    job: mapJobListItem(job, true),
    savedAt: row.created_at,
  };
}

export function mapActivityBookmarkRowToDto(row: ActivityBookmarkRow): ActivityBookmarkDto | null {
  const activity = firstRelation(row.activities);
  if (!activity) return null;
  return {
    id: row.id,
    type: "activity",
    activity: mapActivityListItem(activity, true),
    savedAt: row.created_at,
  };
}

export function mapContentBookmarkRowToDto(row: ContentBookmarkRow): ContentBookmarkDto | null {
  const content = firstRelation(row.contents);
  if (!content) return null;
  return {
    id: row.id,
    type: "content",
    content: mapContentListItem(content, true),
    savedAt: row.created_at,
  };
}

export function sortSavedItemsBySavedAtDesc(items: SavedItemDto[]) {
  return [...items].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}
