export type TimetableDay = "月" | "火" | "水" | "木" | "金" | "土" | "日";

export type TimetableClassDto = {
  id: string;
  classKey: string;
  title: string;
  instructor: string | null;
  room: string | null;
  location: string | null;
  day: TimetableDay;
  period: number;
  startsAt: string | null;
  endsAt: string | null;
  academicYear: number | null;
  termNumber: number | null;
  universityName: string | null;
  sourceType: string;
  isOfficial: boolean;
};

export type TimetableGridDto = Record<TimetableDay, Record<number, TimetableClassDto>>;

export type UserTimetableEntryDto = {
  id: string;
  classId: string;
  class: TimetableClassDto;
  colorLabel: string | null;
  displayOrder: number | null;
  addedAt: string;
};

export type UserTimetableResponse = {
  ok: true;
  days: TimetableDay[];
  periods: number[];
  entries: UserTimetableEntryDto[];
  items: TimetableClassDto[];
  grid: TimetableGridDto;
};

// ==========================================
// ▼ 大学横断の「公式時間割」公開API用（admin管理データを表示専用に整形） ▼
// 個人の時間割編集（上記 TimetableClassDto 系）とは独立した別機能。
// ==========================================
import type { AdminTimetableRow } from "@/admin/lib/timetable-admin";

const OFFICIAL_DAY_ORDER: Record<AdminTimetableRow["dayOfWeek"], number> = {
  月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6,
};

export type PublicTimetableCell = {
  dayOfWeek: AdminTimetableRow["dayOfWeek"];
  period: number;
  classTitle: string;
  instructor: string | null;
  room: string | null;
  departmentLabel: string;
  sourceUrl: string | null;
  note: string | null;
};

export type PublicTimetableMatrix = {
  universityId: string;
  universityName: string;
  academicYear: number;
  termNumber: number;
  cells: PublicTimetableCell[];
};

export function buildPublicTimetableMatrix(
  university: { id: string; name: string },
  year: number,
  term: number,
  rows: AdminTimetableRow[],
): PublicTimetableMatrix {
  const cells: PublicTimetableCell[] = rows
    .filter((row) => row.isActive)
    .sort((left, right) => {
      const dayDelta = OFFICIAL_DAY_ORDER[left.dayOfWeek] - OFFICIAL_DAY_ORDER[right.dayOfWeek];
      if (dayDelta !== 0) return dayDelta;
      return left.period - right.period;
    })
    .map((row) => ({
      dayOfWeek: row.dayOfWeek,
      period: row.period,
      classTitle: row.classTitle,
      instructor: row.instructor,
      room: row.room,
      departmentLabel: row.departmentLabel,
      sourceUrl: row.sourceUrl,
      note: row.note,
    }));
  return {
    universityId: university.id,
    universityName: university.name,
    academicYear: year,
    termNumber: term,
    cells,
  };
}
