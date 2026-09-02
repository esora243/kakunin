import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { assertValidSlug } from "./slug";

// Master Data domain per docs/admin-management-app-spec.md "Master Data":
// owner-only edits for a small set of low-risk label tables, plus view-only
// reads for universities/clubs/specialties. No physical delete anywhere in
// this file. The hugmeid_admin_runtime grants match the launch depth per
// table (see cloudsql/migrations/20260730000002_runtime_access.sql):
//   - content_categories: select, insert, update
//   - activity_kinds, job_categories, employment_types: select, update only
//   - universities, clubs, specialties: select only

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "23505");
}

function requireNonEmpty(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

type MasterDataQuery = <T extends object>(
  text: string,
  values?: readonly unknown[],
) => Promise<{ rows: T[] }>;

type ListDependencies = { query?: MasterDataQuery };

// ---------------------------------------------------------------------------
// content_categories: create, rename, reorder, deactivate-if-unreferenced.
// ---------------------------------------------------------------------------

export type ContentCategoryRow = {
  code: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type ContentCategoryDbRow = {
  code: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const CONTENT_CATEGORY_COLUMNS = "code, name, display_order, is_active, created_at::text, updated_at::text";

function toContentCategoryRow(row: ContentCategoryDbRow): ContentCategoryRow {
  return {
    code: row.code,
    name: row.name,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listContentCategories(): Promise<ContentCategoryRow[]> {
  const { rows } = await dbQuery<ContentCategoryDbRow>(
    `select ${CONTENT_CATEGORY_COLUMNS} from content_categories order by display_order asc, code asc`,
  );
  return rows.map(toContentCategoryRow);
}

type ContentCategoryWithReferenceCountDbRow = ContentCategoryDbRow & { reference_count: string };

export type ContentCategoryWithReferenceCount = {
  category: ContentCategoryRow;
  referenceCount: number;
};

export async function listContentCategoriesWithReferenceCounts(
  dependencies: ListDependencies = {},
): Promise<ContentCategoryWithReferenceCount[]> {
  const query = dependencies.query ?? dbQuery;
  const { rows } = await query<ContentCategoryWithReferenceCountDbRow>(
    `select cc.code, cc.name, cc.display_order, cc.is_active,
            cc.created_at::text, cc.updated_at::text,
            count(c.id)::text as reference_count
     from content_categories cc
     left join contents c on c.category = cc.code and c.is_active = true
     group by cc.code, cc.name, cc.display_order, cc.is_active, cc.created_at, cc.updated_at
     order by cc.display_order asc, cc.code asc`,
  );
  return rows.map((row) => ({ category: toContentCategoryRow(row), referenceCount: Number(row.reference_count) }));
}

/** Reference-count guard shown in the UI before allowing a category change/deactivation. */
export async function countContentsByCategory(code: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*) as count from contents where category = $1 and is_active = true`,
    [code],
  );
  return Number(rows[0]?.count ?? 0);
}

export type CreateContentCategoryInput = { code: string; name: string; displayOrder?: number };

export async function createContentCategory(
  client: PoolClient,
  input: CreateContentCategoryInput,
  _actorAdminId: string,
): Promise<ContentCategoryRow> {
  const code = input.code.trim();
  assertValidSlug(code);
  const name = requireNonEmpty(input.name, "Name is required");
  const displayOrder = input.displayOrder ?? 0;

  try {
    const { rows } = await client.query<ContentCategoryDbRow>(
      `insert into content_categories (code, name, display_order)
       values ($1, $2, $3)
       returning ${CONTENT_CATEGORY_COLUMNS}`,
      [code, name, displayOrder],
    );
    return toContentCategoryRow(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A category with this code or name already exists", "category_exists");
    }
    throw error;
  }
}

export type UpdateContentCategoryPatch = { name?: string; displayOrder?: number; isActive?: boolean };

/**
 * Renames/reorders/(de)activates a category inside the caller's dbTransaction.
 * Blocks isActive:false while active Contents still reference the category,
 * per the spec's "cannot deactivate while referenced by active Contents" guardrail.
 */
export async function updateContentCategory(
  client: PoolClient,
  code: string,
  patch: UpdateContentCategoryPatch,
  _actorAdminId: string,
): Promise<{ before: ContentCategoryRow; after: ContentCategoryRow }> {
  const { rows: beforeRows } = await client.query<ContentCategoryDbRow>(
    `select ${CONTENT_CATEGORY_COLUMNS} from content_categories where code = $1 for update`,
    [code],
  );
  if (!beforeRows[0]) throw new NotFoundError("Content category not found");
  const before = toContentCategoryRow(beforeRows[0]);

  if (patch.isActive === false && before.isActive) {
    const { rows: countRows } = await client.query<{ count: string }>(
      `select count(*) as count from contents where category = $1 and is_active = true`,
      [code],
    );
    const referenced = Number(countRows[0]?.count ?? 0);
    if (referenced > 0) {
      throw new ConflictError(
        `Cannot deactivate: referenced by ${referenced} active Contents record(s)`,
        "category_referenced",
      );
    }
  }

  const name = patch.name !== undefined ? requireNonEmpty(patch.name, "Name is required") : before.name;
  const displayOrder = patch.displayOrder !== undefined ? patch.displayOrder : before.displayOrder;
  const isActive = patch.isActive !== undefined ? patch.isActive : before.isActive;

  try {
    const { rows } = await client.query<ContentCategoryDbRow>(
      `update content_categories set name = $2, display_order = $3, is_active = $4
       where code = $1
       returning ${CONTENT_CATEGORY_COLUMNS}`,
      [code, name, displayOrder, isActive],
    );
    return { before, after: toContentCategoryRow(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A category with this name already exists", "category_name_exists");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// activity_kinds: rename + reorder only. No create/deactivate/delete.
// ---------------------------------------------------------------------------

export type ActivityKindRow = {
  code: string;
  name: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ActivityKindDbRow = {
  code: string;
  name: string;
  display_order: number;
  created_at: string;
  updated_at: string;
};

const ACTIVITY_KIND_COLUMNS = "code, name, display_order, created_at::text, updated_at::text";

function toActivityKindRow(row: ActivityKindDbRow): ActivityKindRow {
  return {
    code: row.code,
    name: row.name,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listActivityKinds(): Promise<ActivityKindRow[]> {
  const { rows } = await dbQuery<ActivityKindDbRow>(
    `select ${ACTIVITY_KIND_COLUMNS} from activity_kinds order by display_order asc, code asc`,
  );
  return rows.map(toActivityKindRow);
}

type ActivityKindWithReferenceCountDbRow = ActivityKindDbRow & { reference_count: string };

export type ActivityKindWithReferenceCount = {
  activityKind: ActivityKindRow;
  referenceCount: number;
};

export async function listActivityKindsWithReferenceCounts(
  dependencies: ListDependencies = {},
): Promise<ActivityKindWithReferenceCount[]> {
  const query = dependencies.query ?? dbQuery;
  const { rows } = await query<ActivityKindWithReferenceCountDbRow>(
    `select ak.code, ak.name, ak.display_order,
            ak.created_at::text, ak.updated_at::text,
            count(a.id)::text as reference_count
     from activity_kinds ak
     left join activities a on a.kind = ak.code and a.is_active = true
     group by ak.code, ak.name, ak.display_order, ak.created_at, ak.updated_at
     order by ak.display_order asc, ak.code asc`,
  );
  return rows.map((row) => ({ activityKind: toActivityKindRow(row), referenceCount: Number(row.reference_count) }));
}

export async function countActivitiesByKind(code: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*) as count from activities where kind = $1 and is_active = true`,
    [code],
  );
  return Number(rows[0]?.count ?? 0);
}

export type UpdateActivityKindPatch = { name?: string; displayOrder?: number };

export async function updateActivityKind(
  client: PoolClient,
  code: string,
  patch: UpdateActivityKindPatch,
  _actorAdminId: string,
): Promise<{ before: ActivityKindRow; after: ActivityKindRow }> {
  const { rows: beforeRows } = await client.query<ActivityKindDbRow>(
    `select ${ACTIVITY_KIND_COLUMNS} from activity_kinds where code = $1 for update`,
    [code],
  );
  if (!beforeRows[0]) throw new NotFoundError("Activity kind not found");
  const before = toActivityKindRow(beforeRows[0]);

  const name = patch.name !== undefined ? requireNonEmpty(patch.name, "Name is required") : before.name;
  const displayOrder = patch.displayOrder !== undefined ? patch.displayOrder : before.displayOrder;

  try {
    const { rows } = await client.query<ActivityKindDbRow>(
      `update activity_kinds set name = $2, display_order = $3
       where code = $1
       returning ${ACTIVITY_KIND_COLUMNS}`,
      [code, name, displayOrder],
    );
    return { before, after: toActivityKindRow(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("An activity kind with this name already exists", "activity_kind_name_exists");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// job_categories: rename only. No create/deactivate/delete.
// ---------------------------------------------------------------------------

export type JobCategoryRow = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type JobCategoryDbRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const JOB_CATEGORY_COLUMNS = "id::text, code, name, created_at::text, updated_at::text";

function toJobCategoryRow(row: JobCategoryDbRow): JobCategoryRow {
  return { id: row.id, code: row.code, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listJobCategories(): Promise<JobCategoryRow[]> {
  const { rows } = await dbQuery<JobCategoryDbRow>(
    `select ${JOB_CATEGORY_COLUMNS} from job_categories order by name asc`,
  );
  return rows.map(toJobCategoryRow);
}

type JobCategoryWithReferenceCountDbRow = JobCategoryDbRow & { reference_count: string };

export type JobCategoryWithReferenceCount = {
  jobCategory: JobCategoryRow;
  referenceCount: number;
};

export async function listJobCategoriesWithReferenceCounts(
  dependencies: ListDependencies = {},
): Promise<JobCategoryWithReferenceCount[]> {
  const query = dependencies.query ?? dbQuery;
  const { rows } = await query<JobCategoryWithReferenceCountDbRow>(
    `select jc.id::text, jc.code, jc.name,
            jc.created_at::text, jc.updated_at::text,
            count(j.id)::text as reference_count
     from job_categories jc
     left join jobs j on j.job_category_id = jc.id and j.is_active = true
     group by jc.id, jc.code, jc.name, jc.created_at, jc.updated_at
     order by jc.name asc`,
  );
  return rows.map((row) => ({ jobCategory: toJobCategoryRow(row), referenceCount: Number(row.reference_count) }));
}

export async function countJobsByCategory(id: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*) as count from jobs where job_category_id = $1 and is_active = true`,
    [id],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function updateJobCategory(
  client: PoolClient,
  id: string,
  name: string,
  _actorAdminId: string,
): Promise<{ before: JobCategoryRow; after: JobCategoryRow }> {
  const { rows: beforeRows } = await client.query<JobCategoryDbRow>(
    `select ${JOB_CATEGORY_COLUMNS} from job_categories where id = $1 for update`,
    [id],
  );
  if (!beforeRows[0]) throw new NotFoundError("Job category not found");
  const before = toJobCategoryRow(beforeRows[0]);
  const nextName = requireNonEmpty(name, "Name is required");

  try {
    const { rows } = await client.query<JobCategoryDbRow>(
      `update job_categories set name = $2 where id = $1 returning ${JOB_CATEGORY_COLUMNS}`,
      [id, nextName],
    );
    return { before, after: toJobCategoryRow(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("A job category with this name already exists", "job_category_name_exists");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// employment_types: rename only. No create/deactivate/delete.
// ---------------------------------------------------------------------------

export type EmploymentTypeRow = {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type EmploymentTypeDbRow = {
  id: string;
  code: string;
  name: string;
  created_at: string;
  updated_at: string;
};

const EMPLOYMENT_TYPE_COLUMNS = "id::text, code, name, created_at::text, updated_at::text";

function toEmploymentTypeRow(row: EmploymentTypeDbRow): EmploymentTypeRow {
  return { id: row.id, code: row.code, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function listEmploymentTypes(): Promise<EmploymentTypeRow[]> {
  const { rows } = await dbQuery<EmploymentTypeDbRow>(
    `select ${EMPLOYMENT_TYPE_COLUMNS} from employment_types order by name asc`,
  );
  return rows.map(toEmploymentTypeRow);
}

type EmploymentTypeWithReferenceCountDbRow = EmploymentTypeDbRow & { reference_count: string };

export type EmploymentTypeWithReferenceCount = {
  employmentType: EmploymentTypeRow;
  referenceCount: number;
};

export async function listEmploymentTypesWithReferenceCounts(
  dependencies: ListDependencies = {},
): Promise<EmploymentTypeWithReferenceCount[]> {
  const query = dependencies.query ?? dbQuery;
  const { rows } = await query<EmploymentTypeWithReferenceCountDbRow>(
    `select et.id::text, et.code, et.name,
            et.created_at::text, et.updated_at::text,
            count(j.id)::text as reference_count
     from employment_types et
     left join jobs j on j.employment_type_id = et.id and j.is_active = true
     group by et.id, et.code, et.name, et.created_at, et.updated_at
     order by et.name asc`,
  );
  return rows.map((row) => ({ employmentType: toEmploymentTypeRow(row), referenceCount: Number(row.reference_count) }));
}

export async function countJobsByEmploymentType(id: string): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(
    `select count(*) as count from jobs where employment_type_id = $1 and is_active = true`,
    [id],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function updateEmploymentType(
  client: PoolClient,
  id: string,
  name: string,
  _actorAdminId: string,
): Promise<{ before: EmploymentTypeRow; after: EmploymentTypeRow }> {
  const { rows: beforeRows } = await client.query<EmploymentTypeDbRow>(
    `select ${EMPLOYMENT_TYPE_COLUMNS} from employment_types where id = $1 for update`,
    [id],
  );
  if (!beforeRows[0]) throw new NotFoundError("Employment type not found");
  const before = toEmploymentTypeRow(beforeRows[0]);
  const nextName = requireNonEmpty(name, "Name is required");

  try {
    const { rows } = await client.query<EmploymentTypeDbRow>(
      `update employment_types set name = $2 where id = $1 returning ${EMPLOYMENT_TYPE_COLUMNS}`,
      [id, nextName],
    );
    return { before, after: toEmploymentTypeRow(rows[0]) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("An employment type with this name already exists", "employment_type_name_exists");
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// universities / clubs / specialties: view-only at launch. No mutation functions.
// ---------------------------------------------------------------------------

export type UniversityRow = {
  id: string;
  name: string;
  regionCode: string | null;
  prefecture: string | null;
  city: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type UniversityDbRow = {
  id: string;
  name: string;
  region_code: string | null;
  prefecture: string | null;
  city: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listUniversities(options: { includeInactive?: boolean } = {}): Promise<UniversityRow[]> {
  const { rows } = await dbQuery<UniversityDbRow>(
    `select id::text, name, region_code, prefecture, city, is_active, created_at::text, updated_at::text
     from universities
     ${options.includeInactive ? "" : "where is_active = true"}
     order by name asc`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    regionCode: row.region_code,
    prefecture: row.prefecture,
    city: row.city,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export type ClubRow = { id: string; name: string; isActive: boolean; createdAt: string; updatedAt: string };

type ClubDbRow = { id: string; name: string; is_active: boolean; created_at: string; updated_at: string };

export async function listClubs(): Promise<ClubRow[]> {
  const { rows } = await dbQuery<ClubDbRow>(
    `select id::text, name, is_active, created_at::text, updated_at::text from clubs order by name asc`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export type SpecialtyRow = { id: string; name: string; isActive: boolean; createdAt: string; updatedAt: string };

type SpecialtyDbRow = { id: string; name: string; is_active: boolean; created_at: string; updated_at: string };

export async function listSpecialties(): Promise<SpecialtyRow[]> {
  const { rows } = await dbQuery<SpecialtyDbRow>(
    `select id::text, name, is_active, created_at::text, updated_at::text from specialties order by name asc`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
