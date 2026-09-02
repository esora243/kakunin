import { addClassTaskForSession, listClassTasksForSession } from "@/lib/class-detail";
import { notFoundResult } from "@/lib/api-results";
import { parseTaskBody } from "@/lib/class-detail-requests";
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
    { code: "class_tasks_fetch_failed", message: "Failed to fetch class tasks" },
    async (session) => {
      const items = await listClassTasksForSession(session, classId);
      if (!items) return classNotFound();
      return { body: { ok: true, items } };
    },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const { classId } = await params;
  return guardedSessionJsonBodyRoute(
    request,
    { code: "class_task_create_failed", message: "Failed to create class task" },
    async (session, body) => {
      const input = parseTaskBody(body);
      if (!input.ok) return input.result;
      const result = await addClassTaskForSession(session, classId, input.value);
      if (result === "not_found") return classNotFound();
      return { body: { ok: true, created: true } };
    },
  );
}
