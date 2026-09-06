import { deleteJobBookmarkForSession, saveJobBookmarkForSession } from "@/lib/bookmarks";
import { notFoundResult, unauthorizedResult } from "@/lib/api-results";
import { guardedSessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { jobId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_save_failed", message: "Failed to save bookmark" },
    async (session) => {
      const result = await saveJobBookmarkForSession(session, jobId);
      if (result === "unauthorized") return unauthorizedResult();
      if (result === "not_found") return notFoundResult("Job is not bookmarkable");
      return { body: { ok: true, saved: true } };
    },
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { jobId } = await params;
  return guardedSessionJsonRoute(
    request,
    { code: "bookmark_delete_failed", message: "Failed to delete bookmark" },
    async (session) => {
      const result = await deleteJobBookmarkForSession(session, jobId);
      if (result === "unauthorized") return unauthorizedResult();
      return { body: { ok: true, saved: false } };
    },
  );
}
