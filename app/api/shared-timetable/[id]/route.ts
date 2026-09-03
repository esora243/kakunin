import { invalidRequestResult, notFoundResult } from "@/lib/api-results";
import { sessionJsonRoute } from "@/lib/next-json-route";
import { rejectRateLimitedRequest } from "@/lib/security/rate-limit";
import {
  parseSharedTimetableInput,
  removeSharedTimetableEntry,
  updateSharedTimetableEntry,
} from "@/lib/shared-timetable";

export const dynamic = "force-dynamic";

function idFromUrl(request: Request): string | null {
  const segment = new URL(request.url).pathname.split("/").at(-1);
  return segment && segment.length > 0 ? segment : null;
}

/**
 * 共有時間割エントリの更新・削除。どちらもログイン必須。
 * 共同編集のため、作成者以外のログインユーザーも編集・削除できる。
 */
export async function PATCH(request: Request) {
  const rateLimitResponse = rejectRateLimitedRequest(request, {
    namespace: "shared-timetable:update",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return sessionJsonRoute(
    { code: "shared_timetable_update_failed", message: "共有時間割の更新に失敗しました" },
    async (session) => {
      const id = idFromUrl(request);
      if (!id) return invalidRequestResult("id is required");
      const body = await request.json().catch(() => null);
      const input = parseSharedTimetableInput(body);
      if (!input) return invalidRequestResult("入力内容が正しくありません");
      const result = await updateSharedTimetableEntry(session, id, input);
      if (result === "unauthorized") return invalidRequestResult("ログインが必要です");
      if (result === "not_found") return notFoundResult("共有時間割のエントリが見つかりません");
      return { body: { ok: true, updated: true } };
    },
  );
}

export async function DELETE(request: Request) {
  const rateLimitResponse = rejectRateLimitedRequest(request, {
    namespace: "shared-timetable:delete",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return sessionJsonRoute(
    { code: "shared_timetable_delete_failed", message: "共有時間割の削除に失敗しました" },
    async (session) => {
      const id = idFromUrl(request);
      if (!id) return invalidRequestResult("id is required");
      const result = await removeSharedTimetableEntry(session, id);
      if (result === "unauthorized") return invalidRequestResult("ログインが必要です");
      if (result === "not_found") return notFoundResult("共有時間割のエントリが見つかりません");
      return { body: { ok: true, removed: true } };
    },
  );
}
