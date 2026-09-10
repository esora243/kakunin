import "server-only";

import { resolveDatabaseRuntimeEnvironment } from "../db/environment";
import { AdminAuthError, type AdminIdentity } from "./types";

/**
 * ローカル開発専用の「認証完全バイパス」。
 *
 * `ADMIN_DEV_AUTH_BYPASS=true` かつ `HUGMEID_DEPLOY_ENV=local` のときだけ、
 * Google OAuth セッションも `admin_users` の DB ルックアップも行わず、
 * 組み込みの owner 管理者として admin アプリ全体を利用できる。
 * - local 以外の環境で設定された場合は `local_bypass_not_allowed` で拒否する。
 * - あくまで開発用の踏み台。本番では必ず Google OAuth + admin_users を有効にすること。
 */
export const DEV_BYPASS_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
export const DEV_BYPASS_EMAIL = "dev-admin@local";

export function isDevAuthBypassEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ADMIN_DEV_AUTH_BYPASS?.trim();
  if (!value) return false;
  const runtime = resolveDatabaseRuntimeEnvironment(env);
  if (runtime.deployEnv !== "local") {
    throw new AdminAuthError(
      "ADMIN_DEV_AUTH_BYPASS must not be set outside local development",
      "local_bypass_not_allowed",
    );
  }
  return true;
}

export function resolveDevBypassIdentity(): AdminIdentity | null {
  if (!isDevAuthBypassEnabled()) return null;
  return {
    adminId: DEV_BYPASS_ADMIN_ID,
    email: DEV_BYPASS_EMAIL,
    role: "owner",
    isActive: true,
  };
}
