import assert from "node:assert/strict";
import test from "node:test";
import { createActivity, type ActivityInput } from "../lib/activities";
import { updateJob, type JobInput } from "../lib/jobs";
import { ValidationError } from "../lib/errors";

function jobRow() {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Test job",
    location_pref: null,
    company_name: null,
    is_active: true,
    published_at: null,
    updated_at: "2026-07-08T00:00:00.000Z",
    job_category_name: "Category",
    employment_type_name: "Full time",
    external_source: "admin",
    external_id: "ext-1",
    external_slug: null,
    location_detail: null,
    summary: null,
    description_md: null,
    company_type: null,
    salary_min: null,
    salary_display: null,
    work_schedule: null,
    requirements_summary: null,
    requirements_list: [],
    benefits: [],
    slug: "test-job",
    apply_url: null,
    source_last_modified_at: null,
    synced_at: "2026-07-08T00:00:00.000Z",
    created_at: "2026-07-08T00:00:00.000Z",
    university_name: null,
    job_category_id: "22222222-2222-2222-2222-222222222222",
    employment_type_id: "33333333-3333-3333-3333-333333333333",
    university_id: null,
  };
}

test("updateJob maps foreign key errors to ValidationError", async () => {
  const client = {
    query: async (_sql: string, params: unknown[]) => {
      if (params.length === 1) {
        return { rows: [jobRow()] };
      }
      const err = new Error("fk");
      (err as { code?: string }).code = "23503";
      throw err;
    },
  } as never;

  const input: JobInput = {
    title: "Test job",
    jobCategoryId: "22222222-2222-2222-2222-222222222222",
    employmentTypeId: "33333333-3333-3333-3333-333333333333",
  };

  await assert.rejects(
    () => updateJob(client, "11111111-1111-1111-1111-111111111111", input, "admin-1"),
    (error) => error instanceof ValidationError && error.code === "invalid_foreign_key",
  );
});

test("createActivity maps foreign key errors to ValidationError", async () => {
  const client = {
    query: async () => {
      const err = new Error("fk");
      (err as { code?: string }).code = "23503";
      throw err;
    },
  } as never;

  const input: ActivityInput = {
    slug: "test-activity",
    kind: "event",
    title: "Test activity",
    hostName: "Host",
    actionType: "apply",
  };

  await assert.rejects(
    () => createActivity(client, input, "admin-1"),
    (error) => error instanceof ValidationError && error.code === "invalid_foreign_key",
  );
});
