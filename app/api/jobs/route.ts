import { NextResponse } from "next/server";
import { parseNonNegativeNumberParam } from "@/lib/api-query";
import { listJobs } from "@/lib/jobs";
import { SupabaseConfigError } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedSalaryMin = parseNonNegativeNumberParam(searchParams.get("salaryMin"), "salaryMin");
  if (!parsedSalaryMin.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_query", message: parsedSalaryMin.message } },
      { status: 400 },
    );
  }

  try {
    const items = await listJobs({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      employmentType: searchParams.get("employmentType") ?? undefined,
      prefecture: searchParams.get("prefecture") ?? undefined,
      salaryMin: parsedSalaryMin.value,
    });

    return NextResponse.json({ ok: true, items, nextCursor: null });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: { code: "jobs_fetch_failed", message: "求人の取得に失敗しました" } },
      { status },
    );
  }
}
