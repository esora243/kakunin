import { listClassTagsForSession, upsertClassTagsForSession } from "@/lib/class-detail";
import { notFoundResult } from "@/lib/api-results";
import { parseTagsBody } from "@/lib/class-detail-requests";
import { guardedSessionJsonBodyRoute, sessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ classId: string }>;
};

function classNotFound() {
  return notFoundResult("Class or task is not available");
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { classId } = await params;
  return sessionJsonRoute(
    { code: "class_tags_fetch_failed", message: "Failed to fetch class tags" },
    async (session) => {
      const items = await listClassTagsForSession(session, classId);
      if (!items) return classNotFound();
      return { body: { ok: true, items } };
    },
  );
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { classId } = await params;
  return guardedSessionJsonBodyRoute(
    request,
    { code: "class_tags_save_failed", message: "Failed to save class tags" },
    async (session, body) => {
      const tags = parseTagsBody(body);
      if (!tags.ok) return tags.result;
      const items = await upsertClassTagsForSession(session, classId, tags.value);
      if (!items) return classNotFound();
      return { body: { ok: true, items } };
    },
  );
}
