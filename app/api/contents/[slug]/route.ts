import { notFoundResult } from "@/lib/api-results";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { getCachedContentBySlug } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return publicCachedJsonRoute({ code: "content_fetch_failed", message: "コンテンツの取得に失敗しました" }, CACHE_CONTROL, async () => {
    const item = await getCachedContentBySlug(slug);
    return item ? { body: { ok: true, item } } : notFoundResult("コンテンツが見つかりません");
  });
}
