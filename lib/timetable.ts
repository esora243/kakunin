import { supabaseRestFetch } from "@/lib/supabase/rest";
import {
  buildTimetableGrid,
  mapTimetableClass,
  PERIODS,
  sortTimetableClasses,
  type SyllabusClassRow,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";

export async function listTimetableClasses() {
  const rows = await supabaseRestFetch<SyllabusClassRow[]>({
    path:
      "syllabus_class_entries?select=id,class_key,title,instructor,room,location,schedule,source_type,is_official,syllabus_pages!inner(academic_year,term_number,universities(name))&is_active=eq.true&syllabus_pages.is_active=eq.true&order=title.asc",
  });

  const items = sortTimetableClasses(rows.map(mapTimetableClass).filter((item) => item !== null));

  return {
    days: TIMETABLE_DAYS,
    periods: PERIODS,
    items,
    grid: buildTimetableGrid(items),
  };
}
