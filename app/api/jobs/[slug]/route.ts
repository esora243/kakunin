import { notFoundResult } from "@/lib/api-results";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { getCachedJobBySlug } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return publicCachedJsonRoute({ code: "job_fetch_failed", message: "求人の取得に失敗しました" }, CACHE_CONTROL, async () => {
    const item = await getCachedJobBySlug(slug);
    return item ? { body: { ok: true, item } } : notFoundResult("求人が見つかりません");
  });
}
