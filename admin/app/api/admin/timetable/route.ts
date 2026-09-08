// 【Admin 時間割 CRUD】 大学 × 学年 × 学期で講義を追加/更新/削除
import { z } from "zod";
import { accessSourceFromRequest } from "@/auth/access";
import { resolveAdminIdentity } from "@/auth/admin-session";
import { dbQuery } from "@/lib/db/postgres";

const Body = z.object({
  university_name: z.string().min(1),
  department_name: z.string().min(1).default("医学部"),
  academic_year: z.number().int().min(2000).max(2100),
  term_number: z.number().int().min(1).max(4),
  grade: z.number().int().min(1).max(6),
  class_key: z.string().min(1),
  title: z.string().min(1),
  instructor: z.string().nullable().optional(),
  room: z.string().nullable().optional(),
  schedule: z.object({
    day: z.enum(["月", "火", "水", "木", "金", "土", "日"]),
    period: z.number().int().min(1).max(8),
    starts_at: z.string().nullable().optional(),
    ends_at: z.string().nullable().optional(),
  }),
  is_official: z.boolean().default(true),
});

const PutBody = Body.extend({ id: z.string().uuid() });

async function findOrCreateUniversity(name: string) {
  const found = await dbQuery<{ id: string }>(
    "select id from universities where name = $1 limit 1",
    [name],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const created = await dbQuery<{ id: string }>(
    "insert into universities(name, is_active) values ($1, true) returning id",
    [name],
  );
  return created.rows[0].id;
}

async function findOrCreatePage(universityId: string, p: Omit<z.infer<typeof Body>, "instructor" | "room">) {
  const found = await dbQuery<{ id: string }>(
    `select id from syllabus_pages
       where university_id = $1 and academic_year = $2 and term_number = $3
         and grade = $4 and department = $5 and source_kind = 'admin' limit 1`,
    [universityId, p.academic_year, p.term_number, p.grade, p.department_name],
  );
  if (found.rows[0]?.id) return found.rows[0].id;
  const created = await dbQuery<{ id: string }>(
    `insert into syllabus_pages
       (university_id, academic_year, term_number, grade, department, source_kind, is_active)
     values ($1, $2, $3, $4, $5, 'admin', true) returning id`,
    [universityId, p.academic_year, p.term_number, p.grade, p.department_name],
  );
  return created.rows[0].id;
}

export async function POST(req: Request) {
  const me = await resolveAdminIdentity(accessSourceFromRequest(req));
  if (!me) return new Response("forbidden", { status: 403 });

  const body = Body.parse(await req.json());
  const universityId = await findOrCreateUniversity(body.university_name);
  const pageId = await findOrCreatePage(universityId, {
    ...body,
    instructor: body.instructor ?? null,
    room: body.room ?? null,
  });

  const created = await dbQuery<{ id: string }>(
    `insert into syllabus_class_entries
       (syllabus_page_id, class_key, title, instructor, room, schedule,
        source_type, is_official, is_active)
     values ($1, $2, $3, $4, $5, $6::jsonb, 'admin', $7, true) returning id`,
    [
      pageId,
      body.class_key,
      body.title,
      body.instructor ?? null,
      body.room ?? null,
      JSON.stringify(body.schedule),
      body.is_official,
    ],
  );
  return Response.json({ ok: true, id: created.rows[0].id });
}

export async function PUT(req: Request) {
  const me = await resolveAdminIdentity(accessSourceFromRequest(req));
  if (!me) return new Response("forbidden", { status: 403 });
  const body = PutBody.parse(await req.json());
  await dbQuery(
    `update syllabus_class_entries
       set title = $2, instructor = $3, room = $4, schedule = $5::jsonb,
           is_official = $6, updated_at = now()
     where id = $1`,
    [
      body.id,
      body.title,
      body.instructor ?? null,
      body.room ?? null,
      JSON.stringify(body.schedule),
      body.is_official,
    ],
  );
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const me = await resolveAdminIdentity(accessSourceFromRequest(req));
  if (!me) return new Response("forbidden", { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "missing_id" }, { status: 400 });
  await dbQuery(
    "update syllabus_class_entries set is_active = false, updated_at = now() where id = $1",
    [id],
  );
  return Response.json({ ok: true });
}
