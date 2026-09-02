import "server-only";

import type { AuthSessionPayload } from "./auth/types";
import { dbQuery } from "./db/postgres";
import {
  buildUserTimetableResponse,
  canAccessTimetableClass,
  mapUserTimetableEntryRow,
  type UserTimetableEntryRow,
} from "./timetable-requests";
import type { SyllabusClassRow } from "./timetable-core";
import type { UserTimetableResponse } from "./timetable-dto";

type ActiveUser = {
  id: string;
  university_id: string | null;
  deactivated_at: string | null;
};

async function requireActiveUser(session: AuthSessionPayload) {
  const { rows } = await dbQuery<ActiveUser>(
    `
      select id::text, university_id::text, deactivated_at::text
      from users
      where id = $1
        and deactivated_at is null
      limit 1
    `,
    [session.userId],
  );
  return rows[0] ?? null;
}

async function getActiveClass(classId: string) {
  const { rows } = await dbQuery<SyllabusClassRow>(
    `
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
          'is_active', sp.is_active,
          'universities', json_build_object('name', u.name)
        ) as syllabus_pages
      from syllabus_class_entries sce
      join syllabus_pages sp on sp.id = sce.syllabus_page_id
      join universities u on u.id = sp.university_id
      where sce.id = $1
        and sce.is_active = true
        and sp.is_active = true
      limit 1
    `,
    [classId],
  );
  return rows[0] ?? null;
}

export async function listUserTimetableForSession(session: AuthSessionPayload): Promise<UserTimetableResponse | null> {
  const user = await requireActiveUser(session);
  if (!user) return null;

  const { rows } = await dbQuery<UserTimetableEntryRow>(
    `
      select
        ute.id::text,
        ute.created_at::text,
        ute.color_label,
        ute.display_order,
        json_build_object(
          'id', sce.id::text,
          'class_key', sce.class_key,
          'title', sce.title,
          'instructor', sce.instructor,
          'room', sce.room,
          'location', sce.location,
          'schedule', sce.schedule,
          'source_type', sce.source_type::text,
          'is_official', sce.is_official,
          'syllabus_pages', json_build_object(
            'academic_year', sp.academic_year,
            'term_number', sp.term_number,
            'university_id', sp.university_id::text,
            'is_active', sp.is_active,
            'universities', json_build_object('name', u.name)
          )
        ) as syllabus_class_entries
      from user_timetable_entries ute
      join syllabus_class_entries sce on sce.id = ute.syllabus_class_entry_id
      join syllabus_pages sp on sp.id = sce.syllabus_page_id
      join universities u on u.id = sp.university_id
      where ute.user_id = $1
        and ute.is_active = true
        and sce.is_active = true
        and sp.is_active = true
      order by ute.display_order asc nulls last, ute.created_at asc
    `,
    [session.userId],
  );
  const entries = rows
    .filter((row) => {
      const classRow = Array.isArray(row.syllabus_class_entries) ? row.syllabus_class_entries[0] ?? null : row.syllabus_class_entries;
      return classRow ? canAccessTimetableClass(user, classRow) : false;
    })
    .map(mapUserTimetableEntryRow)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    ok: true,
    ...buildUserTimetableResponse(entries),
  };
}

export async function addUserTimetableClassForSession(session: AuthSessionPayload, classId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  const classRow = await getActiveClass(classId);
  if (!classRow) return "not_found" as const;
  if (!canAccessTimetableClass(user, classRow)) return "not_found" as const;

  await dbQuery(
    `
      insert into user_timetable_entries (user_id, syllabus_class_entry_id, is_active)
      values ($1, $2, true)
      on conflict (user_id, syllabus_class_entry_id)
      do update set is_active = true, updated_at = now()
    `,
    [session.userId, classId],
  );
  return "added" as const;
}

export async function removeUserTimetableClassForSession(session: AuthSessionPayload, classId: string) {
  const user = await requireActiveUser(session);
  if (!user) return "unauthorized" as const;

  await dbQuery(
    `
      update user_timetable_entries
      set is_active = false, updated_at = now()
      where user_id = $1
        and syllabus_class_entry_id = $2
        and is_active = true
    `,
    [session.userId, classId],
  );
  return "removed" as const;
}
