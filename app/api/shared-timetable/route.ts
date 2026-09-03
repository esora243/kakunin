import { invalidRequestResult } from "@/lib/api-results";
import { publicCachedJsonRoute, sessionJsonRoute } from "@/lib/next-json-route";
import { rejectRateLimitedRequest } from "@/lib/security/rate-limit";
import {
  addSharedTimetableEntry,
  listSharedTimetableEntries,
  parseSharedTimetableInput,
} from "@/lib/shared-timetable";

export const dynamic = "force-dynamic";

/**
 * 共有時間割（ユーザー共同編集）の API。
 * - GET: 認証不要。公開の共有時間割一覧を返す。
 * - POST: ログイン必須。共有時間割に授業を追加する。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const universityId = url.searchParams.get("universityId") ?? undefined;
  const academicYear = url.searchParams.get("academicYear");
  const termNumber = url.searchParams.get("termNumber");
  return publicCachedJsonRoute(
    { code: "shared_timetable_fetch_failed", message: "共有時間割の取得に失敗しました" },
    "public, max-age=30, stale-while-revalidate=300",
    async () => {
      const entries = await listSharedTimetableEntries({
        universityId,
        academicYear: academicYear ? Number(academicYear) : undefined,
        termNumber: termNumber ? Number(termNumber) : undefined,
      });
      return { body: { ok: true, entries } };
    },
  );
}

export async function POST(request: Request) {
  const rateLimitResponse = rejectRateLimitedRequest(request, {
    namespace: "shared-timetable:add",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return sessionJsonRoute(
    { code: "shared_timetable_add_failed", message: "共有時間割への追加に失敗しました" },
    async (session) => {
      const body = await request.json().catch(() => null);
      const input = parseSharedTimetableInput(body);
      if (!input) return invalidRequestResult("入力内容が正しくありません");
      const result = await addSharedTimetableEntry(session, input);
      if (result === "unauthorized") return invalidRequestResult("ログインが必要です");
      if (result === "invalid_university") return invalidRequestResult("指定した大学が存在しません");
      return { body: { ok: true, added: true } };
    },
  );
}
