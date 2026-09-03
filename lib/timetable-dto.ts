import type { AdminTimetableRow } from "@/admin/lib/timetable-admin";

const DAY_ORDER: Record<AdminTimetableRow["dayOfWeek"], number> = {
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
      const dayDelta = DAY_ORDER[left.dayOfWeek] - DAY_ORDER[right.dayOfWeek];
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
