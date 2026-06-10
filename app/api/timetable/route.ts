import { NextResponse, type NextRequest } from "next/server";
import { listTimetableClasses } from "@/lib/timetable";
import { SupabaseConfigError } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

/**
 * GET /api/timetable
 *   ?grade=1..6          学年フィルタ
 *   ?university=...      大学名フィルタ（例: 浜松医科大学）
 *
 * 拡張: 各コマに isCuttable / attendanceWeight / departmentSummary /
 *       examMaterialsUrl 等を含めて返す。
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const gradeRaw = searchParams.get("grade");
    const grade = gradeRaw ? Number(gradeRaw) : null;
    const universityName = searchParams.get("university");

    const timetable = await listTimetableClasses({
      grade: grade && !Number.isNaN(grade) ? grade : null,
      universityName: universityName || null,
    });

    return NextResponse.json({ ok: true, ...timetable });
  } catch (error) {
    const status = error instanceof SupabaseConfigError ? 503 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "timetable_fetch_failed",
          message: "時間割の取得に失敗しました",
        },
      },
      { status },
    );
  }
}
