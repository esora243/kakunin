// 【ユーザー時間割編集】 PATCH /api/me/timetable/overrides
// マスタは変更せず、ユーザー単位の上書きだけ保存する（replace / delete / note の3種類）
import { z } from "zod";
import { getSession } from "@/lib/auth/session";

async function importOverridesLib() {
  const mod = await import("@/lib/personal-timetable-overrides");
  return mod;
}

const Body = z.object({
  classId: z.string().uuid(),
  kind: z.enum(["replace", "delete", "note"]),
  override_schedule: z
    .object({
      day: z.enum(["月", "火", "水", "木", "金", "土", "日"]),
      period: z.number().int().min(1).max(8),
      starts_at: z.string().nullable().optional(),
      ends_at: z.string().nullable().optional(),
    })
    .optional(),
  override_room: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(req: Request) {
  const sess = await getSession();
  if (!sess) return new Response("unauthorized", { status: 401 });

  const body = Body.parse(await req.json());
  const { upsertUserTimetableOverride } = await importOverridesLib();
  await upsertUserTimetableOverride(sess.userId, body.classId, body.kind, {
    override_schedule: body.override_schedule as unknown,
    override_room: body.override_room ?? null,
    note: body.note ?? null,
  });
  return Response.json({ ok: true });
}
