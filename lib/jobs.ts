import type { JobDetailDto, JobListItemDto } from "./job-dto";
import { normalizeExternalHttpsUrl } from "./security/url";

type RelationRow = { code: string; name: string };

export type JobRow = {
  id: string;
  slug: string | null;
  title: string;
  location_pref: string | null;
  location_detail: string | null;
  summary: string | null;
  description_md: string | null;
  published_at: string | null;
  salary_min: number | null;
  salary_display: string | null;
  work_schedule: string | null;
  company_name: string | null;
  company_type: string | null;
  requirements_summary: string | null;
  requirements_list: unknown;
  benefits: unknown;
  apply_url: string | null;
  external_source: string;
  external_id: string;
  external_slug: string | null;
  source_last_modified_at: string | null;
  synced_at: string;
  job_categories: RelationRow | null;
  employment_types: RelationRow | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function mapJobListItem(row: JobRow, isSaved = false): JobListItemDto {
  return {
    id: row.id,
    slug: row.slug ?? row.id,
    title: row.title,
    category: { code: row.job_categories?.code ?? "other", name: row.job_categories?.name ?? "その他" },
    employmentType: { code: row.employment_types?.code ?? "other", name: row.employment_types?.name ?? "その他" },
    prefecture: row.location_pref,
    location: row.location_detail ?? row.location_pref,
    salaryMin: row.salary_min,
    salaryDisplay: row.salary_display,
    schedule: row.work_schedule,
    companyName: row.company_name,
    companyType: row.company_type,
    requirements: row.requirements_summary,
    summary: row.summary,
    publishedAt: row.published_at,
    isSaved,
  };
}

function mapJobDetail(row: JobRow, isSaved = false): JobDetailDto {
  return {
    ...mapJobListItem(row, isSaved),
    description: row.description_md,
    requirementsList: asStringArray(row.requirements_list),
    benefits: asStringArray(row.benefits),
    applyUrl: normalizeExternalHttpsUrl(row.apply_url),
    source: {
      externalSource: row.external_source,
      externalId: row.external_id,
      externalSlug: row.external_slug,
      sourceLastModifiedAt: row.source_last_modified_at,
      syncedAt: row.synced_at,
    },
  };
}

export type JobFilters = {
  q?: string;
  category?: string;
  employmentType?: string;
  prefecture?: string;
  salaryMin?: number;
};

function matchesFilters(job: JobListItemDto, filters: JobFilters) {
  if (filters.q) {
    const query = filters.q.trim().toLowerCase();
    const searchableText = [job.title, job.companyName, job.location, job.category.name, job.summary]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!searchableText.includes(query)) return false;
  }
  if (filters.category && job.category.code !== filters.category && job.category.name !== filters.category) return false;
  if (filters.employmentType && job.employmentType.code !== filters.employmentType && job.employmentType.name !== filters.employmentType) return false;
  if (filters.prefecture && job.prefecture !== filters.prefecture) return false;
  if (typeof filters.salaryMin === "number" && (job.salaryMin ?? 0) < filters.salaryMin) return false;
  return true;
}

async function fetchActiveJobRows() {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<JobRow>(`
    select
      j.id::text,
      j.slug,
      j.title,
      j.location_pref,
      j.location_detail,
      j.summary,
      j.description_md,
      j.published_at::text,
      j.salary_min,
      j.salary_display,
      j.work_schedule,
      j.company_name,
      j.company_type,
      j.requirements_summary,
      j.requirements_list,
      j.benefits,
      j.apply_url,
      j.external_source,
      j.external_id,
      j.external_slug,
      j.source_last_modified_at::text,
      j.synced_at::text,
      json_build_object('code', jc.code, 'name', jc.name) as job_categories,
      json_build_object('code', et.code, 'name', et.name) as employment_types
    from jobs j
    join job_categories jc on jc.id = j.job_category_id
    join employment_types et on et.id = j.employment_type_id
    where j.is_active = true
      and j.published_at is not null
      and j.published_at <= now()
    order by j.published_at desc nulls last
  `);
  return rows;
}

export async function getActiveJobRowById(jobId: string) {
  const { dbQuery } = await import("./db/postgres");
  const { rows } = await dbQuery<JobRow>(
    `
      select
        j.id::text,
        j.slug,
        j.title,
        j.location_pref,
        j.location_detail,
        j.summary,
        j.description_md,
        j.published_at::text,
        j.salary_min,
        j.salary_display,
        j.work_schedule,
        j.company_name,
        j.company_type,
        j.requirements_summary,
        j.requirements_list,
        j.benefits,
        j.apply_url,
        j.external_source,
        j.external_id,
        j.external_slug,
        j.source_last_modified_at::text,
        j.synced_at::text,
        json_build_object('code', jc.code, 'name', jc.name) as job_categories,
        json_build_object('code', et.code, 'name', et.name) as employment_types
      from jobs j
      join job_categories jc on jc.id = j.job_category_id
      join employment_types et on et.id = j.employment_type_id
      where j.id = $1
        and j.is_active = true
        and j.published_at is not null
        and j.published_at <= now()
      limit 1
    `,
    [jobId],
  );
  return rows[0] ?? null;
}

export async function listJobs(filters: JobFilters = {}) {
  const rows = await fetchActiveJobRows();
  return filterJobListItems(rows.map((row) => mapJobListItem(row)), filters);
}

export function findJobRowByPublicSlug(rows: JobRow[], slug: string) {
  return rows.find((item) => item.slug === slug) ?? rows.find((item) => item.slug === null && item.id === slug);
}

export async function getJobBySlug(slug: string) {
  const rows = await fetchActiveJobRows();
  const row = findJobRowByPublicSlug(rows, slug);
  return row ? mapJobDetail(row) : null;
}

export function filterJobListItems(jobs: JobListItemDto[], filters: JobFilters = {}) {
  return jobs.filter((job) => matchesFilters(job, filters));
}
