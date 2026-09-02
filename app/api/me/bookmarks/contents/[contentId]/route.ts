import { deleteContentBookmarkForSession, saveContentBookmarkForSession } from "@/lib/bookmarks";
import { notFoundResult, unauthorizedResult } from "@/lib/api-results";
import { guardedSessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ contentId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { contentId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_save_failed", message: "Failed to save bookmark" },
    async (session) => {
      const result = await saveContentBookmarkForSession(session, contentId);
      if (result === "unauthorized") return unauthorizedResult();
      if (result === "not_found") return notFoundResult("Content is not bookmarkable");
      return { body: { ok: true, saved: true } };
    },
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { contentId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_delete_failed", message: "Failed to delete bookmark" },
    async (session) => {
      const result = await deleteContentBookmarkForSession(session, contentId);
      if (result === "unauthorized") return unauthorizedResult();
      return { body: { ok: true, saved: false } };
    },
  );
}
