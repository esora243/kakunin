import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("id, title, company_name, prefecture, location, location_type, employment_type, job_type, salary, salary_display, schedule, description, requirements, apply_url, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    console.error("GET /api/jobs failed", error);
    return NextResponse.json({ error: "求人の取得に失敗しました" }, { status: 500 });
  }
}
