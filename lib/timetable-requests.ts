import {
  buildTimetableGrid,
  mapTimetableClass,
  PERIODS,
  sortTimetableClasses,
  type SyllabusClassRow,
  TIMETABLE_DAYS,
} from "./timetable-core";
import type { UserTimetableEntryDto } from "./timetable-dto";

export type UserTimetableEntryRow = {
  id: string;
  created_at: string;
  color_label: string | null;
  display_order: number | null;
  syllabus_class_entries: SyllabusClassRow | SyllabusClassRow[] | null;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function canAccessTimetableClass(
  user: { university_id: string | null },
  classRow: { syllabus_pages?: { university_id?: string | null } | { university_id?: string | null }[] | null },
) {
  const page = firstRelation(classRow.syllabus_pages);
  return Boolean(user.university_id && page?.university_id && user.university_id === page.university_id);
}

export function mapUserTimetableEntryRow(row: UserTimetableEntryRow): UserTimetableEntryDto | null {
  const classRow = firstRelation(row.syllabus_class_entries);
  if (!classRow) return null;

  const item = mapTimetableClass(classRow);

  return {
    id: row.id,
    classId: item.id,
    class: item,
    colorLabel: row.color_label,
    displayOrder: row.display_order,
    addedAt: row.created_at,
  };
}

export function buildUserTimetableResponse(entries: UserTimetableEntryDto[]) {
  const items = sortTimetableClasses(entries.map((entry) => entry.class));
  return {
    days: TIMETABLE_DAYS,
    periods: PERIODS,
    entries,
    items,
    grid: buildTimetableGrid(items),
  };
}

export function parseTimetableClassIdBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const classId = (body as Record<string, unknown>).classId;
  return typeof classId === "string" && classId.trim() ? classId : null;
}
