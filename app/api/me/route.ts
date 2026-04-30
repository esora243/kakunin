import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    const user = await requireAppUser(request);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
