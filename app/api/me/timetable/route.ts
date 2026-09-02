import { addUserTimetableClassForSession, listUserTimetableForSession } from "@/lib/personal-timetable";
import { invalidRequestResult, notFoundResult, unauthorizedResult } from "@/lib/api-results";
import { guardedSessionJsonBodyRoute, sessionJsonRoute } from "@/lib/next-json-route";
import { parseTimetableClassIdBody } from "@/lib/timetable-requests";

export const dynamic = "force-dynamic";

export async function GET() {
  return sessionJsonRoute(
    { code: "timetable_fetch_failed", message: "Failed to fetch timetable" },
    async (session) => {
      const timetable = await listUserTimetableForSession(session);
      if (!timetable) return unauthorizedResult();
      return { body: timetable };
    },
  );
}

export async function POST(request: Request) {
  return guardedSessionJsonBodyRoute(
    request,
    { code: "timetable_add_failed", message: "Failed to add timetable class" },
    async (session, body) => {
      const classId = parseTimetableClassIdBody(body);
      if (!classId) return invalidRequestResult("classId is required");

      const result = await addUserTimetableClassForSession(session, classId);
      if (result === "unauthorized") return unauthorizedResult();
      if (result === "not_found") return notFoundResult("Class is not available");
      return { body: { ok: true, added: true } };
    },
  );
}
