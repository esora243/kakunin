import { listBookmarksForSession } from "@/lib/bookmarks";
import { unauthorizedResult } from "@/lib/api-results";
import { sessionJsonRoute } from "@/lib/next-json-route";

export const dynamic = "force-dynamic";

export async function GET() {
  return sessionJsonRoute(
    { code: "bookmarks_fetch_failed", message: "Failed to fetch bookmarks" },
    async (session) => {
      const items = await listBookmarksForSession(session);
      if (!items) return unauthorizedResult();
      return { body: { ok: true, items } };
    },
  );
}
