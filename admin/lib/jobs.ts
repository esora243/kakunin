import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { writeAuditLog } from "./audit";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { timestampsMatch } from "./concurrency";
import { assertValidSlug } from "./slug";

export type JobListRow = {
  id: string;
  title: string;
  location_pref: string | null;
  company_name: string | null;
  is_active: boolean;
  published_at: string | null;
  updated_at: string;
  job_category_name: string;
  employment_type_name: string;
};

export type JobDetailRow = JobListRow & {
  external_source: string;
  external_id: string;
  external_slug: string | null;
  location_detail: string | null;
  summary: string | null;
  description_md: string | null;
  company_type: string | null;
  salary_min: number | null;
  salary_display: string | null;
  work_schedule: string | null;
  requirements_summary: string | null;
  requirements_list: unknown;
  benefits: unknown;
  slug: string | null;
  apply_url: string | null;
  source_last_modified_at: string | null;
  synced_at: string;
  created_at: string;
  university_name: string | null;
  job_category_id: string;
  employment_type_id: string;
  university_id: string | null;
};

export type JobRowFilters = {
  q?: string;
  jobCategoryId?: string;
  employmentTypeId?: string;
  universityId?: string;
};

export type JobInput = {
  title: string;
  jobCategoryId: string;
  employmentTypeId: string;
  universityId?: string | null;
  locationPref?: string | null;
  locationDetail?: string | null;
  summary?: string | null;
  descriptionMd?: string | null;
  companyName?: string | null;
  companyType?: string | null;
  salaryMin?: number | null;
  salaryDisplay?: string | null;
  workSchedule?: string | null;
  requirementsSummary?: string | null;
  requirementsList?: string[];
  benefits?: string[];
  slug?: string | null;
  applyUrl?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  externalSlug?: string | null;
};

const LIST_SELECT = `
  select
    j.id::text,
    j.title,
    j.location_pref,
    j.company_name,
    j.is_active,
    j.published_at::text,
    j.updated_at::text,
    jc.name as job_category_name,
    et.name as employment_type_name
  from jobs j
  join job_categories jc on jc.id = j.job_category_id
  join employment_types et on et.id = j.employment_type_id
`;

export async function listJobRows(filters: JobRowFilters = {}): Promise<JobListRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const q = typeof filters.q === "string" ? filters.q.trim() : "";

  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(j.title ilike $${values.length} or j.company_name ilike $${values.length})`);
  }
  if (filters.jobCategoryId) {
    values.push(filters.jobCategoryId);
    conditions.push(`j.job_category_id = $${values.length}`);
  }
  if (filters.employmentTypeId) {
    values.push(filters.employmentTypeId);
    conditions.push(`j.employment_type_id = $${values.length}`);
  }
  if (filters.universityId) {
    values.push(filters.universityId);
    conditions.push(`j.university_id = $${values.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await dbQuery<JobListRow>(
    `${LIST_SELECT} ${where} order by j.updated_at desc limit 200`,
    values,
  );
  return rows;
}

