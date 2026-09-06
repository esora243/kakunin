import "server-only";

import type { AuthSessionPayload } from "./auth/types";
import type { ClassTaskStatus } from "./class-detail-dto";
import {
  canAccessClass,
  mapMemoRow,
  mapResourceRow,
  mapTagRow,
  mapTaskRow,
  type ActiveClassAccessRow,
  type ActiveUserRow,
  type AddResourceInput,
  type AddTaskInput,
  type ClassMemoRow,
  type ClassResourceRow,
  type ClassTagRow,
  type ClassTaskRow,
  type TagInput,
} from "./class-detail-requests";
import { dbQuery } from "./db/postgres";

async function requireActiveUser(session: AuthSessionPayload) {
  const { rows } = await dbQuery<ActiveUserRow>(
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

async function requireClassAccess(session: AuthSessionPayload, classId: string) {
  const user = await requireActiveUser(session);
  if (!user) return null;
  const { rows } = await dbQuery<ActiveClassAccessRow>(
    `
      select
        sce.id::text,
        json_build_object(
          'university_id', sp.university_id::text,
          'is_active', sp.is_active
        ) as syllabus_pages
      from syllabus_class_entries sce
      join syllabus_pages sp on sp.id = sce.syllabus_page_id
      where sce.id = $1
        and sce.is_active = true
        and sp.is_active = true
      limit 1
    `,
    [classId],
  );
  const classRow = rows[0] ?? null;
  if (!classRow || !canAccessClass(user, classRow)) return null;
  return { user, classRow };
}

async function requireTaskAccess(session: AuthSessionPayload, taskId: string) {
  const user = await requireActiveUser(session);
  if (!user) return null;
  const { rows } = await dbQuery<{ syllabus_class_entries?: ActiveClassAccessRow | ActiveClassAccessRow[] | null }>(
    `
      select
        json_build_object(
          'id', sce.id::text,
          'syllabus_pages', json_build_object(
            'university_id', sp.university_id::text,
            'is_active', sp.is_active
          )
        ) as syllabus_class_entries
      from syllabus_class_tasks sct
      join syllabus_class_entries sce on sce.id = sct.syllabus_class_entry_id
      join syllabus_pages sp on sp.id = sce.syllabus_page_id
      where sct.id = $1
        and sct.is_active = true
        and sce.is_active = true
        and sp.is_active = true
      limit 1
    `,
    [taskId],
  );
  const task = rows[0] ?? null;
  const classRow = Array.isArray(task?.syllabus_class_entries) ? task.syllabus_class_entries[0] ?? null : task?.syllabus_class_entries ?? null;
  if (!classRow || !canAccessClass(user, classRow)) return null;
  return { user };
}

export async function listClassResourcesForSession(session: AuthSessionPayload, classId: string) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  const { rows } = await dbQuery<ClassResourceRow>(
    `
      select id::text, resource_type, title, url, created_at::text, updated_at::text
      from syllabus_class_resources
      where syllabus_class_entry_id = $1
        and is_active = true
      order by created_at asc
    `,
    [classId],
  );
  return rows.map(mapResourceRow);
}

export async function addClassResourceForSession(session: AuthSessionPayload, classId: string, input: AddResourceInput) {
  const access = await requireClassAccess(session, classId);
  if (!access) return "not_found" as const;
  await dbQuery(
    `
      insert into syllabus_class_resources (
        syllabus_class_entry_id,
        resource_type,
        title,
        url,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $5)
    `,
    [classId, input.type, input.title, input.url, session.userId],
  );
  return "created" as const;
}

export async function listClassTasksForSession(session: AuthSessionPayload, classId: string) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  const { rows } = await dbQuery<ClassTaskRow>(
    `
      select
        sct.id::text,
        sct.title,
        sct.description,
        sct.due_at::text,
        sct.created_at::text,
        sct.updated_at::text,
        case
          when ucts.id is null then null
          else json_build_object('status', ucts.status)
        end as user_class_task_statuses
      from syllabus_class_tasks sct
      left join user_class_task_statuses ucts
        on ucts.syllabus_class_task_id = sct.id
       and ucts.user_id = $2
      where sct.syllabus_class_entry_id = $1
        and sct.is_active = true
      order by sct.due_at asc nulls last, sct.created_at asc
    `,
    [classId, session.userId],
  );
  return rows.map(mapTaskRow);
}

