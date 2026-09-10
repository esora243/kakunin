import { NextResponse } from "next/server";

import { DatabaseConfigError, dbQuery, getDatabaseRuntimeEnvironment } from "@/lib/db/postgres";

export const dynamic = "force-dynamic";

// Cloud Run / 監視用のヘルスチェック。
// 公開アプリ (app/api/health/route.ts) と同じ判定:
// - 環境ラベル (HUGMEID_DEPLOY_ENV / HUGMEID_DATABASE_ENV) の整合
// - DB への実クエリ (users ではなく管理画面の実体 admin_users を参照)
// いずれか失敗で 503 を返す。ローカル開発 (DB 未設定) では 200 を返す。
function healthResponse(ok: boolean, status: number) {
  return NextResponse.json({ ok }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  try {
    getDatabaseRuntimeEnvironment();
    await dbQuery("select id from public.admin_users limit 1");
    return healthResponse(true, 200);
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      if (error.code === "database_config_missing" && error.deployEnv === "local") {
        return healthResponse(true, 200);
      }
    }
    return healthResponse(false, 503);
  }
}
