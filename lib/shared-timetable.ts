import "server-only";

import type { AuthSessionPayload } from "./auth/types";
import { dbQuery } from "./db/postgres";

export type SharedTimetableDay = "月" | "火" | "水" | "木" | "金" | "土";

export type SharedTimetableEntry = {
  id: string;
  universityId: string;
  universityName: string;
  academicYear: number;
  termNumber: number;
  dayOfWeek: SharedTimetableDay;
  period: number;
  classTitle: string;
  instructor: string | null;
  room: string | null;
  note: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SharedTimetableInput = {
  universityId: string;
  academicYear: number;
  termNumber: number;
  dayOfWeek: SharedTimetableDay;
  period: number;
  classTitle: string;
  instructor?: string | null;
  room?: string | null;
  note?: string | null;
};

const DAYS: SharedTimetableDay[] = ["月", "火", "水", "木", "金", "土"];

export function isSharedTimetableDay(value: unknown): value is SharedTimetableDay {
  return typeof value === "string" && (DAYS as string[]).includes(value);
}

function pickString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseSharedTimetableInput(body: unknown): SharedTimetableInput | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const source = body as Record<string, unknown>;
  const universityId = pickString(source.universityId);
  const classTitle = pickString(source.classTitle);
  if (!universityId || !classTitle) return null;
  if (!isSharedTimetableDay(source.dayOfWeek)) return null;

  const academicYear = Number(source.academicYear);
  const termNumber = Number(source.termNumber);
  const period = Number(source.period);
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) return null;
  if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 4) return null;
  if (!Number.isInteger(period) || period < 1 || period > 7) return null;

  return {
    universityId,
    academicYear,
    termNumber,
    dayOfWeek: source.dayOfWeek,
    period,
    classTitle,
    instructor: pickString(source.instructor),
    room: pickString(source.room),
    note: pickString(source.note),
  };
}

export async function listSharedTimetableEntries(
  filters: { universityId?: string; academicYear?: number; termNumber?: number } = {},
): Promise<SharedTimetableEntry[]> {
  const conditions: string[] = ["e.is_active = true"];
  const values: unknown[] = [];

  if (filters.universityId) {
    values.push(filters.universityId);
    conditions.push(`e.university_id = $${values.length}::uuid`);
  }
  if (typeof filters.academicYear === "number") {
    values.push(filters.academicYear);
    conditions.push(`e.academic_year = $${values.length}`);
  }
  if (typeof filters.termNumber === "number") {
    values.push(filters.termNumber);
    conditions.push(`e.term_number = $${values.length}`);
  }

  const { rows } = await dbQuery<SharedTimetableEntry>(
    `select
       e.id::text,
       e.university_id::text as "universityId",
       u.name as "universityName",
       e.academic_year as "academicYear",
       e.term_number as "termNumber",
       e.day_of_week as "dayOfWeek",
       e.period,
       e.class_title as "classTitle",
       e.instructor,
       e.room,
       e.note,
       e.created_by_user_id::text as "createdByUserId",
       e.updated_by_user_id::text as "updatedByUserId",
       e.created_at::text as "createdAt",
       e.updated_at::text as "updatedAt"
     from shared_timetable_entries e
     join universities u on u.id = e.university_id
     where ${conditions.join(" and ")}
     order by e.day_of_week asc, e.period asc, e.created_at asc`,
    values,
  );
  return rows;
}

async function requireActiveUser(session: AuthSessionPayload) {
  const { rows } = await dbQuery<{ id: string }>(
    "select id::text from users where id = $1 and deactivated_at is null limit 1",
    [session.userId],
  );
  return rows[0] ?? null;
}

export async function addSharedTimetableEntry(session: AuthSessionPayload, input: SharedTimetableInput) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;
  try {
    await dbQuery(
      `insert into shared_timetable_entries
         (university_id, academic_year, term_number, day_of_week, period, class_title,
          instructor, room, note, created_by_user_id, updated_by_user_id)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        input.universityId,
        input.academicYear,
        input.termNumber,
        input.dayOfWeek,
        input.period,
        input.classTitle,
        input.instructor,
        input.room,
        input.note,
        user.id,
      ],
    );
    return "added" as const;
  } catch {
    return "invalid_university" as const;
  }
}

export async function updateSharedTimetableEntry(session: AuthSessionPayload, id: string, input: SharedTimetableInput) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;
  const result = await dbQuery(
    `update shared_timetable_entries set
       university_id = $2::uuid,
       academic_year = $3,
       term_number = $4,
       day_of_week = $5,
       period = $6,
       class_title = $7,
       instructor = $8,
       room = $9,
       note = $10,
       updated_by_user_id = $11,
       updated_at = now()
     where id = $1::uuid and is_active = true`,
    [
      id,
      input.universityId,
      input.academicYear,
      input.termNumber,
      input.dayOfWeek,
      input.period,
      input.classTitle,
      input.instructor,
      input.room,
      input.note,
      user.id,
    ],
  );
  return result.rowCount > 0 ? ("updated" as const) : ("not_found" as const);
}

export async function removeSharedTimetableEntry(session: AuthSessionPayload, id: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;
  const result = await dbQuery(
    `update shared_timetable_entries set is_active = false, updated_by_user_id = $2, updated_at = now()
     where id = $1::uuid and is_active = true`,
    [id, user.id],
  );
  return result.rowCount > 0 ? ("removed" as const) : ("not_found" as const);
}
