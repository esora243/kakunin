import type { JobDetailDto, JobListItemDto } from "@/lib/job-dto";
import { supabaseRestFetch } from "@/lib/supabase/rest";

type RelationRow = { code: string; name: string };

type JobRow = {
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

const JOB_SELECT = [
  "id",
  "slug",
  "title",
  "location_pref",
  "location_detail",
  "summary",
  "description_md",
  "published_at",
  "salary_min",
  "salary_display",
  "work_schedule",
  "company_name",
  "company_type",
  "requirements_summary",
  "requirements_list",
  "benefits",
  "apply_url",
  "external_source",
  "external_id",
  "external_slug",
  "source_last_modified_at",
  "synced_at",
  "job_categories(code,name)",
  "employment_types(code,name)",
].join(",");

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

export function mapJobDetail(row: JobRow, isSaved = false): JobDetailDto {
  return {
    ...mapJobListItem(row, isSaved),
    description: row.description_md,
    requirementsList: asStringArray(row.requirements_list),
    benefits: asStringArray(row.benefits),
    applyUrl: row.apply_url,
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
  const params = new URLSearchParams({
    select: JOB_SELECT,
    is_active: "eq.true",
    or: `(published_at.is.null,published_at.lte.${new Date().toISOString()})`,
    order: "published_at.desc.nullslast",
  });
  return supabaseRestFetch<JobRow[]>({ path: `jobs?${params.toString()}` });
}

export async function listJobs(filters: JobFilters = {}) {
  const rows = await fetchActiveJobRows();
  return rows.map((row) => mapJobListItem(row)).filter((job) => matchesFilters(job, filters));
}

export async function getJobBySlugOrId(slugOrId: string) {
  const rows = await fetchActiveJobRows();
  const row = rows.find((item) => item.slug === slugOrId || item.id === slugOrId);
  return row ? mapJobDetail(row) : null;
}
