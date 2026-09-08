import { dbQuery } from "@/lib/db/postgres";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { invalidRequestResult } from "@/lib/api-results";
import { buildPublicTimetableMatrix, type PublicTimetableMatrix } from "@/lib/timetable-dto";
import type { AdminTimetableRow } from "@/admin/lib/timetable-admin";

/**
 * Public "official timetable" endpoint: returns the admin-managed timetable
 * matrix for a chosen university / academic year / term, shared across all
 * students at that university. This is independent from the per-user
 * timetable served by GET /api/timetable (which stays backed by
 * `listCachedTimetableClasses`) — that endpoint's contract (cache headers,
 * response shape) is left untouched.
 */

export const dynamic = "force-dynamic";
const PUBLIC_OFFICIAL_TIMETABLE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

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

export async function GET(request: Request) {
  return publicCachedJsonRoute(
    { code: "official_timetable_fetch_failed", message: "時間割の取得に失敗しました" },
    PUBLIC_OFFICIAL_TIMETABLE_CACHE_CONTROL,
    async () => {
      const url = new URL(request.url);
      const universityId = url.searchParams.get("universityId");
      const academicYear = url.searchParams.get("academicYear");
      const termNumber = url.searchParams.get("termNumber");
      if (!universityId || !academicYear || !termNumber) {
        return invalidRequestResult("universityId, academicYear, termNumber are required");
      }

      const year = Number(academicYear);
      const term = Number(termNumber);
      if (!Number.isFinite(year) || !Number.isFinite(term)) {
        return invalidRequestResult("academicYear and termNumber must be numbers");
      }

      const { rows: universityRows } = await dbQuery<{ id: string; name: string }>(
        `select id::text as id, name from universities where id = $1 limit 1`,
        [universityId],
      );
      const university = universityRows[0];
      if (!university) {
        return { body: { ok: true as const, timetable: null as PublicTimetableMatrix | null } };
      }

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

      return { body: { ok: true as const, timetable: matrix } };
    },
  );
}
