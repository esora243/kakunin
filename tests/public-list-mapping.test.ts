import assert from "node:assert/strict";
import test from "node:test";
import {
  filterActivityListItems,
  mapActivityListItem,
  type ActivityRow,
} from "../lib/activities";
import {
  contentListImageUrl,
  filterContentListItems,
  mapContentListItem,
  type ContentRow,
} from "../lib/contents";
import { filterJobListItems, mapJobListItem, type JobRow } from "../lib/jobs";
import {
  mapActivityBookmarkRowToDto,
  mapBookmarkRowToDto,
  mapContentBookmarkRowToDto,
  sortSavedItemsBySavedAtDesc,
} from "../lib/bookmark-requests";
import type { SavedItemDto } from "../lib/saved-items";

function activityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: "activity-1",
    slug: "clinical-event",
    kind: "event",
    title: "臨床交流会",
    host_name: "浜松医科大学",
    summary: "医学生向け",
    description_md: null,
    action_type: "signup",
    action_url: null,
    target_audience: "医学生",
    location_pref: "静岡県",
    location_detail: "浜松市",
    starts_at: null,
    ends_at: null,
    deadline_at: null,
    capacity_display: null,
    requirements_json: null,
    benefits_json: null,
    source_name: null,
    source_url: null,
    source_last_modified_at: null,
    synced_at: "2026-08-01T00:00:00.000Z",
    published_at: "2026-08-01T00:00:00.000Z",
    activity_kinds: { code: "event", name: "イベント" },
    ...overrides,
  };
}

function contentRow(overrides: Partial<ContentRow> = {}): ContentRow {
  return {
    id: "content-1",
    slug: "career-guide",
    content_type: "guide",
    category: "career",
    title: "キャリアガイド",
    dek: "研修先選び",
    body_md: null,
    hero_image_url: null,
    related_activity_id: null,
    related_job_id: null,
    published_at: "2026-08-01T00:00:00.000Z",
    content_categories: { code: "career", name: "キャリア" },
    ...overrides,
  };
}

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    slug: "clinic-job",
    title: "クリニック勤務",
    location_pref: "静岡県",
    location_detail: "浜松市",
    summary: "医学生歓迎",
    description_md: null,
    published_at: "2026-08-01T00:00:00.000Z",
    salary_min: 1_500,
    salary_display: "時給1,500円",
    work_schedule: "週1日",
    company_name: "浜松クリニック",
    company_type: "clinic",
    requirements_summary: "医学生",
    requirements_list: null,
    benefits: null,
    apply_url: null,
    external_source: "cms",
    external_id: "external-1",
    external_slug: null,
    source_last_modified_at: null,
    synced_at: "2026-08-01T00:00:00.000Z",
    job_categories: { code: "clinical", name: "臨床" },
    employment_types: { code: "part_time", name: "アルバイト" },
    ...overrides,
  };
}

test("public list mappers use relation labels, safe location fallbacks, and saved state", () => {
  assert.deepEqual(mapActivityListItem(activityRow(), true), {
    id: "activity-1",
    slug: "clinical-event",
    kind: { code: "event", name: "イベント" },
    title: "臨床交流会",
    hostName: "浜松医科大学",
    summary: "医学生向け",
    actionType: "signup",
    targetAudience: "医学生",
    location: "浜松市",
    startsAt: null,
    endsAt: null,
    deadlineAt: null,
    capacityDisplay: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    isSaved: true,
  });
  assert.equal(mapActivityListItem(activityRow({ location_detail: null })).location, "静岡県");
  assert.equal(mapJobListItem(jobRow({ location_detail: null })).location, "静岡県");
  assert.deepEqual(mapContentListItem(contentRow()).category, { code: "career", name: "キャリア" });
});

test("public list filters match normalized text plus code or display labels", () => {
  const activity = mapActivityListItem(activityRow());
  const content = mapContentListItem(contentRow());
  const job = mapJobListItem(jobRow());

  assert.deepEqual(filterActivityListItems([activity], { q: "  浜松  ", kind: "イベント" }), [activity]);
  assert.deepEqual(filterActivityListItems([activity], { kind: "unknown" }), []);
  assert.deepEqual(filterContentListItems([content], { q: "研修先", category: "career", type: "guide" }), [content]);
  assert.deepEqual(filterContentListItems([content], { type: "article" }), []);
  assert.deepEqual(filterJobListItems([job], { q: "クリニック", employmentType: "アルバイト", salaryMin: 1_500 }), [job]);
  assert.deepEqual(filterJobListItems([job], { salaryMin: 1_501 }), []);
});

test("content list images downgrade oversized generated variants and reject unsafe URLs", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(
    contentListImageUrl(`https://hugmeid.example/api/assets/public/contents/variants/${uuid}/w1280.webp`),
    `https://hugmeid.example/api/assets/public/contents/variants/${uuid}/w640.webp`,
  );
  assert.equal(
    contentListImageUrl(`https://hugmeid.example/api/assets/public/contents/variants/${uuid}/w320.webp`),
    `https://hugmeid.example/api/assets/public/contents/variants/${uuid}/w320.webp`,
  );
  assert.equal(contentListImageUrl("javascript:alert(1)"), null);
});

test("bookmark relation shapes map consistently and saved items sort without mutating input", () => {
  const jobBookmark = mapBookmarkRowToDto({ id: "bookmark-job", created_at: "2026-08-01T00:00:00.000Z", jobs: [jobRow()] });
  const activityBookmark = mapActivityBookmarkRowToDto({ id: "bookmark-activity", created_at: "2026-08-03T00:00:00.000Z", activities: activityRow() });
  const contentBookmark = mapContentBookmarkRowToDto({ id: "bookmark-content", created_at: "2026-08-02T00:00:00.000Z", contents: contentRow() });

  assert.equal(jobBookmark?.job.isSaved, true);
  assert.equal(activityBookmark?.activity.isSaved, true);
  assert.equal(contentBookmark?.content.isSaved, true);
  assert.equal(mapBookmarkRowToDto({ id: "missing", created_at: "2026-08-01T00:00:00.000Z", jobs: [] }), null);

  const input = [jobBookmark, activityBookmark, contentBookmark].filter((item): item is SavedItemDto => item !== null);
  const sorted = sortSavedItemsBySavedAtDesc(input);
  assert.deepEqual(sorted.map((item) => item.id), ["bookmark-activity", "bookmark-content", "bookmark-job"]);
  assert.deepEqual(input.map((item) => item.id), ["bookmark-job", "bookmark-activity", "bookmark-content"]);
});
