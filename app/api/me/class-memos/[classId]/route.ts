import { getClassMemoForSession, putClassMemoForSession } from "@/lib/class-detail";
import { notFoundResult } from "@/lib/api-results";
import { parseMemoBody } from "@/lib/class-detail-requests";
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
    { code: "class_memo_fetch_failed", message: "Failed to fetch class memo" },
    async (session) => {
      const item = await getClassMemoForSession(session, classId);
      if (!item) return classNotFound();
      return { body: { ok: true, item } };
    },
  );
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { classId } = await params;
  return guardedSessionJsonBodyRoute(
    request,
    { code: "class_memo_save_failed", message: "Failed to save class memo" },
    async (session, body) => {
      const memoBody = parseMemoBody(body);
      if (!memoBody.ok) return memoBody.result;
      const item = await putClassMemoForSession(session, classId, memoBody.value);
      if (!item) return classNotFound();
      return { body: { ok: true, item } };
    },
  );
}
