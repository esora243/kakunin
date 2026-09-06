import { deleteActivityBookmarkForSession, saveActivityBookmarkForSession } from "@/lib/bookmarks";
import { notFoundResult, unauthorizedResult } from "@/lib/api-results";
import { guardedSessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ activityId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { activityId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_save_failed", message: "Failed to save bookmark" },
    async (session) => {
      const result = await saveActivityBookmarkForSession(session, activityId);
      if (result === "unauthorized") return unauthorizedResult();
      if (result === "not_found") return notFoundResult("Activity is not bookmarkable");
      return { body: { ok: true, saved: true } };
    },
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { activityId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_delete_failed", message: "Failed to delete bookmark" },
    async (session) => {
      const result = await deleteActivityBookmarkForSession(session, activityId);
      if (result === "unauthorized") return unauthorizedResult();
      return { body: { ok: true, saved: false } };
    },
  );
}
