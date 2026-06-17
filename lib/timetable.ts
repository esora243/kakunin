import { supabaseRestFetch } from "@/lib/supabase/rest";
import {
  buildTimetableGrid,
  clampAttendanceWeight,
  filterByGrade,
  normalizePeriod,
  PERIODS,
  PERIOD_LABELS,
  slotKindOfPeriod,
  sortTimetableClasses,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";
import type { TimetableClassDto, TimetableResponse } from "@/lib/timetable-dto";

export type ListTimetableOptions = {
  grade?: number | null;
  universityName?: string | null;
};

/**
 * Supabase `timetable_classes` から時間割を取得し、
 * 拡張 DTO に整形して返す。
 *
 * 課題メモ・通知タブを廃止する設計変更に伴い、
 * 個別タスクではなく「時間割1コマ」に
 * - isCuttable / attendanceWeight
 * - departmentName / departmentSummary / examMaterialsUrl
 * を直接持たせることで「一目で管理」を実現する。
 */
export async function listTimetableClasses(
  options: ListTimetableOptions = {},
): Promise<Omit<TimetableResponse, "ok">> {
  const { grade = null, universityName = null } = options;

  const rows = await supabaseRestFetch<any[]>({
    path: "timetable_classes?select=*",
  });

  const mappedItems: TimetableClassDto[] = (rows ?? []).map((row) => {
    const periodNumber = normalizePeriod(row.period);
    const slotKind = slotKindOfPeriod(periodNumber);

    return {
      id: String(row.id),
      classKey: `class-${row.id}`,

      title: row.subject || row.title || "（科目名なし）",
      instructor: row.teacher || row.instructor || "",
      room: row.room || "",
      location: row.room || row.location || "",
      day: row.day_of_week as any,
      period: periodNumber,
      slotKind,
      startsAt: row.time_start ? String(row.time_start).substring(0, 5) : "",
      endsAt: row.time_end ? String(row.time_end).substring(0, 5) : "",

      grade: row.grade != null ? Number(row.grade) : null,
      academicYear: row.grade != null ? Number(row.grade) : null,
      termNumber: row.term_number != null ? Number(row.term_number) : null,
      universityName: row.university_name || null,

      isCuttable: row.is_cuttable === true || row.is_cuttable === "true",
      attendanceWeight: clampAttendanceWeight(row.attendance_weight),

      departmentName: row.department_name ?? row.department ?? null,
      departmentSummary: row.department_summary ?? row.summary ?? null,
      examMaterialsUrl: row.exam_materials_url ?? row.exam_url ?? null,

      activityScope: row.activity_scope === "extramural" ? "extramural" : row.activity_scope === "intramural" ? "intramural" : null,

      sourceType: row.source_type || "manual",
      isOfficial: row.is_official !== false,
    };
  });

  // 学年・大学でフィルタ
  let items = filterByGrade(mappedItems, grade);
  if (universityName) {
    items = items.filter((c) => !c.universityName || c.universityName === universityName);
  }
  items = sortTimetableClasses(items);

  // 表示する period のセット (1〜6 + 昼休み・放課後を常に表示)
  const hasSpecial = items.some((c) => c.period === 99);
  const periods = hasSpecial ? [...PERIODS, 99] : [...PERIODS];

  return {
    days: TIMETABLE_DAYS,
    periods,
    periodLabels: PERIOD_LABELS,
    items,
    grid: buildTimetableGrid(items),
    grade,
    universityName,
  };
}