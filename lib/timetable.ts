import { supabaseRestFetch } from "@/lib/supabase/rest";
import {
  buildTimetableGrid,
  PERIODS,
  sortTimetableClasses,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";
import type { TimetableClassDto } from "@/lib/timetable-dto";

export async function listTimetableClasses() {
  const rows = await supabaseRestFetch<any[]>({
    path: "timetable_classes?select=*",
  });

  const mappedItems: TimetableClassDto[] = rows.map((row) => {
    // 理由3対策: periodが "special" などの文字列の場合は、特枠（7）として数値化する
    const parsedPeriod = parseInt(row.period, 10);
    const periodNumber = isNaN(parsedPeriod) ? 7 : parsedPeriod;

    return {
      id: String(row.id),
      classKey: `class-${row.id}`,
      
      // 理由1・2対策: 古い row.title 等ではなく、CSV/DBの正しいカラム名を指定する
      title: row.subject || "（科目名なし）",
      instructor: row.teacher || "",
      room: row.room || "",
      location: row.room || "",
      day: row.day_of_week as any,
      period: periodNumber,
      startsAt: row.time_start ? row.time_start.substring(0, 5) : "",
      endsAt: row.time_end ? row.time_end.substring(0, 5) : "",
      
      academicYear: null,
      termNumber: null,
      universityName: null,
      sourceType: "manual",
      isOfficial: true,
    };
  });

  const items = sortTimetableClasses(mappedItems);

  // special枠（7限）が存在する場合は、グリッドの枠を拡張する
  const hasSpecial = items.some(item => item.period === 7);
  const dynamicPeriods = hasSpecial ? [...PERIODS, 7] : PERIODS;

  return {
    days: TIMETABLE_DAYS,
    periods: dynamicPeriods,
    items,
    grid: buildTimetableGrid(items),
  };
}