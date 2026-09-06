import { putClassTaskStatusForSession } from "@/lib/class-detail";
import { notFoundResult } from "@/lib/api-results";
import { parseTaskStatusBody } from "@/lib/class-detail-requests";
import { guardedSessionJsonBodyRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ taskId: string }>;
};

export async function PUT(request: Request, { params }: RouteContext) {
  const { taskId } = await params;
  return guardedSessionJsonBodyRoute(
    request,
    { code: "class_task_status_save_failed", message: "Failed to save class task status" },
    async (session, body) => {
      const status = parseTaskStatusBody(body);
      if (!status.ok) return status.result;
      const result = await putClassTaskStatusForSession(session, taskId, status.value);
      if (result === "not_found") return notFoundResult("Class or task is not available");
      return { body: { ok: true, status: status.value } };
    },
  );
}
