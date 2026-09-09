import "server-only";

import type { AdminIdentity } from "./types";

/**
 * オープンアクセスモード。
 *
 * `ADMIN_OPEN_ACCESS=true` のとき、Google OAuth セッションも `admin_users` の
 * DB ルックアップも行わず、管理画面のURLを知っていれば誰でも組み込みの
 * owner 管理者として利用できる。
 *
 * 注意: これは利用者の要望による意図的な仕様であり、URL を知る全員が
 * 全機能を操作できる。一般公開前には必ず無効化すること。
 */
export const OPEN_ACCESS_ADMIN_ID = "00000000-0000-0000-0000-000000000002";
export const OPEN_ACCESS_EMAIL = "open-access@hugmeid.local";

export function isOpenAccessEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ADMIN_OPEN_ACCESS?.trim() === "true";
}

export function resolveOpenAccessIdentity(): AdminIdentity | null {
  if (!isOpenAccessEnabled()) return null;
  return {
    adminId: OPEN_ACCESS_ADMIN_ID,
    email: OPEN_ACCESS_EMAIL,
    role: "owner",
    isActive: true,
  };
}
