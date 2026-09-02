import { dbQuery } from "@/lib/db/postgres";
import {
  buildTimetableGrid,
  mapTimetableClass,
  PERIODS,
  sortTimetableClasses,
  type SyllabusClassRow,
  TIMETABLE_DAYS,
} from "@/lib/timetable-core";

export async function listTimetableClasses() {
  const { rows } = await dbQuery<SyllabusClassRow>(`
    select
      sce.id::text,
      sce.class_key,
      sce.title,
      sce.instructor,
      sce.room,
      sce.location,
      sce.schedule,
      sce.source_type::text,
      sce.is_official,
      json_build_object(
        'academic_year', sp.academic_year,
        'term_number', sp.term_number,
        'university_id', sp.university_id::text,
        'universities', json_build_object('name', u.name)
      ) as syllabus_pages
    from syllabus_class_entries sce
    join syllabus_pages sp on sp.id = sce.syllabus_page_id
    join universities u on u.id = sp.university_id
    where sce.is_active = true
      and sp.is_active = true
      and sce.is_official = true
    order by sce.title asc
  `);

  const items = sortTimetableClasses(rows.map(mapTimetableClass));

  return {
    days: TIMETABLE_DAYS,
    periods: PERIODS,
    items,
    grid: buildTimetableGrid(items),
  };
}
