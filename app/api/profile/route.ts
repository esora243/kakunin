import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser(request);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await requireAppUser(request);
    const body = (await request.json()) as {
      name?: string;
      gender?: string | null;
      grade?: number | null;
      university?: string | null;
      club?: string | null;
      desired_dept?: string | null;
    };

    const payload = {
      name: body.name?.trim() || null,
      gender: body.gender ?? null,
      grade: typeof body.grade === "number" ? body.grade : null,
      university: body.university?.trim() || null,
      club: body.club?.trim() || null,
      desired_dept: body.desired_dept?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .update(payload)
      .eq("id", currentUser.id)
      .select("*")
      .single();

    if (error || !user) {
      throw error || new Error("User update failed");
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("PUT /api/profile failed", error);
    return NextResponse.json({ error: "プロフィール更新に失敗しました" }, { status: 400 });
  }
}
