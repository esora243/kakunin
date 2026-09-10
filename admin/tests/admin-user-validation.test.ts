import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { createAdminUser, normalizeAdminEmail, removeAdminUserFromList, setAdminUserActive, updateAdminUserRole } from "../lib/admin-users";
import { createActivity, pickActivityInputFields, updateActivity } from "../lib/activities";
import { assertJobApplyReady, createJob, pickJobInputFields, updateJob } from "../lib/jobs";
import { ConflictError, ForbiddenError, ValidationError } from "../lib/errors";
import type { AdminIdentity } from "../lib/auth/types";

type QueryResponse = { rows: unknown[] } | { error: Error };

function fakeClient(responses: QueryResponse[]) {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      const response = responses.shift();
      if (!response) throw new Error("unexpected query");
      if ("error" in response) throw response.error;
      return response;
    },
  } as unknown as PoolClient;
  return { client, calls };
}

function fakeClientThrowing(error: Error & { code?: string; constraint?: string }) {
  return {
    client: {
      query: async () => {
        throw error;
      },
    } as unknown as PoolClient,
  };
}

function ownerIdentity(overrides: Partial<AdminIdentity> = {}): AdminIdentity {
  return { adminId: "admin-1", email: "owner@example.com", role: "owner", isActive: true, ...overrides };
}

test("normalizeAdminEmail trims, lowercases, and validates email addresses", () => {
  assert.equal(normalizeAdminEmail(" Owner@Example.COM "), "owner@example.com");
  assert.throws(() => normalizeAdminEmail("not-an-email"), ValidationError);
});

test("createAdminUser normalizes email before insert and maps duplicate emails to ConflictError", async () => {
  const { client, calls } = fakeClient([
    { rows: [] },
    { rows: [{ id: "admin-2", email: "owner@example.com", role: "editor", is_active: true, created_at: "now", updated_at: "now", created_by_admin_id: "admin-1" }] },
  ]);
  await createAdminUser(client, { email: " Owner@Example.COM ", role: "editor" }, "admin-1");
  assert.equal((calls[0]?.values?.[0] as string) ?? "", "owner@example.com");

  const duplicate = fakeClient([
    { rows: [] },
    { error: Object.assign(new Error("duplicate"), { code: "23505" as const }) },
  ]);
  await assert.rejects(
    () => createAdminUser(duplicate.client, { email: "owner@example.com", role: "editor" }, "admin-1"),
    (error) => error instanceof ConflictError && error.code === "admin_user_exists",
  );
});

test("createAdminUser restores a previously removed email", async () => {
  const removed = { id: "admin-2", email: "member@example.com", role: "editor", is_active: false, created_at: "now", updated_at: "now", created_by_admin_id: "admin-1" };
  const restored = { ...removed, role: "owner", is_active: true };
  const { client, calls } = fakeClient([{ rows: [removed] }, { rows: [restored] }]);

  const result = await createAdminUser(client, { email: "member@example.com", role: "owner" }, "admin-1");

  assert.equal(result.role, "owner");
  assert.match(calls[1]?.text ?? "", /deleted_at = null/);
});

test("removeAdminUserFromList only removes inactive non-self rows", async () => {
  const inactive = { id: "admin-2", email: "member@example.com", role: "editor", is_active: false, created_at: "now", updated_at: "now", created_by_admin_id: "admin-1" };
  const { client, calls } = fakeClient([{ rows: [inactive] }, { rows: [] }]);
  await removeAdminUserFromList(client, "admin-2", ownerIdentity());
  assert.match(calls[1]?.text ?? "", /set deleted_at = now\(\)/);

  await assert.rejects(
    () => removeAdminUserFromList(fakeClient([{ rows: [{ ...inactive, is_active: true }] }]).client, "admin-2", ownerIdentity()),
    (error) => error instanceof ConflictError && error.code === "admin_user_still_active",
  );
  await assert.rejects(
    () => removeAdminUserFromList(fakeClient([]).client, "admin-1", ownerIdentity()),
    ForbiddenError,
  );
});

test("owner guardrails block self-demotion and self-deactivation", async () => {
  const client = fakeClient([]).client;
  await assert.rejects(
    () => updateAdminUserRole(client, "admin-1", "editor", ownerIdentity({ adminId: "admin-1" })),
    ForbiddenError,
  );
  await assert.rejects(
    () => setAdminUserActive(client, "admin-1", false, ownerIdentity({ adminId: "admin-1" })),
    ForbiddenError,
  );
});

test("last active owner guardrails block removing the final owner", async () => {
  const baseRow = {
    id: "admin-2",
    email: "other@example.com",
    role: "owner",
    is_active: true,
    created_at: "2026-07-08T00:00:00.000Z",
    updated_at: "2026-07-08T00:00:00.000Z",
    created_by_admin_id: "admin-1",
  };
  const { client } = fakeClient([
    { rows: [baseRow] },
    { rows: [{ count: "0" }] },
  ]);
  await assert.rejects(
    () => updateAdminUserRole(client, "admin-2", "editor", ownerIdentity({ adminId: "admin-3" })),
    (error) => error instanceof ConflictError && error.code === "last_owner_required",
  );
});