export async function addClassTaskForSession(session: AuthSessionPayload, classId: string, input: AddTaskInput) {
  const access = await requireClassAccess(session, classId);
  if (!access) return "not_found" as const;
  await dbQuery(
    `
      insert into syllabus_class_tasks (
        syllabus_class_entry_id,
        title,
        description,
        due_at,
        created_by_user_id,
        updated_by_user_id
      )
      values ($1, $2, $3, $4, $5, $5)
    `,
    [classId, input.title, input.description, input.dueAt, session.userId],
  );
  return "created" as const;
}

export async function getClassMemoForSession(session: AuthSessionPayload, classId: string) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  const { rows } = await dbQuery<ClassMemoRow>(
    `
      select body, updated_at::text
      from user_class_memos
      where user_id = $1
        and syllabus_class_entry_id = $2
      limit 1
    `,
    [session.userId, classId],
  );
  return mapMemoRow(classId, rows[0] ?? null);
}

export async function putClassMemoForSession(session: AuthSessionPayload, classId: string, body: string) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  const { rows } = await dbQuery<ClassMemoRow>(
    `
      insert into user_class_memos (user_id, syllabus_class_entry_id, body)
      values ($1, $2, $3)
      on conflict (user_id, syllabus_class_entry_id)
      do update set body = excluded.body, updated_at = now()
      returning body, updated_at::text
    `,
    [session.userId, classId, body],
  );
  return mapMemoRow(classId, rows[0] ?? null);
}

export async function listClassTagsForSession(session: AuthSessionPayload, classId: string) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  const { rows } = await dbQuery<ClassTagRow>(
    `
      select id::text, syllabus_class_entry_id::text, label, color, created_at::text, updated_at::text
      from user_class_tags
      where user_id = $1
        and syllabus_class_entry_id = $2
      order by label asc
    `,
    [session.userId, classId],
  );
  return rows.map(mapTagRow);
}

export async function upsertClassTagsForSession(session: AuthSessionPayload, classId: string, tags: TagInput[]) {
  const access = await requireClassAccess(session, classId);
  if (!access) return null;
  if (!tags.length) return listClassTagsForSession(session, classId);
  const { rows } = await dbQuery<ClassTagRow>(
    `
      insert into user_class_tags (user_id, syllabus_class_entry_id, label, color)
      select $1::uuid, $2::uuid, incoming.label, incoming.color
      from json_to_recordset($3::json) as incoming(label text, color text)
      on conflict (user_id, syllabus_class_entry_id, label)
      do update set color = excluded.color, updated_at = now()
      returning id::text, syllabus_class_entry_id::text, label, color, created_at::text, updated_at::text
    `,
    [session.userId, classId, JSON.stringify(tags)],
  );
  return rows.map(mapTagRow);
}

export async function putClassTaskStatusForSession(session: AuthSessionPayload, taskId: string, status: ClassTaskStatus) {
  const access = await requireTaskAccess(session, taskId);
  if (!access) return "not_found" as const;
  const completedAt = status === "submitted" ? new Date().toISOString() : null;
  await dbQuery(
    `
      insert into user_class_task_statuses (user_id, syllabus_class_task_id, status, completed_at)
      values ($1, $2, $3, $4)
      on conflict (user_id, syllabus_class_task_id)
      do update set status = excluded.status, completed_at = excluded.completed_at, updated_at = now()
    `,
    [session.userId, taskId, status, completedAt],
  );
  return "updated" as const;
}
