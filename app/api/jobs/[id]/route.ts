import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("*")
      .eq("id", params.id)
      .eq("is_published", true)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    return NextResponse.json({ job: data });
  } catch (error) {
    console.error("GET /api/jobs/[id] failed", error);
    return NextResponse.json({ error: "求人詳細の取得に失敗しました" }, { status: 500 });
  }
}