test("pickJobInputFields and pickActivityInputFields accept slug fields that are validated in production helpers", () => {
  assert.equal(pickJobInputFields({
    title: "Job",
    jobCategoryId: "cat",
    employmentTypeId: "type",
    slug: "job-1",
  }).slug, "job-1");
  assert.equal(pickActivityInputFields({
    title: "Event",
    kind: "event",
    hostName: "Host",
    actionType: "apply",
    slug: "event-1",
  }).slug, "event-1");
});

test("job publishing requires a valid job-specific HTTPS apply URL", () => {
  assert.doesNotThrow(() => assertJobApplyReady("https://jobs.example.test/apply/123"));
  for (const value of [
    null,
    "",
    "http://jobs.example.test/apply",
    "not a url",
    "https://user:password@jobs.example.test/apply",
    "https://%zz",
    "https://jobs.example.test:0/apply",
    "https://jobs.example.test:99999/apply",
    "https://999.999.999.999/apply",
    "https://1.2.3.999/apply",
  ]) {
    assert.throws(() => assertJobApplyReady(value), ValidationError);
  }
});

test("job and activity helpers validate slugs and map duplicate slug conflicts", async () => {
  const jobCreate = fakeClientThrowing(Object.assign(new Error("duplicate"), {
    code: "23505" as const,
    constraint: "jobs_external_source_external_id_key",
  }));
  const jobInput = pickJobInputFields({
    title: "Job",
    jobCategoryId: "cat",
    employmentTypeId: "type",
    slug: "job-1",
  });
  await assert.rejects(
    () => createJob(jobCreate.client, jobInput, "admin-1"),
    (error) => error instanceof ConflictError && error.code === "external_id_conflict",
  );
  const jobSlugDuplicate = fakeClientThrowing(Object.assign(new Error("duplicate"), {
    code: "23505" as const,
    constraint: "jobs_slug_unique_idx",
  }));
  await assert.rejects(
    () =>
      createJob(
        jobSlugDuplicate.client,
        {
          title: "Job",
          jobCategoryId: "cat",
          employmentTypeId: "type",
          slug: "job-1",
        } as Parameters<typeof createJob>[1],
        "admin-1",
      ),
    (error) => error instanceof ConflictError && error.code === "slug_conflict",
  );
  await assert.rejects(
    () =>
      createJob(
        fakeClient([]).client,
        {
          title: "Job",
          jobCategoryId: "cat",
          employmentTypeId: "type",
          slug: "Bad Slug",
        } as Parameters<typeof createJob>[1],
        "admin-1",
      ),
    ValidationError,
  );

  const activityCreate = fakeClientThrowing(Object.assign(new Error("duplicate"), {
    code: "23505" as const,
    constraint: "activities_slug_unique_idx",
  }));
  const activityInput = pickActivityInputFields({
    title: "Event",
    kind: "event",
    hostName: "Host",
    actionType: "apply",
    slug: "event-1",
  });
  await assert.rejects(
    () => createActivity(activityCreate.client, activityInput, "admin-1"),
    (error) => error instanceof ConflictError && error.code === "slug_conflict",
  );
  await assert.rejects(
    () =>
      createActivity(
        fakeClient([]).client,
        {
          title: "Event",
          kind: "event",
          hostName: "Host",
          actionType: "apply",
          slug: "Bad Slug",
        } as Parameters<typeof createActivity>[1],
        "admin-1",
      ),
    ValidationError,
  );
});

