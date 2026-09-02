import { NextResponse } from "next/server";
import { DatabaseConfigError } from "@/lib/db/postgres";
import { createDefaultProfileOptions } from "@/lib/profile";
import { getCachedProfileOptions } from "@/lib/public-cache";

export const dynamic = "force-dynamic";
const PUBLIC_PROFILE_OPTIONS_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

export async function GET() {
  try {
    return NextResponse.json(
      { ok: true, item: await getCachedProfileOptions() },
      { headers: { "Cache-Control": PUBLIC_PROFILE_OPTIONS_CACHE_CONTROL } },
    );
  } catch (error) {
    if (error instanceof DatabaseConfigError && error.code === "database_config_missing" && error.deployEnv === "local") {
      return NextResponse.json(
        { ok: true, item: createDefaultProfileOptions() },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: false, error: { code: "internal_error", message: "Failed to fetch profile options" } },
      { status: error instanceof DatabaseConfigError ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
