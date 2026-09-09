// 【Admin 時間割 CRUD】 大学 × 学年 × 学期で講義を追加/更新/削除
// syllabus_pages / syllabus_class_entries (学年 grade は M020 マイグレーションで追加) を操作する。
import { adminApiRoute } from "@/lib/api-route";
import { dbQuery } from "@/lib/db/postgres";
import { ValidationError } from "@/lib/errors";

const DAY_VALUES = ["月", "火", "水", "木", "金", "土", "日"] as const;
type DayValue = (typeof DAY_VALUES)[number];

type TimetableBody = {
  university_name: string;
  department_name: string;
  academic_year: number;
  term_number: number;
  grade: number;
  class_key: string;
  title: string;
  instructor: string | null;
  room: string | null;
  schedule: {
    day: DayValue;
    period: number;
    starts_at: string | null;
    ends_at: string | null;
  };
  is_official: boolean;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${field} is required`, "missing_required_field");
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireInt(value: unknown, field: string, min: number, max: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max) {
    throw new ValidationError(`${field} must be a number between ${min} and ${max}`, "invalid_number");
  }
  return Math.trunc(num);
}

function parseBody(raw: unknown): TimetableBody {
  if (!raw || typeof raw !== "object") {
    throw new ValidationError("Request body must be a JSON object", "invalid_body");
  }
  const body = raw as Record<string, unknown>;
  const scheduleRaw = (body.schedule ?? {}) as Record<string, unknown>;
  const day = scheduleRaw.day;
  if (typeof day !== "string" || !(DAY_VALUES as readonly string[]).includes(day)) {
    throw new ValidationError("schedule.day must be one of 月 火 水 木 金 土 日", "invalid_day");
  }
  return {
    university_name: requireString(body.university_name, "university_name"),
    department_name: optionalString(body.department_name) ?? "医学部",
    academic_year: requireInt(body.academic_year, "academic_year", 2000, 2100),
    term_number: requireInt(body.term_number, "term_number", 1, 4),
    grade: requireInt(body.grade, "grade", 1, 6),
    class_key: requireString(body.class_key, "class_key"),
    title: requireString(body.title, "title"),
    instructor: optionalString(body.instructor),
    room: optionalString(body.room),
    schedule: {
      day: day as DayValue,
      period: requireInt(scheduleRaw.period, "schedule.period", 1, 8),
      starts_at: optionalString(scheduleRaw.starts_at),
      ends_at: optionalString(scheduleRaw.ends_at),
    },
    is_official: body.is_official !== false,
  };
}

async function findOrCreateUniversity(name: string): Promise<string> {
  const found = await dbQuery<{ id: string }>(
    "select id::text from universities where name = $1 limit 1",
    [name],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const created = await dbQuery<{ id: string }>(
    "insert into universities(name, is_active) values ($1, true) returning id::text",
    [name],
  );
  return created.rows[0].id;
}

async function findOrCreatePage(universityId: string, body: TimetableBody): Promise<string> {
  const found = await dbQuery<{ id: string }>(
    `select id::text from syllabus_pages
       where university_id = $1 and academic_year = $2 and term_number = $3
         and grade = $4 and department = $5 and source_kind = 'admin' limit 1`,
    [universityId, body.academic_year, body.term_number, body.grade, body.department_name],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const created = await dbQuery<{ id: string }>(
    `insert into syllabus_pages
       (university_id, academic_year, term_number, grade, department, source_kind, is_active)
     values ($1, $2, $3, $4, $5, 'admin', true) returning id::text`,
    [universityId, body.academic_year, body.term_number, body.grade, body.department_name],
  );
  return created.rows[0].id;
}

export const POST = adminApiRoute("any", async (_identity, request) => {
  const body = parseBody(await request.json().catch(() => null));
  const universityId = await findOrCreateUniversity(body.university_name);
  const pageId = await findOrCreatePage(universityId, body);

  const created = await dbQuery<{ id: string }>(
    `insert into syllabus_class_entries
       (syllabus_page_id, class_key, title, instructor, room, schedule,
        source_type, is_official, is_active)
     values ($1, $2, $3, $4, $5, $6::jsonb, 'admin', $7, true) returning id::text`,
    [
      pageId,
      body.class_key,
      body.title,
      body.instructor,
      body.room,
      JSON.stringify(body.schedule),
      body.is_official,
    ],
  );
  return { ok: true, id: created.rows[0].id };
});

export const PUT = adminApiRoute("any", async (_identity, request) => {
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = requireString(raw?.id, "id");
  const body = parseBody(raw);
  await dbQuery(
    `update syllabus_class_entries
       set title = $2, instructor = $3, room = $4, schedule = $5::jsonb,
           is_official = $6, updated_at = now()
     where id = $1`,
    [id, body.title, body.instructor, body.room, JSON.stringify(body.schedule), body.is_official],
  );
  return { ok: true };
});

export const DELETE = adminApiRoute("any", async (_identity, request) => {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) throw new ValidationError("id is required", "missing_id");
  await dbQuery(
    "update syllabus_class_entries set is_active = false, updated_at = now() where id = $1",
    [id],
  );
  return { ok: true };
});
