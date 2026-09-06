import { NextResponse } from "next/server";
import { filterContentListItems } from "@/lib/contents";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { listCachedContents } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const PUBLIC_CONTENTS_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const invalidQueryValue = [type, category].find((value) => value && !/^[a-z0-9_-]+$/i.test(value));
  if (invalidQueryValue) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_query", message: "type/category は英数字、ハイフン、アンダースコアで指定してください" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return publicCachedJsonRoute(
    { code: "contents_fetch_failed", message: "コンテンツの取得に失敗しました" },
    PUBLIC_CONTENTS_CACHE_CONTROL,
    async () => {
      const items = filterContentListItems(await listCachedContents(), {
        q: searchParams.get("q") ?? undefined,
        type,
        category,
      });

      return { body: { ok: true, items } };
    },
  );
}
