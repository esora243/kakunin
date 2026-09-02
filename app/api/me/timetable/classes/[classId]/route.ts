import { removeUserTimetableClassForSession } from "@/lib/personal-timetable";
import { unauthorizedResult } from "@/lib/api-results";
import { guardedSessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ classId: string }>;
};

export async function DELETE(request: Request, { params }: RouteContext) {
  const { classId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "timetable_remove_failed", message: "Failed to remove timetable class" },
    async (session) => {
      const result = await removeUserTimetableClassForSession(session, classId);
      if (result === "unauthorized") return unauthorizedResult();
      return { body: { ok: true, removed: true } };
    },
  );
}