export async function getJobRowById(id: string): Promise<JobDetailRow | null> {
  const { rows } = await dbQuery<JobDetailRow>(
    `
      select
        j.id::text,
        j.title,
        j.location_pref,
        j.company_name,
        j.is_active,
        j.published_at::text,
        j.updated_at::text,
        jc.name as job_category_name,
        et.name as employment_type_name,
        j.external_source,
        j.external_id,
        j.external_slug,
        j.location_detail,
        j.summary,
        j.description_md,
        j.company_type,
        j.salary_min,
        j.salary_display,
        j.work_schedule,
        j.requirements_summary,
        j.requirements_list,
        j.benefits,
        j.slug,
        j.apply_url,
        j.source_last_modified_at::text,
        j.synced_at::text,
        j.created_at::text,
        u.name as university_name,
        j.job_category_id::text,
        j.employment_type_id::text,
        j.university_id::text
      from jobs j
      join job_categories jc on jc.id = j.job_category_id
      join employment_types et on et.id = j.employment_type_id
      left join universities u on u.id = j.university_id
      where j.id = $1
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireString(value: unknown, message: string): string {
  const trimmed = stringOrNull(value);
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

function optionalUrl(value: unknown, field: string): string | null {
  const url = stringOrNull(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const dnsHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    const numericHostname = /^[0-9]+(?:\.[0-9]+)*$/;
    const port = parsed.port ? Number(parsed.port) : null;
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || !dnsHostname.test(parsed.hostname)
      || numericHostname.test(parsed.hostname)
      || (port !== null && (!Number.isInteger(port) || port < 1 || port > 65_535))
    ) throw new Error();
    return parsed.toString();
  } catch {
    throw new ValidationError(`${field} must be an https URL`);
  }
}

export function assertJobApplyReady(applyUrl: string | null | undefined): void {
  if (!optionalUrl(applyUrl, "Apply URL")) {
    throw new ValidationError("A valid HTTPS apply URL is required before publishing", "apply_url_required");
  }
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

export function pickJobInputFields(body: Record<string, unknown>): JobInput {
  const salaryMinRaw = body.salaryMin;
  const salaryMin =
    salaryMinRaw === null || salaryMinRaw === undefined || salaryMinRaw === ""
      ? null
      : Number(salaryMinRaw);
  if (salaryMin !== null && (!Number.isInteger(salaryMin) || salaryMin < 0)) {
    throw new ValidationError("Salary minimum must be a non-negative integer");
  }

  return {
    title: requireString(body.title, "Title is required"),
    jobCategoryId: requireString(body.jobCategoryId, "Job category is required"),
    employmentTypeId: requireString(body.employmentTypeId, "Employment type is required"),
    universityId: stringOrNull(body.universityId),
    locationPref: stringOrNull(body.locationPref),
    locationDetail: stringOrNull(body.locationDetail),
    summary: stringOrNull(body.summary),
    descriptionMd: stringOrNull(body.descriptionMd),
    companyName: stringOrNull(body.companyName),
    companyType: stringOrNull(body.companyType),
    salaryMin,
    salaryDisplay: stringOrNull(body.salaryDisplay),
    workSchedule: stringOrNull(body.workSchedule),
    requirementsSummary: stringOrNull(body.requirementsSummary),
    requirementsList: optionalStringArray(body.requirementsList),
    benefits: optionalStringArray(body.benefits),
    slug: stringOrNull(body.slug),
    applyUrl: optionalUrl(body.applyUrl, "Apply URL"),
    externalSource: stringOrNull(body.externalSource),
    externalId: stringOrNull(body.externalId),
    externalSlug: stringOrNull(body.externalSlug),
  };
}

async function getJobRowByIdForUpdate(client: PoolClient, id: string): Promise<JobDetailRow | null> {
  const { rows } = await client.query<JobDetailRow>(
    `
      select
        j.id::text,
        j.title,
        j.location_pref,
        j.company_name,
        j.is_active,
        j.published_at::text,
        j.updated_at::text,
        jc.name as job_category_name,
        et.name as employment_type_name,
        j.external_source,
        j.external_id,
        j.external_slug,
        j.location_detail,
        j.summary,
        j.description_md,
        j.company_type,
        j.salary_min,
        j.salary_display,
        j.work_schedule,
        j.requirements_summary,
        j.requirements_list,
        j.benefits,
        j.slug,
        j.apply_url,
        j.source_last_modified_at::text,
        j.synced_at::text,
        j.created_at::text,
        u.name as university_name,
        j.job_category_id::text,
        j.employment_type_id::text,
        j.university_id::text
      from jobs j
      join job_categories jc on jc.id = j.job_category_id
      join employment_types et on et.id = j.employment_type_id
      left join universities u on u.id = j.university_id
      where j.id = $1
      for update of j
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function createJob(client: PoolClient, input: JobInput, actorAdminId: string): Promise<JobDetailRow> {
  if (input.slug) assertValidSlug(input.slug);
  const externalSource = input.externalSource ?? "admin";
  const externalId = input.externalId ?? `admin-${crypto.randomUUID()}`;
  let rows: { id: string }[];
  try {
    ({ rows } = await client.query<{ id: string }>(
      `
        insert into jobs (
          external_source, external_id, external_slug, title, job_category_id, employment_type_id, university_id,
          location_pref, location_detail, summary, description_md, company_name, company_type, salary_min,
          salary_display, work_schedule, requirements_summary, requirements_list, benefits, slug, apply_url,
          source_last_modified_at, synced_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20, $21, now(), now())
        returning id::text
      `,
      [
        externalSource,
        externalId,
        input.externalSlug,
        input.title,
        input.jobCategoryId,
        input.employmentTypeId,
        input.universityId,
        input.locationPref,
        input.locationDetail,
        input.summary,
        input.descriptionMd,
        input.companyName,
        input.companyType,
        input.salaryMin,
        input.salaryDisplay,
        input.workSchedule,
        input.requirementsSummary,
        JSON.stringify(input.requirementsList ?? []),
        JSON.stringify(input.benefits ?? []),
        input.slug,
        input.applyUrl,
      ],
    ));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw mapJobUniqueViolation(error);
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("Referenced job category, employment type, or university does not exist", "invalid_foreign_key");
    }
    throw error;
  }
  const after = await getJobRowByIdForUpdate(client, rows[0].id);
  if (!after) throw new NotFoundError("Job not found after create");
  await writeAuditLog(client, {
    actorAdminId,
    action: "job.create",
    resourceType: "jobs",
    resourceId: after.id,
    afterSnapshot: after,
  });
  return after;
}

export async function updateJob(
  client: PoolClient,
  id: string,
  input: JobInput,
  actorAdminId: string,
  expectedUpdatedAt?: string,
): Promise<{ before: JobDetailRow; after: JobDetailRow }> {
  const before = await getJobRowByIdForUpdate(client, id);
  if (!before) throw new NotFoundError("Job not found");
  if (before.is_active && before.published_at) assertJobApplyReady(input.applyUrl);
  if (expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  if (input.slug) assertValidSlug(input.slug);

  try {
    await client.query(
      `
        update jobs set
          title = $2,
          job_category_id = $3,
          employment_type_id = $4,
          university_id = $5,
          location_pref = $6,
          location_detail = $7,
          summary = $8,
          description_md = $9,
          company_name = $10,
          company_type = $11,
          salary_min = $12,
          salary_display = $13,
          work_schedule = $14,
          requirements_summary = $15,
          requirements_list = $16::jsonb,
          benefits = $17::jsonb,
          slug = $18,
          apply_url = $19,
          external_source = $20,
          external_id = $21,
          external_slug = $22,
          source_last_modified_at = now(),
          synced_at = now()
        where id = $1
      `,
      [
        id,
        input.title,
        input.jobCategoryId,
        input.employmentTypeId,
        input.universityId,
        input.locationPref,
        input.locationDetail,
        input.summary,
        input.descriptionMd,
        input.companyName,
        input.companyType,
        input.salaryMin,
        input.salaryDisplay,
        input.workSchedule,
        input.requirementsSummary,
        JSON.stringify(input.requirementsList ?? []),
        JSON.stringify(input.benefits ?? []),
        input.slug,
        input.applyUrl,
        input.externalSource ?? before.external_source,
        input.externalId ?? before.external_id,
        input.externalSlug,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw mapJobUniqueViolation(error);
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("Referenced job category, employment type, or university does not exist", "invalid_foreign_key");
    }
    throw error;
  }
  const after = await getJobRowByIdForUpdate(client, id);
  if (!after) throw new NotFoundError("Job not found after update");
  await writeAuditLog(client, {
    actorAdminId,
    action: "job.update",
    resourceType: "jobs",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { before, after };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23503";
}

function mapJobUniqueViolation(error: unknown): ConflictError {
  const constraint = typeof error === "object" && error !== null && "constraint" in error ? String((error as { constraint?: unknown }).constraint ?? "") : "";
  if (constraint === "jobs_slug_unique_idx") {
    return new ConflictError("Slug is already in use", "slug_conflict");
  }
  if (constraint === "jobs_external_source_external_id_key") {
    return new ConflictError("A job with this external source and external ID already exists", "external_id_conflict");
  }
  return new ConflictError("Job already exists", "job_conflict");
}

export async function setJobPublishState(
  client: PoolClient,
  id: string,
  action: "publish" | "unpublish" | "deactivate",
  actorAdminId: string,
  publishedAt: Date = new Date(),
): Promise<{ before: JobDetailRow; after: JobDetailRow }> {
  const before = await getJobRowByIdForUpdate(client, id);
  if (!before) throw new NotFoundError("Job not found");
  if (action === "publish") {
    assertJobApplyReady(before.apply_url);
    await client.query("update jobs set published_at = $2, is_active = true where id = $1", [id, publishedAt]);
  } else {
    const setClause = action === "unpublish" ? "published_at = null" : "is_active = false";
    await client.query(`update jobs set ${setClause} where id = $1`, [id]);
  }
  const after = await getJobRowByIdForUpdate(client, id);
  if (!after) throw new NotFoundError("Job not found after state change");
  await writeAuditLog(client, {
    actorAdminId,
    action: action === "publish" && publishedAt.getTime() > Date.now() ? "job.schedule_publish" : `job.${action}`,
    resourceType: "jobs",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { before, after };
}
