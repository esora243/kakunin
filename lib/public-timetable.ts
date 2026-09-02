import type { PoolClient } from "pg";
import { dbQuery } from "@/lib/db/postgres";

export type AdminTimetableRowForPublic = {
  id: string;
  university_id: string;
  academic_year: number;
  term_number: number;
  department_label: string;
  class_title: string;
  day_of_week: "月" | "火" | "水" | "木" | "金" | "土";
  period: number;
  room: string | null;
  instructor: string | null;
  note: string | null;
  source_url: string | null;
};

export async function listActiveAdminTimetableRows(
  filters: { universityId?: string; academicYear?: number; termNumber?: number },
): Promise<AdminTimetableRowForPublic[]> {
  const conditions: string[] = ["is_active = true"];
  const values: unknown[] = [];

  if (filters.universityId) {
    values.push(filters.universityId);
    conditions.push(`university_id = $${values.length}::uuid`);
  }
  if (typeof filters.academicYear === "number") {
    values.push(filters.academicYear);
    conditions.push(`academic_year = $${values.length}`);
  }
  if (typeof filters.termNumber === "number") {
    values.push(filters.termNumber);
    conditions.push(`term_number = $${values.length}`);
  }

  const { rows } = await dbQuery<AdminTimetableRowForPublic>(
    `select
       id::text,
       university_id::text,
       academic_year,
       term_number,
       department_label,
       class_title,
       day_of_week,
       period,
       room,
       instructor,
       note,
       source_url
     from admin_university_timetable_entries
     where ${conditions.join(" and ")}
     order by day_of_week asc, period asc`,
    values,
  );
  return rows;
}

export async function listOpenUniversities(): Promise<Array<{ id: string; name: string }>> {
  const { rows } = await dbQuery<{ id: string; name: string }>(
    `select id::text as id, name from universities where is_active = true order by name asc`,
  );
  return rows;
}
