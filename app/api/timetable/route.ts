import { dbQuery } from "@/lib/db/postgres";
import { buildPublicTimetableMatrix, type PublicTimetableMatrix } from "@/lib/timetable-dto";
import type { AdminTimetableRow } from "@/lib/timetable-admin";

export const runtime = "nodejs";

/**
 * Public timetable endpoint: returns the admin-managed official timetable
 * matrix for a chosen university / academic year / term. No auth required
 * (this is the same data students see inside the app.school view), and the
 * response is small and stable, so we cache the public payload through the
 * standard public_cache invalidation rules.
 */

type RawRow = {
  id: string;
  university_id: string;
  university_name: string;
  academic_year: number;
  term_number: number;
  department_label: string;
  class_title: string;
  day_of_week: AdminTimetableRow["dayOfWeek"];
  period: number;
  room: string | null;
  instructor: string | null;
  note: string | null;
  source_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export async function GET(request: Request): Promise<{ timetable: PublicTimetableMatrix | null }> {
  const url = new URL(request.url);
  const universityId = url.searchParams.get("universityId");
  const academicYear = url.searchParams.get("academicYear");
  const termNumber = url.searchParams.get("termNumber");
  if (!universityId || !academicYear || !termNumber) {
    return { timetable: null };
  }

  const year = Number(academicYear);
  const term = Number(termNumber);
  if (!Number.isFinite(year) || !Number.isFinite(term)) return { timetable: null };

  const { rows: universityRows } = await dbQuery<{ id: string; name: string }>(
    `select id::text as id, name from universities where id = $1 limit 1`,
    [universityId],
  );
  const university = universityRows[0];
  if (!university) return { timetable: null };

  const { rows } = await dbQuery<RawRow>(
    `select
       id::text,
       university_id::text,
       u.name as university_name,
       academic_year,
       term_number,
       department_label,
       class_title,
       day_of_week,
       period,
       room,
       instructor,
       note,
       source_url,
       sort_order,
       is_active
     from admin_university_timetable_entries t
     join universities u on u.id = t.university_id
     where t.university_id = $1
       and t.academic_year = $2
       and t.term_number = $3
       and t.is_active = true
     order by t.day_of_week asc, t.period asc, t.sort_order asc`,
    [universityId, year, term],
  );

  const matrix = buildPublicTimetableMatrix(
    university,
    year,
    term,
    rows.map((row) => ({
      id: row.id,
      universityId: row.university_id,
      universityName: row.university_name,
      academicYear: row.academic_year,
      termNumber: row.term_number,
      departmentLabel: row.department_label,
      classTitle: row.class_title,
      dayOfWeek: row.day_of_week,
      period: row.period,
      room: row.room,
      instructor: row.instructor,
      note: row.note,
      sourceUrl: row.source_url,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: "",
      updatedAt: "",
    })),
  );

  return { timetable: matrix };
}
