import { NextResponse } from "next/server";
import { SupabaseConfigError, supabaseRestFetch } from "@/lib/supabase/rest";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await supabaseRestFetch<unknown[]>({ path: "universities?select=id&limit=1" });
    return NextResponse.json({ ok: true, db: "ok" });
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      return NextResponse.json({ ok: true, db: "not_configured" });
    }
    return NextResponse.json({ ok: false, db: "error" }, { status: 500 });
  }
}
