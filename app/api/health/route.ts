import { NextResponse } from "next/server";
import { DatabaseConfigError, dbQuery, getDatabaseRuntimeEnvironment } from "@/lib/db/postgres";
import { assertPublicRuntimeConfig, releaseSha } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

function healthResponse(ok: boolean, status = 200, sha?: string) {
  return NextResponse.json({ ok }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(sha ? { "X-Hugmeid-Release-SHA": sha } : {}),
    },
  });
}

export async function GET() {
  try {
    getDatabaseRuntimeEnvironment();
    assertPublicRuntimeConfig();
    await dbQuery("select id from universities limit 1");
    return healthResponse(true, 200, releaseSha());
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      if (error.code === "database_config_missing" && error.deployEnv === "local") {
        return healthResponse(true, 200, releaseSha());
      }
    }
    return healthResponse(false, 503);
  }
}
