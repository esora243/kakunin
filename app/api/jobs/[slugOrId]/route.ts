import { NextResponse } from "next/server";
import { getJobBySlugOrId } from "@/lib/jobs";
import { SupabaseConfigError } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { slugOrId: string } }) {
  try {
    const item = await getJobBySlugOrId(params.slugOrId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "求人が見つかりません" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: { code: "job_fetch_failed", message: "求人の取得に失敗しました" } },
      { status },
    );
  }
}
