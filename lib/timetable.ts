import { supabaseRestFetch } from "@/lib/supabase/rest";
import {
  buildTimetableGrid,
  PERIODS,
  sortTimetableClasses,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";
import type { TimetableClassDto } from "@/lib/timetable-dto";

export async function listTimetableClasses() {
  // CSVヘッダー（subject, teacher, day_of_week, time_start, time_end）を持つテーブルからデータを取得
  const rows = await supabaseRestFetch<any[]>({
    path: "timetable_classes?select=*",
  });

  // 取得した生データを、アプリケーション共通の型（TimetableClassDto）にマッピング
  const mappedItems: TimetableClassDto[] = rows.map((row) => {
    // periodが "special"（全体討論や試験など）の場合は、数値の「7」としてマッピング
    const parsedPeriod = parseInt(row.period, 10);
    const periodNumber = isNaN(parsedPeriod) ? 7 : parsedPeriod;

    return {
      id: String(row.id),
      classKey: `class-${row.id}`,
      title: row.subject || "（科目名なし）",
      instructor: row.teacher || null,
      room: row.room || null,
      location: row.room || null,
      day: row.day_of_week as any,
      period: periodNumber,
      startsAt: row.time_start ? row.time_start.substring(0, 5) : null,
      endsAt: row.time_end ? row.time_end.substring(0, 5) : null,
      academicYear: null,
      termNumber: null,
      universityName: null,
      sourceType: "manual",
      isOfficial: true,
    };
  });

  const items = sortTimetableClasses(mappedItems);

  // special枠（7）がデータ内に存在する場合は行を拡張する
  const hasSpecial = items.some(item => item.period === 7);
  const dynamicPeriods = hasSpecial ? [...PERIODS, 7] : PERIODS;

  return {
    days: TIMETABLE_DAYS,
    periods: dynamicPeriods,
    items,
    grid: buildTimetableGrid(items),
  };
}