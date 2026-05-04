import type { TimetableClassDto, TimetableDay, TimetableGridDto } from "./timetable-dto";

export type SyllabusPageRelation = {
  academic_year: number | null;
  term_number: number | null;
  universities?: { name: string | null } | { name: string | null }[] | null;
};

export type SyllabusClassRow = {
  id: string;
  class_key: string;
  title: string;
  instructor: string | null;
  room: string | null;
  location: string | null;
  schedule: unknown;
  source_type: string;
  is_official: boolean;
  syllabus_pages?: SyllabusPageRelation | SyllabusPageRelation[] | null;
};

export const TIMETABLE_DAYS: TimetableDay[] = ["月", "火", "水", "木", "金"];
export const DAY_ORDER = new Map<TimetableDay, number>(TIMETABLE_DAYS.map((day, index) => [day, index]));
export const PERIODS = [1, 2, 3, 4, 5, 6];

export function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function readSchedule(schedule: unknown): Pick<TimetableClassDto, "day" | "period" | "startsAt" | "endsAt"> | null {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;
  const value = schedule as Record<string, unknown>;
  const day = value.day ?? value.weekday;
  const period = value.period;

  if (typeof day !== "string" || !DAY_ORDER.has(day as TimetableDay)) return null;
  if (typeof period !== "number" || !Number.isInteger(period) || period < 1) return null;

  return {
    day: day as TimetableDay,
    period,
    startsAt: typeof value.starts_at === "string" ? value.starts_at : null,
    endsAt: typeof value.ends_at === "string" ? value.ends_at : null,
  };
}

export function mapTimetableClass(row: SyllabusClassRow): TimetableClassDto | null {
  const schedule = readSchedule(row.schedule);
  if (!schedule) return null;

  const page = firstRelation(row.syllabus_pages);
  const university = firstRelation(page?.universities);

  return {
    id: row.id,
    classKey: row.class_key,
    title: row.title,
    instructor: row.instructor,
    room: row.room,
    location: row.location,
    day: schedule.day,
    period: schedule.period,
    startsAt: schedule.startsAt,
    endsAt: schedule.endsAt,
    academicYear: page?.academic_year ?? null,
    termNumber: page?.term_number ?? null,
    universityName: university?.name ?? null,
    sourceType: row.source_type,
    isOfficial: row.is_official,
  };
}

export function sortTimetableClasses(items: TimetableClassDto[]) {
  return [...items].sort((a, b) => {
    const dayDiff = (DAY_ORDER.get(a.day) ?? 99) - (DAY_ORDER.get(b.day) ?? 99);
    if (dayDiff !== 0) return dayDiff;
    if (a.period !== b.period) return a.period - b.period;
    return a.title.localeCompare(b.title, "ja");
  });
}

export function buildTimetableGrid(items: TimetableClassDto[]) {
  const grid = Object.fromEntries(TIMETABLE_DAYS.map((day) => [day, {}])) as TimetableGridDto;
  for (const item of items) {
    grid[item.day][item.period] = item;
  }
  return grid;
}
