import { unauthorizedResult } from "@/lib/api-results";
import { sessionJsonRoute } from "@/lib/next-json-route";
import { getMeForSession } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  return sessionJsonRoute(
    { code: "internal_error", message: "Failed to fetch profile" },
    async (session) => {
      const me = await getMeForSession(session);
      return me ? { body: { ok: true, item: me } } : unauthorizedResult();
    },
  );
}
