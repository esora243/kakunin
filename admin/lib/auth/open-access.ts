import "server-only";

import type { AdminIdentity } from "./types";

/**
 * オープンアクセスモード (常時有効)。
 *
 * 利用者の要望により、管理画面は認証を一切行わない。
 * Google OAuth セッションも `admin_users` の DB ルックアップも行わず、
 * 管理画面のURLを知っていれば誰でも組み込みの owner 管理者として
 * 全機能を利用できる。
 *
 * 注意: URL を知る全員が全機能を操作できる。認証を復活させる場合は
 * `OPEN_ACCESS_ALWAYS_ON` を false にし、GOOGLE_OAUTH_* /
 * ADMIN_SESSION_SECRET を設定すること。
 */
export const OPEN_ACCESS_ADMIN_ID = "00000000-0000-0000-0000-000000000002";
export const OPEN_ACCESS_EMAIL = "open-access@hugmeid.local";

// 認証を完全に無効化するため常に true (依頼: 「認証を必ず無くして誰でも入れるように」)。
const OPEN_ACCESS_ALWAYS_ON = true;

export function isOpenAccessEnabled(_env: NodeJS.ProcessEnv = process.env): boolean {
  return OPEN_ACCESS_ALWAYS_ON;
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
