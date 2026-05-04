import type { TimetableClassDto, TimetableDay, TimetableGridDto } from "./timetable-dto";

export const TIMETABLE_DAYS: TimetableDay[] = ["月", "火", "水", "木", "金"];
export const DAY_ORDER = new Map<TimetableDay, number>(TIMETABLE_DAYS.map((day, index) => [day, index]));
export const PERIODS = [1, 2, 3, 4, 5, 6];

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