// 【P040】 ユーザー単位の時間割上書きの書き込みヘルパー
import "server-only";
import { dbQuery } from "./db/postgres";

export async function upsertUserTimetableOverride(
  userId: string,
  classId: string,
  kind: "replace" | "delete" | "note",
  patch: {
    override_schedule?: unknown;
    override_room?: string | null;
    note?: string | null;
  },
) {
  await dbQuery(
    `insert into timetable_user_overrides
       (user_id, syllabus_class_entry_id, override_kind,
        override_schedule, override_room, note, is_active)
     values ($1, $2, $3, $4::jsonb, $5, $6, true)
     on conflict (user_id, syllabus_class_entry_id) where is_active
     do update set override_kind = excluded.override_kind,
                   override_schedule = excluded.override_schedule,
                   override_room = excluded.override_room,
                   note = excluded.note,
                   updated_at = now()`,
    [
      userId,
      classId,
      kind,
      JSON.stringify(patch.override_schedule ?? null),
      patch.override_room ?? null,
      patch.note ?? null,
    ],
  );
}