test("job and activity update helpers validate slug changes", async () => {
  const jobClient = fakeClient([
    {
      rows: [
        {
          id: "job-1",
          title: "Job",
          location_pref: null,
          company_name: null,
          is_active: true,
          published_at: null,
          updated_at: "2026-07-08T00:00:00.000Z",
          job_category_name: "Cat",
          employment_type_name: "Type",
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
          slug: "job-1",
          apply_url: null,
          source_last_modified_at: null,
          synced_at: "2026-07-08T00:00:00.000Z",
          created_at: "2026-07-08T00:00:00.000Z",
          university_name: null,
          job_category_id: "cat",
          employment_type_id: "type",
          university_id: null,
        },
      ],
    },
    { rows: [] },
  ]);
  await assert.rejects(
    () =>
      updateJob(
        jobClient.client,
        "job-1",
        { title: "Job", jobCategoryId: "cat", employmentTypeId: "type", slug: "Bad Slug" } as Parameters<typeof updateJob>[2],
        "admin-1",
      ),
    ValidationError,
  );
  const jobDuplicate = fakeClient([
    {
      rows: [
        {
          id: "job-1",
          title: "Job",
          location_pref: null,
          company_name: null,
          is_active: true,
          published_at: null,
          updated_at: "2026-07-08T00:00:00.000Z",
          job_category_name: "Cat",
          employment_type_name: "Type",
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
          slug: "job-1",
          apply_url: null,
          source_last_modified_at: null,
          synced_at: "2026-07-08T00:00:00.000Z",
          created_at: "2026-07-08T00:00:00.000Z",
          university_name: null,
          job_category_id: "cat",
          employment_type_id: "type",
          university_id: null,
        },
      ],
    },
    { error: Object.assign(new Error("duplicate"), { code: "23505" as const, constraint: "jobs_slug_unique_idx" }) },
  ]);
  await assert.rejects(
    () =>
      updateJob(
        jobDuplicate.client,
        "job-1",
        pickJobInputFields({ title: "Job", jobCategoryId: "cat", employmentTypeId: "type", slug: "job-2" }),
        "admin-1",
    ),
    (error) => error instanceof ConflictError && error.code === "slug_conflict",
  );
  const jobExternalDuplicate = fakeClient([
    {
      rows: [
        {
          id: "job-1",
          title: "Job",
          location_pref: null,
          company_name: null,
          is_active: true,
          published_at: null,
          updated_at: "2026-07-08T00:00:00.000Z",
          job_category_name: "Cat",
          employment_type_name: "Type",
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
          slug: "job-1",
          apply_url: null,
          source_last_modified_at: null,
          synced_at: "2026-07-08T00:00:00.000Z",
          created_at: "2026-07-08T00:00:00.000Z",
          university_name: null,
          job_category_id: "cat",
          employment_type_id: "type",
          university_id: null,
        },
      ],
    },
    { error: Object.assign(new Error("duplicate"), { code: "23505" as const, constraint: "jobs_external_source_external_id_key" }) },
  ]);
  await assert.rejects(
    () =>
      updateJob(
        jobExternalDuplicate.client,
        "job-1",
        pickJobInputFields({
          title: "Job",
          jobCategoryId: "cat",
          employmentTypeId: "type",
          externalSource: "admin",
          externalId: "ext-2",
          slug: "job-2",
        }),
        "admin-1",
      ),
    (error) => error instanceof ConflictError && error.code === "external_id_conflict",
  );

  const activityClient = fakeClient([
    {
      rows: [
        {
          id: "activity-1",
          title: "Event",
          host_name: "Host",
          action_type: "apply",
          location_pref: null,
          deadline_at: null,
          is_active: true,
          published_at: null,
          updated_at: "2026-07-08T00:00:00.000Z",
          kind_name: "Kind",
          slug: "event-1",
          kind: "event",
          summary: null,
          description_md: null,
          action_url: null,
          target_audience: null,
          location_detail: null,
          starts_at: null,
          ends_at: null,
          capacity_display: null,
          requirements_json: [],
          benefits_json: [],
          source_name: null,
          source_url: null,
          source_last_modified_at: null,
          synced_at: "2026-07-08T00:00:00.000Z",
          created_at: "2026-07-08T00:00:00.000Z",
        },
      ],
    },
    { rows: [] },
  ]);
  await assert.rejects(
    () =>
      updateActivity(
        activityClient.client,
        "activity-1",
        {
          title: "Event",
          kind: "event",
          hostName: "Host",
          actionType: "apply",
          slug: "Bad Slug",
        } as Parameters<typeof updateActivity>[2],
        "admin-1",
      ),
    ValidationError,
  );
  const activityDuplicate = fakeClient([
    {
      rows: [
        {
          id: "activity-1",
          title: "Event",
          host_name: "Host",
          action_type: "apply",
          location_pref: null,
          deadline_at: null,
          is_active: true,
          published_at: null,
          updated_at: "2026-07-08T00:00:00.000Z",
          kind_name: "Kind",
          slug: "event-1",
          kind: "event",
          summary: null,
          description_md: null,
          action_url: null,
          target_audience: null,
          location_detail: null,
          starts_at: null,
          ends_at: null,
          capacity_display: null,
          requirements_json: [],
          benefits_json: [],
          source_name: null,
          source_url: null,
          source_last_modified_at: null,
          synced_at: "2026-07-08T00:00:00.000Z",
          created_at: "2026-07-08T00:00:00.000Z",
        },
      ],
    },
    { error: Object.assign(new Error("duplicate"), { code: "23505" as const, constraint: "activities_slug_unique_idx" }) },
  ]);
  await assert.rejects(
    () =>
      updateActivity(
        activityDuplicate.client,
        "activity-1",
        pickActivityInputFields({
          title: "Event",
          kind: "event",
          hostName: "Host",
          actionType: "apply",
          slug: "event-2",
        }),
        "admin-1",
      ),
    (error) => error instanceof ConflictError && error.code === "slug_conflict",
  );
});
