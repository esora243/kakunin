import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { listCachedTimetableClasses } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const PUBLIC_TIMETABLE_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

export async function GET() {
  return publicCachedJsonRoute(
    { code: "timetable_fetch_failed", message: "時間割の取得に失敗しました" },
    PUBLIC_TIMETABLE_CACHE_CONTROL,
    async () => ({ body: { ok: true, ...(await listCachedTimetableClasses()) } }),
  );
}
