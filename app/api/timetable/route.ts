import { NextResponse } from "next/server";
import { listTimetableClasses } from "@/lib/timetable";
import { SupabaseConfigError } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const timetable = await listTimetableClasses();
    return NextResponse.json({ ok: true, ...timetable });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? 503 : 500;
    return NextResponse.json(
      { ok: false, error: { code: "timetable_fetch_failed", message: "時間割の取得に失敗しました" } },
      { status },
    );
  }
}
