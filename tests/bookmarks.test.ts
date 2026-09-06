import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { mapBookmarkRowToDto } from "../lib/bookmark-requests";
import type { JobRow } from "../lib/jobs";

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    slug: "sample-job",
    title: "Sample Job",
    location_pref: "静岡県",
    location_detail: "浜松市",
    summary: "Summary",
    description_md: "Description",
    published_at: "2026-05-01T00:00:00.000Z",
    salary_min: 1200,
    salary_display: "時給1,200円",
    work_schedule: "週1日",
    company_name: "Sample Clinic",
    company_type: "clinic",
    requirements_summary: "医学部生",
    requirements_list: ["医学部生"],
    benefits: ["交通費支給"],
    apply_url: "https://example.com/apply",
    external_source: "cms",
    external_id: "external-1",
    external_slug: "sample-job",
    source_last_modified_at: null,
    synced_at: "2026-05-01T00:00:00.000Z",
    job_categories: { code: "clinical", name: "臨床" },
    employment_types: { code: "part_time", name: "アルバイト" },
    ...overrides,
  };
}

test("bookmark SQL stays scoped to active users and active published job bookmarks", () => {
  const bookmarks = readFileSync(join(process.cwd(), "lib/bookmarks.ts"), "utf8");
  const jobs = readFileSync(join(process.cwd(), "lib/jobs.ts"), "utf8");

  assert.match(bookmarks, /deactivated_at is null/);
  assert.match(bookmarks, /b\.user_id = \$1/);
  assert.match(bookmarks, /from job_bookmarks b/);
  assert.match(bookmarks, /j\.is_active = true/);
  assert.match(bookmarks, /j\.published_at is not null/);
  assert.match(bookmarks, /j\.published_at <= now\(\)/);
  assert.match(bookmarks, /from activity_bookmarks b/);
  assert.match(bookmarks, /a\.is_active = true/);
  assert.match(bookmarks, /a\.published_at is not null/);
  assert.match(bookmarks, /a\.published_at <= now\(\)/);
  assert.match(bookmarks, /from content_bookmarks b/);
  assert.match(bookmarks, /c\.is_active = true/);
  assert.match(bookmarks, /c\.published_at is not null/);
  assert.match(bookmarks, /c\.published_at <= now\(\)/);
  assert.match(jobs, /where j\.id = \$1/);
  assert.match(jobs, /and j\.is_active = true/);
  assert.match(jobs, /and j\.published_at is not null/);
  assert.match(jobs, /and j\.published_at <= now\(\)/);
  assert.match(jobs, /normalizeExternalHttpsUrl\(row\.apply_url\)/);
});

test("bookmark delete does not require the job to remain publicly bookmarkable", () => {
  const implementation = readFileSync(join(process.cwd(), "lib/bookmarks.ts"), "utf8");
  const deleteFunction = implementation.match(/export async function deleteJobBookmarkForSession[\s\S]*?\n}/)?.[0] ?? "";

  assert.doesNotMatch(deleteFunction, /getActivePublishedJob/);
  assert.match(deleteFunction, /delete from job_bookmarks/);
  assert.doesNotMatch(deleteFunction, /content_type/);
});

test("bookmark rows map to saved job DTOs", () => {
  const dto = mapBookmarkRowToDto({ id: "bookmark-1", created_at: "2026-05-10T00:00:00.000Z", jobs: jobRow() });

  assert.deepEqual(dto, {
    id: "bookmark-1",
    type: "job",
    savedAt: "2026-05-10T00:00:00.000Z",
    job: {
      id: "job-1",
      slug: "sample-job",
      title: "Sample Job",
      category: { code: "clinical", name: "臨床" },
      employmentType: { code: "part_time", name: "アルバイト" },
      prefecture: "静岡県",
      location: "浜松市",
      salaryMin: 1200,
      salaryDisplay: "時給1,200円",
      schedule: "週1日",
      companyName: "Sample Clinic",
      companyType: "clinic",
      requirements: "医学部生",
      summary: "Summary",
      publishedAt: "2026-05-01T00:00:00.000Z",
      isSaved: true,
    },
  });
});

test("bookmark routes require a session before personal data access", () => {
  const listRoute = readFileSync(join(process.cwd(), "app/api/me/bookmarks/route.ts"), "utf8");
  const itemRoute = readFileSync(join(process.cwd(), "app/api/me/bookmarks/jobs/[jobId]/route.ts"), "utf8");
  const activityRoute = readFileSync(join(process.cwd(), "app/api/me/bookmarks/activities/[activityId]/route.ts"), "utf8");
  const contentRoute = readFileSync(join(process.cwd(), "app/api/me/bookmarks/contents/[contentId]/route.ts"), "utf8");

  assert.match(listRoute, /sessionJsonRoute/);
  assert.match(listRoute, /listBookmarksForSession/);
  assert.match(itemRoute, /guardedSessionJsonRoute/);
  assert.match(itemRoute, /saveJobBookmarkForSession/);
  assert.match(itemRoute, /Job is not bookmarkable/);
  assert.match(activityRoute, /guardedSessionJsonRoute/);
  assert.match(activityRoute, /saveActivityBookmarkForSession/);
  assert.match(contentRoute, /guardedSessionJsonRoute/);
  assert.match(contentRoute, /saveContentBookmarkForSession/);
});

test("bookmark mutation routes preserve POST not-found and DELETE idempotency contracts", () => {
  const jobRoute = readFileSync(join(process.cwd(), "app/api/me/bookmarks/jobs/[jobId]/route.ts"), "utf8");

  assert.match(jobRoute, /notFoundResult\("Job is not bookmarkable"\)/);
  assert.match(jobRoute, /\{ body: \{ ok: true, saved: false \} \}/);
});
