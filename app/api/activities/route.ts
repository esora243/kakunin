import { NextResponse } from "next/server";
import { filterActivityListItems } from "@/lib/activities";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { listCachedActivities } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const PUBLIC_ACTIVITIES_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") ?? undefined;
  if (kind && !/^[a-z0-9_-]+$/i.test(kind)) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_query", message: "kind は英数字、ハイフン、アンダースコアで指定してください" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return publicCachedJsonRoute(
    { code: "activities_fetch_failed", message: "課外活動の取得に失敗しました" },
    PUBLIC_ACTIVITIES_CACHE_CONTROL,
    async () => {
      const items = filterActivityListItems(await listCachedActivities(), {
        q: searchParams.get("q") ?? undefined,
        kind,
      });

      return { body: { ok: true, items } };
    },
  );
}
