import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { writeAuditLog } from "./audit";
import { NotFoundError, ValidationError } from "./errors";
import { assertOrderedDateRange } from "./date-range";

export type SyllabusPageListRow = {
  id: string;
  academic_year: number;
  term_number: number;
  is_active: boolean;
  is_manual_override: boolean;
  updated_at: string;
  university_name: string;
};

export type SyllabusPageDetailRow = SyllabusPageListRow & {
  university_id: string;
  source_kind: string;
  source_file_url: string | null;
  parsed_json: unknown;
  effective_start_date: string | null;
  effective_end_date: string | null;
  source_last_modified_at: string | null;
  synced_at: string;
  created_at: string;
};

export type SyllabusClassEntryRow = {
  id: string;
  class_key: string;
  title: string;
  instructor: string | null;
  room: string | null;
  location: string | null;
  schedule: unknown;
  source_type: string;
  is_official: boolean;
  is_active: boolean;
  revision_no: number;
  updated_at: string;
  resource_count: number;
  task_count: number;
};

export type SyllabusPageFilters = {
  universityId?: string;
  academicYear?: number;
  includeInactiveUniversities?: boolean;
};

export type SyllabusPagePatch = {
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  isActive?: boolean;
};

export type SyllabusClassPatch = {
  title: string;
  instructor?: string | null;
  room?: string | null;
  location?: string | null;
  isActive?: boolean;
};

