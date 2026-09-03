import { invalidRequestResult } from "@/lib/api-results";
import { recordContentClick } from "@/lib/click-tracking";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { rejectRateLimitedRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/**
 * 記事クリックの記録。記事詳細ページを開いたときに1回送られる。
 * 不正な連打を防ぐため、IP ごとに 1 分間 10 回までに制限する。
 */
export async function POST(request: Request) {
  const rateLimitResponse = rejectRateLimitedRequest(request, {
    namespace: "tracking:content-click",
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return publicCachedJsonRoute(
    { code: "click_record_failed", message: "クリックの記録に失敗しました" },
    "no-store",
    async () => {
      const body = await request.json().catch(() => null);
      const contentId =
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>).contentId
          : null;
      if (typeof contentId !== "string" || !contentId.trim()) {
        return invalidRequestResult("contentId is required");
      }
      const recorded = await recordContentClick(contentId);
      if (!recorded) return invalidRequestResult("Content is not available");
      return { body: { ok: true } };
    },
  );
}
