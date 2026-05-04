import { supabaseRestFetch } from "@/lib/supabase/rest";
import {
  buildTimetableGrid,
  PERIODS,
  sortTimetableClasses,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";
import type { TimetableClassDto } from "@/lib/timetable-dto";

export async function listTimetableClasses() {
  // 変更点1: syllabus_class_entries ではなく timetable_classes テーブルから取得
  const rows = await supabaseRestFetch<any[]>({
    path: "timetable_classes?select=*",
  });

  // 変更点2: 取得した生データをフロントエンド用の型(TimetableClassDto)にマッピング
  const mappedItems: TimetableClassDto[] = rows.map((row) => ({
    id: String(row.id),
    classKey: `class-${row.id}`,
    title: row.title,
    instructor: row.instructor,
    room: row.room,
    location: row.location,
    day: row.day,
    period: row.period,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    academicYear: row.academic_year,
    termNumber: row.term_number,
    universityName: row.university_name,
    sourceType: "manual",
    isOfficial: row.is_official,
  }));

  const items = sortTimetableClasses(mappedItems);

  return {
    days: TIMETABLE_DAYS,
    periods: PERIODS,
    items,
    grid: buildTimetableGrid(items),
  };
}