import { invalidRequestResult } from "@/lib/api-results";
import { recordSponsorClick } from "@/lib/click-tracking";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { rejectRateLimitedRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const KNOWN_PLACEMENTS = new Set(["school", "jobs", "activities", "contents"]);

/**
 * 広告（スポンサー枠）クリックの記録。広告リンクのクリック時に送られる。
 * 配置キーは既知のものだけ受け付ける。
 */
export async function POST(request: Request) {
  const rateLimitResponse = rejectRateLimitedRequest(request, {
    namespace: "tracking:sponsor-click",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return publicCachedJsonRoute(
    { code: "click_record_failed", message: "クリックの記録に失敗しました" },
    "no-store",
    async () => {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return invalidRequestResult("Request body must be a JSON object");
      }
      const placement = (body as Record<string, unknown>).placement;
      const href = (body as Record<string, unknown>).href;
      if (typeof placement !== "string" || !KNOWN_PLACEMENTS.has(placement)) {
        return invalidRequestResult("placement is invalid");
      }
      if (typeof href !== "string" || !href.trim()) {
        return invalidRequestResult("href is required");
      }
      await recordSponsorClick(placement, href);
      return { body: { ok: true } };
    },
  );
}
