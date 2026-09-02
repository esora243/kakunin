import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "@/lib/db/postgres";
import { writeAuditLog } from "@/lib/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const DAY_LABEL_TO_KEY = {
  月: "月", 火: "火", 水: "水", 木: "木", 金: "金", 土: "土",
} as const;
type DayKey = keyof typeof DAY_LABEL_TO_KEY;

export type AdminTimetableRow = {
  id: string;
  universityId: string;
  universityName: string;
  academicYear: number;
  termNumber: number;
  departmentLabel: string;
  classTitle: string;
  dayOfWeek: DayKey;
  period: number;
  room: string | null;
  instructor: string | null;
  note: string | null;
  sourceUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminTimetableInput = {
  universityId: string;
  academicYear: number;
  termNumber: number;
  departmentLabel: string;
  classTitle: string;
  dayOfWeek: DayKey;
  period: number;
  room?: string | null;
  instructor?: string | null;
  note?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

function isDayKey(value: unknown): value is DayKey {
  return typeof value === "string" && (value === "月" || value === "火" || value === "水" || value === "木" || value === "金" || value === "土");
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickRequired(value: unknown, field: string): string {
  const text = pickString(value);
  if (!text) throw new ValidationError(`${field} is required`, "missing_required_field");
  return text;
}

function pickNumber(value: unknown, field: string, range: { min: number; max: number }): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < range.min || num > range.max) {
    throw new ValidationError(`${field} must be a number between ${range.min} and ${range.max}`, "invalid_number");
  }
  return Math.trunc(num);
}

export function pickAdminTimetableInput(body: Record<string, unknown>): AdminTimetableInput {
  if (!isDayKey(body.dayOfWeek)) {
    throw new ValidationError("dayOfWeek must be one of 月 火 水 木 金 土", "invalid_day");
  }
  return {
    universityId: pickRequired(body.universityId, "universityId"),
    academicYear: pickNumber(body.academicYear, "academicYear", { min: 2000, max: 2100 }),
    termNumber: pickNumber(body.termNumber, "termNumber", { min: 1, max: 4 }),
    departmentLabel: pickRequired(body.departmentLabel, "departmentLabel"),
    classTitle: pickRequired(body.classTitle, "classTitle"),
    dayOfWeek: body.dayOfWeek,
    period: pickNumber(body.period, "period", { min: 1, max: 7 }),
    room: pickString(body.room),
    instructor: pickString(body.instructor),
    note: pickString(body.note),
    sourceUrl: pickString(body.sourceUrl),
    sortOrder: body.sortOrder === undefined ? 0 : pickNumber(body.sortOrder, "sortOrder", { min: 0, max: 100000 }),
    isActive: typeof body.isActive === "boolean" ? body.isActive : true,
  };
}

export async function listAdminTimetableRows(filters: { universityId?: string; academicYear?: number; termNumber?: number } = {}): Promise<AdminTimetableRow[]> {
  const conditions: string[] = ["t.is_active = true"];
  const values: unknown[] = [];

  if (filters.universityId) {
    values.push(filters.universityId);
    conditions.push(`t.university_id = $${values.length}::uuid`);
  }
  if (typeof filters.academicYear === "number") {
    values.push(filters.academicYear);
    conditions.push(`t.academic_year = $${values.length}`);
  }
  if (typeof filters.termNumber === "number") {
    values.push(filters.termNumber);
    conditions.push(`t.term_number = $${values.length}`);
  }

  const { rows } = await dbQuery<AdminTimetableRow>(
    `select
       t.id::text,
       t.university_id::text as "universityId",
       u.name as "universityName",
       t.academic_year as "academicYear",
       t.term_number as "termNumber",
       t.department_label as "departmentLabel",
       t.class_title as "classTitle",
       t.day_of_week as "dayOfWeek",
       t.period,
       t.room,
       t.instructor,
       t.note,
       t.source_url as "sourceUrl",
       t.sort_order as "sortOrder",
       t.is_active as "isActive",
       t.created_at::text as "createdAt",
       t.updated_at::text as "updatedAt"
     from admin_university_timetable_entries t
     join universities u on u.id = t.university_id
     where ${conditions.join(" and ")}
     order by t.academic_year desc, t.term_number asc, t.day_of_week asc, t.period asc, t.sort_order asc`,
    values,
  );
  return rows;
}

export async function getAdminTimetableRowById(id: string): Promise<AdminTimetableRow | null> {
  const { rows } = await dbQuery<AdminTimetableRow>(
    `select
       t.id::text,
       t.university_id::text as "universityId",
       u.name as "universityName",
       t.academic_year as "academicYear",
       t.term_number as "termNumber",
       t.department_label as "departmentLabel",
       t.class_title as "classTitle",
       t.day_of_week as "dayOfWeek",
       t.period,
       t.room,
       t.instructor,
       t.note,
       t.source_url as "sourceUrl",
       t.sort_order as "sortOrder",
       t.is_active as "isActive",
       t.created_at::text as "createdAt",
       t.updated_at::text as "updatedAt"
     from admin_university_timetable_entries t
     join universities u on u.id = t.university_id
     where t.id = $1::uuid
     limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

async function fetchRowForUpdate(client: PoolClient, id: string): Promise<AdminTimetableRow | null> {
  const { rows } = await client.query<AdminTimetableRow>(
    `select
       t.id::text,
       t.university_id::text as "universityId",
       u.name as "universityName",
       t.academic_year as "academicYear",
       t.term_number as "termNumber",
       t.department_label as "departmentLabel",
       t.class_title as "classTitle",
       t.day_of_week as "dayOfWeek",
       t.period,
       t.room,
       t.instructor,
       t.note,
       t.source_url as "sourceUrl",
       t.sort_order as "sortOrder",
       t.is_active as "isActive",
       t.created_at::text as "createdAt",
       t.updated_at::text as "updatedAt"
     from admin_university_timetable_entries t
     join universities u on u.id = t.university_id
     where t.id = $1::uuid
     for update of t
     limit 1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createAdminTimetableEntry(
  client: PoolClient,
  input: AdminTimetableInput,
  actorAdminId: string,
): Promise<AdminTimetableRow> {
  let rows: { id: string }[];
  try {
    const result = await client.query<{ id: string }>(
      `insert into admin_university_timetable_entries (
         university_id, academic_year, term_number, department_label, class_title,
         day_of_week, period, room, instructor, note, source_url, sort_order, is_active,
         created_by_admin_id, updated_by_admin_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
       returning id::text`,
      [
        input.universityId,
        input.academicYear,
        input.termNumber,
        input.departmentLabel,
        input.classTitle,
        input.dayOfWeek,
        input.period,
        input.room,
        input.instructor,
        input.note,
        input.sourceUrl,
        input.sortOrder ?? 0,
        input.isActive ?? true,
        actorAdminId,
      ],
    );
    rows = result.rows;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("同じコマに授業がすでに登録されています", "timetable_slot_conflict");
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("指定した大学が存在しません", "invalid_university");
    }
    throw error;
  }
  const after = await fetchRowForUpdate(client, rows[0].id);
  if (!after) throw new NotFoundError("Timetable entry not found after create");
  await writeAuditLog(client, {
    actorAdminId,
    action: "timetable.create",
    resourceType: "admin_university_timetable_entries",
    resourceId: after.id,
    afterSnapshot: after,
  });
  return after;
}

export async function updateAdminTimetableEntry(
  client: PoolClient,
  id: string,
  input: AdminTimetableInput,
  actorAdminId: string,
): Promise<{ before: AdminTimetableRow; after: AdminTimetableRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Timetable entry not found");
  try {
    await client.query(
      `update admin_university_timetable_entries set
         university_id = $2::uuid,
         academic_year = $3,
         term_number = $4,
         department_label = $5,
         class_title = $6,
         day_of_week = $7,
         period = $8,
         room = $9,
         instructor = $10,
         note = $11,
         source_url = $12,
         sort_order = $13,
         is_active = $14,
         updated_by_admin_id = $15
       where id = $1::uuid`,
      [
        id,
        input.universityId,
        input.academicYear,
        input.termNumber,
        input.departmentLabel,
        input.classTitle,
        input.dayOfWeek,
        input.period,
        input.room,
        input.instructor,
        input.note,
        input.sourceUrl,
        input.sortOrder ?? before.sortOrder,
        input.isActive ?? before.isActive,
        actorAdminId,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("同じコマに授業がすでに登録されています", "timetable_slot_conflict");
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("指定した大学が存在しません", "invalid_university");
    }
    throw error;
  }
  const after = await fetchRowForUpdate(client, id);
  if (!after) throw new NotFoundError("Timetable entry not found after update");
  await writeAuditLog(client, {
    actorAdminId,
    action: "timetable.update",
    resourceType: "admin_university_timetable_entries",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return { before, after };
}

export async function softDeleteAdminTimetableEntry(
  client: PoolClient,
  id: string,
  actorAdminId: string,
): Promise<AdminTimetableRow> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Timetable entry not found");
  await client.query(
    `update admin_university_timetable_entries set is_active = false, updated_by_admin_id = $2 where id = $1::uuid`,
    [id, actorAdminId],
  );
  const after = await fetchRowForUpdate(client, id);
  if (!after) throw new NotFoundError("Timetable entry not found after delete");
  await writeAuditLog(client, {
    actorAdminId,
    action: "timetable.deactivate",
    resourceType: "admin_university_timetable_entries",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  return after;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23503";
}
