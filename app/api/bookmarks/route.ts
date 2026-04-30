import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser(request);

    const { data, error } = await supabaseAdmin
      .from("bookmarks")
      .select("id, user_id, job_id, created_at, jobs:job_id(id, title, company_name, location_type, salary, salary_display)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ bookmarks: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser(request);
    const body = (await request.json()) as { jobId?: string };

    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookmarks")
      .upsert({ user_id: user.id, job_id: body.jobId }, { onConflict: "user_id,job_id" })
      .select("*")
      .single();

    if (error || !data) {
      throw error || new Error("Bookmark upsert failed");
    }

    return NextResponse.json({ bookmark: data });
  } catch (error) {
    console.error("POST /api/bookmarks failed", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireAppUser(request);
    const body = (await request.json()) as { jobId?: string };

    if (!body.jobId) {
      return NextResponse.json({ error: "jobId is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("job_id", body.jobId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/bookmarks failed", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 400 });
  }
}
