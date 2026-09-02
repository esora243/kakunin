import assert from "node:assert/strict";
import test from "node:test";
import { findJobRowByPublicSlug, mapJobListItem, type JobRow } from "../lib/jobs";

function jobRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: "job-1",
    slug: "sample-job",
    title: "Sample Job",
    location_pref: null,
    location_detail: null,
    summary: null,
    description_md: null,
    published_at: "2026-08-01T00:00:00.000Z",
    salary_min: null,
    salary_display: null,
    work_schedule: null,
    company_name: null,
    company_type: null,
    requirements_summary: null,
    requirements_list: null,
    benefits: null,
    apply_url: null,
    external_source: "cms",
    external_id: "external-1",
    external_slug: null,
    source_last_modified_at: null,
    synced_at: "2026-08-01T00:00:00.000Z",
    job_categories: { code: "other", name: "その他" },
    employment_types: { code: "other", name: "その他" },
    ...overrides,
  };
}

test("job detail lookup accepts the list URL fallback for a job without a slug", () => {
  const row = jobRow({ id: "job-without-slug", slug: null });

  assert.equal(mapJobListItem(row).slug, "job-without-slug");
  assert.equal(findJobRowByPublicSlug([row], "job-without-slug"), row);
});

test("job detail lookup does not expose a job id as an alias when it has a slug", () => {
  const row = jobRow({ id: "job-1", slug: "canonical-job" });

  assert.equal(findJobRowByPublicSlug([row], "job-1"), undefined);
  assert.equal(findJobRowByPublicSlug([row], "canonical-job"), row);
});

test("canonical job slugs take precedence over a null-slug id fallback", () => {
  const fallbackRow = jobRow({ id: "canonical-job", slug: null });
  const canonicalRow = jobRow({ id: "job-2", slug: "canonical-job" });

  assert.equal(findJobRowByPublicSlug([fallbackRow, canonicalRow], "canonical-job"), canonicalRow);
});
