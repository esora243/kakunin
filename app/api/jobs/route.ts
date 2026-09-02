import { NextResponse } from "next/server";
import { parseNonNegativeNumberParam } from "@/lib/api-query";
import { filterJobListItems } from "@/lib/jobs";
import { publicCachedJsonRoute } from "@/lib/next-json-route";
import { listCachedJobs } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const PUBLIC_JOBS_CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedSalaryMin = parseNonNegativeNumberParam(searchParams.get("salaryMin"), "salaryMin");
  if (!parsedSalaryMin.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_query", message: parsedSalaryMin.message } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  return publicCachedJsonRoute(
    { code: "jobs_fetch_failed", message: "求人の取得に失敗しました" },
    PUBLIC_JOBS_CACHE_CONTROL,
    async () => {
      const filters = {
        q: searchParams.get("q") ?? undefined,
        category: searchParams.get("category") ?? undefined,
        employmentType: searchParams.get("employmentType") ?? undefined,
        prefecture: searchParams.get("prefecture") ?? undefined,
        salaryMin: parsedSalaryMin.value,
      };
      const items = filterJobListItems(await listCachedJobs(), filters);

      return { body: { ok: true, items } };
    },
  );
}
