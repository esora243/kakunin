import { type ApiJsonResult, invalidRequestResult } from "./api-results";
import type { ClassMemoDto, ClassResourceDto, ClassResourceType, ClassTagDto, ClassTaskDto, ClassTaskStatus } from "./class-detail-dto";

const MAX_RESOURCE_TITLE_LENGTH = 120;
const MAX_RESOURCE_URL_LENGTH = 2048;
const MAX_TASK_TITLE_LENGTH = 120;
const MAX_TASK_DESCRIPTION_LENGTH = 2000;
const MAX_MEMO_BODY_LENGTH = 5000;
const MAX_TAG_COUNT = 20;
const MAX_TAG_LABEL_LENGTH = 32;

export type AddResourceInput = {
  type: ClassResourceType;
  title: string | null;
  url: string;
};

export type AddTaskInput = {
  title: string;
  description: string | null;
  dueAt: string | null;
};

export type TagInput = {
  label: string;
  color: string | null;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; result: ApiJsonResult };

const parsed = <T>(value: T): ParseResult<T> => ({ ok: true, value });
const invalidRequest = (message: string): ParseResult<never> => ({ ok: false, result: invalidRequestResult(message) });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableTrimmedString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = asTrimmedString(value);
  return text ? text : null;
}

function limitLength(value: string | null, maxLength: number) {
  if (value === null) return true;
  return value.length <= maxLength;
}

function parseHttpUrl(value: unknown) {
  const text = asTrimmedString(value);
  if (!text) return null;
  if (text.length > MAX_RESOURCE_URL_LENGTH) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function parseIsoDate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return undefined;
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
}

export function parseResourceBody(body: unknown): ParseResult<AddResourceInput> {
  if (!isRecord(body)) return invalidRequest("Invalid JSON body");
  const type = body.type;
  if (type !== "zoom_url" && type !== "material_url" && type !== "other_url") return invalidRequest("Invalid resource type");
  const url = parseHttpUrl(body.url);
  if (!url) return invalidRequest("Valid https url is required");
  const title = nullableTrimmedString(body.title);
  if (!limitLength(title, MAX_RESOURCE_TITLE_LENGTH)) return invalidRequest("title is too long");
  return parsed({ type, title, url });
}

export function parseTaskBody(body: unknown): ParseResult<AddTaskInput> {
  if (!isRecord(body)) return invalidRequest("Invalid JSON body");
  const title = asTrimmedString(body.title);
  if (!title) return invalidRequest("title is required");
  if (title.length > MAX_TASK_TITLE_LENGTH) return invalidRequest("title is too long");
  const description = nullableTrimmedString(body.description);
  if (!limitLength(description, MAX_TASK_DESCRIPTION_LENGTH)) return invalidRequest("description is too long");
  const dueAt = parseIsoDate(body.dueAt);
  if (dueAt === undefined) return invalidRequest("dueAt must be an ISO timestamp");
  return parsed({ title, description, dueAt });
}

export function parseMemoBody(body: unknown): ParseResult<string> {
  if (!isRecord(body)) return invalidRequest("Invalid JSON body");
  if (typeof body.body !== "string") return invalidRequest("body is required");
  if (body.body.length > MAX_MEMO_BODY_LENGTH) return invalidRequest("body is too long");
  return parsed(body.body);
}

export function parseTagsBody(body: unknown): ParseResult<TagInput[]> {
  if (!isRecord(body) || !Array.isArray(body.tags)) return invalidRequest("tags is required");
  if (body.tags.length > MAX_TAG_COUNT) return invalidRequest("too many tags");
  const seen = new Set<string>();
  const tags: TagInput[] = [];
  for (const item of body.tags) {
    if (!isRecord(item)) return invalidRequest("Invalid tag");
    const label = asTrimmedString(item.label);
    if (!label || seen.has(label)) return invalidRequest("Tag labels must be non-empty and unique");
    if (label.length > MAX_TAG_LABEL_LENGTH) return invalidRequest("Tag label is too long");
    seen.add(label);
    const color = nullableTrimmedString(item.color);
    if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return invalidRequest("Tag color must be a hex color");
    tags.push({ label, color });
  }
  return parsed(tags);
}

export function parseTaskStatusBody(body: unknown): ParseResult<ClassTaskStatus> {
  if (!isRecord(body)) return invalidRequest("Invalid JSON body");
  const status = body.status;
  if (status !== "todo" && status !== "submitted" && status !== "skipped") return invalidRequest("Invalid task status");
  return parsed(status);
}

export type ActiveUserRow = {
  id: string;
  university_id: string | null;
  deactivated_at: string | null;
};

export type ActiveClassAccessRow = {
  id: string;
  syllabus_pages: { university_id: string | null; is_active: boolean } | { university_id: string | null; is_active: boolean }[] | null;
};

export type ClassResourceRow = {
  id: string;
  resource_type: ClassResourceType;
  title: string | null;
  url: string;
  created_at: string;
  updated_at: string;
};

export type ClassTaskRow = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  user_class_task_statuses?: { status: ClassTaskStatus } | { status: ClassTaskStatus }[] | null;
};

export type ClassMemoRow = {
  body: string;
  updated_at: string;
};

export type ClassTagRow = {
  id: string;
  syllabus_class_entry_id: string;
  label: string;
  color: string | null;
  created_at: string;
  updated_at: string;
};

function firstRelation<T>(relation: T | T[] | null | undefined): T | null {
  if (!relation) return null;
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export function canAccessClass(user: ActiveUserRow, classRow: ActiveClassAccessRow) {
  const page = firstRelation(classRow.syllabus_pages);
  return Boolean(user.university_id && page?.university_id && user.university_id === page.university_id);
}

export function mapResourceRow(row: ClassResourceRow): ClassResourceDto {
  return {
    id: row.id,
    type: row.resource_type,
    title: row.title,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaskRow(row: ClassTaskRow): ClassTaskDto {
  const status = firstRelation(row.user_class_task_statuses)?.status ?? null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueAt: row.due_at,
    status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMemoRow(classId: string, row: ClassMemoRow | null): ClassMemoDto {
  return { classId, body: row?.body ?? "", updatedAt: row?.updated_at ?? null };
}

export function mapTagRow(row: ClassTagRow): ClassTagDto {
  return {
    id: row.id,
    classId: row.syllabus_class_entry_id,
    label: row.label,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