export async function listSyllabusPageRows(filters: SyllabusPageFilters = {}): Promise<SyllabusPageListRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (!filters.includeInactiveUniversities) {
    conditions.push("u.is_active = true");
  }
  if (filters.universityId) {
    values.push(filters.universityId);
    conditions.push(`sp.university_id = $${values.length}`);
  }
  if (typeof filters.academicYear === "number") {
    values.push(filters.academicYear);
    conditions.push(`sp.academic_year = $${values.length}`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await dbQuery<SyllabusPageListRow>(
    `
      select
        sp.id::text,
        sp.academic_year,
        sp.term_number,
        sp.is_active,
        sp.is_manual_override,
        sp.updated_at::text,
        u.name as university_name
      from syllabus_pages sp
      join universities u on u.id = sp.university_id
      ${where}
      order by sp.updated_at desc
      limit 200
    `,
    values,
  );
  return rows;
}

export async function getSyllabusPageWithClasses(
  id: string,
): Promise<{ page: SyllabusPageDetailRow; classes: SyllabusClassEntryRow[] } | null> {
  const { rows: pageRows } = await dbQuery<SyllabusPageDetailRow>(
    `
      select
        sp.id::text,
        sp.academic_year,
        sp.term_number,
        sp.is_active,
        sp.is_manual_override,
        sp.updated_at::text,
        u.name as university_name,
        sp.university_id::text,
        sp.source_kind,
        sp.source_file_url,
        sp.parsed_json,
        sp.effective_start_date::text,
        sp.effective_end_date::text,
        sp.source_last_modified_at::text,
        sp.synced_at::text,
        sp.created_at::text
      from syllabus_pages sp
      join universities u on u.id = sp.university_id
      where sp.id = $1
      limit 1
    `,
    [id],
  );
  const page = pageRows[0];
  if (!page) return null;

  const { rows: classes } = await dbQuery<SyllabusClassEntryRow>(
    `
      select
        ce.id::text,
        ce.class_key,
        ce.title,
        ce.instructor,
        ce.room,
        ce.location,
        ce.schedule,
        ce.source_type,
        ce.is_official,
        ce.is_active,
        ce.revision_no,
        ce.updated_at::text,
        coalesce(res.resource_count, 0)::int as resource_count,
        coalesce(tasks.task_count, 0)::int as task_count
      from syllabus_class_entries ce
      left join (
        select syllabus_class_entry_id, count(*) as resource_count
        from syllabus_class_resources
        group by syllabus_class_entry_id
      ) res on res.syllabus_class_entry_id = ce.id
      left join (
        select syllabus_class_entry_id, count(*) as task_count
        from syllabus_class_tasks
        group by syllabus_class_entry_id
      ) tasks on tasks.syllabus_class_entry_id = ce.id
      where ce.syllabus_page_id = $1
      order by ce.class_key asc
    `,
    [id],
  );

  return { page, classes };
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(value: unknown, field: string): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`);
  }
  return text;
}

function requireString(value: unknown, message: string): string {
  const text = stringOrNull(value);
  if (!text) throw new ValidationError(message);
  return text;
}

export function pickSyllabusPagePatch(body: Record<string, unknown>): SyllabusPagePatch {
  const effectiveStartDate = optionalDate(body.effectiveStartDate, "Effective start date");
  const effectiveEndDate = optionalDate(body.effectiveEndDate, "Effective end date");
  try {
    assertOrderedDateRange(effectiveStartDate, effectiveEndDate, "Effective start date", "Effective end date");
  } catch {
    throw new ValidationError("Effective start date must be on or before Effective end date");
  }
  return {
    effectiveStartDate,
    effectiveEndDate,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
  };
}

export function pickSyllabusClassPatch(body: Record<string, unknown>): SyllabusClassPatch {
  return {
    title: requireString(body.title, "Title is required"),
    instructor: stringOrNull(body.instructor),
    room: stringOrNull(body.room),
    location: stringOrNull(body.location),
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
  };
}

async function getSyllabusPageForUpdate(client: PoolClient, id: string): Promise<SyllabusPageDetailRow | null> {
  const { rows } = await client.query<SyllabusPageDetailRow>(
    `
      select
        sp.id::text,
        sp.academic_year,
        sp.term_number,
        sp.is_active,
        sp.is_manual_override,
        sp.updated_at::text,
        u.name as university_name,
        sp.university_id::text,
        sp.source_kind,
        sp.source_file_url,
        sp.parsed_json,
        sp.effective_start_date::text,
        sp.effective_end_date::text,
        sp.source_last_modified_at::text,
        sp.synced_at::text,
        sp.created_at::text
      from syllabus_pages sp
      join universities u on u.id = sp.university_id
      where sp.id = $1
      for update of sp
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

async function getSyllabusClassForUpdate(client: PoolClient, id: string): Promise<SyllabusClassEntryRow | null> {
  const { rows } = await client.query<SyllabusClassEntryRow>(
    `
      select
        ce.id::text,
        ce.class_key,
        ce.title,
        ce.instructor,
        ce.room,
        ce.location,
        ce.schedule,
        ce.source_type,
        ce.is_official,
        ce.is_active,
        ce.revision_no,
        ce.updated_at::text,
        0::int as resource_count,
        0::int as task_count
      from syllabus_class_entries ce
      where ce.id = $1
      for update
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function updateSyllabusPage(
  client: PoolClient,
  id: string,
  patch: SyllabusPagePatch,
  actorAdminId: string,
): Promise<{ before: SyllabusPageDetailRow; after: SyllabusPageDetailRow }> {
  const before = await getSyllabusPageForUpdate(client, id);
  if (!before) throw new NotFoundError("Syllabus page not found");
  await client.query(
    `
      update syllabus_pages set
        effective_start_date = $2::date,
        effective_end_date = $3::date,
        is_active = coalesce($4::boolean, is_active),
        is_manual_override = true,
        source_last_modified_at = now(),
        synced_at = now()
      where id = $1
    `,
    [id, patch.effectiveStartDate, patch.effectiveEndDate, patch.isActive ?? null],
  );
  const after = await getSyllabusPageForUpdate(client, id);
  if (!after) throw new NotFoundError("Syllabus page not found after update");
  await writeAuditLog(client, {
    actorAdminId,
    action: "school.syllabus_page.update",
    resourceType: "syllabus_pages",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { before, after };
}

export async function updateSyllabusClassEntry(
  client: PoolClient,
  id: string,
  patch: SyllabusClassPatch,
  actorAdminId: string,
): Promise<{ before: SyllabusClassEntryRow; after: SyllabusClassEntryRow }> {
  const before = await getSyllabusClassForUpdate(client, id);
  if (!before) throw new NotFoundError("Syllabus class entry not found");
  if (before.source_type === "official" && before.is_official) {
    throw new ValidationError("Official class entries cannot be edited directly; create a manual override workflow before changing official source data.");
  }
  await client.query(
    `
      update syllabus_class_entries set
        title = $2,
        instructor = $3,
        room = $4,
        location = $5,
        is_active = coalesce($6::boolean, is_active),
        revision_no = revision_no + 1
      where id = $1
    `,
    [id, patch.title, patch.instructor, patch.room, patch.location, patch.isActive ?? null],
  );
  const after = await getSyllabusClassForUpdate(client, id);
  if (!after) throw new NotFoundError("Syllabus class entry not found after update");
  await writeAuditLog(client, {
    actorAdminId,
    action: "school.class_entry.update",
    resourceType: "syllabus_class_entries",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { before, after };
}
