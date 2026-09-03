import "server-only";

import { dbQuery } from "../db/postgres";
import { type AccessSource, localBypassEmail } from "./access";
import { resolveAdminGoogleSessionEmail } from "./google-session";
import { AdminAuthError, type AdminIdentity, type AdminRole } from "./types";

// Re-check admin_users.is_active on every request, but memoize per email for
// up to 5 minutes so deactivation still takes effect quickly per the spec's
// "no longer than 5 minutes" requirement.
const IS_ACTIVE_CACHE_TTL_MS = 5 * 60 * 1000;

type AdminUserRow = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
};

type CacheEntry = { identity: AdminIdentity | null; expiresAt: number };
type AdminUserLookup = (email: string) => Promise<AdminIdentity | null>;

let adminUserLookupForTests: AdminUserLookup | null = null;

const globalForAdminSession = globalThis as typeof globalThis & {
  hugmeidAdminIdentityCache?: Map<string, CacheEntry>;
};

function getCache() {
  if (!globalForAdminSession.hugmeidAdminIdentityCache) {
    globalForAdminSession.hugmeidAdminIdentityCache = new Map();
  }
  return globalForAdminSession.hugmeidAdminIdentityCache;
}

export function setAdminUserLookupForTests(lookup: AdminUserLookup | null): void {
  adminUserLookupForTests = lookup;
  getCache().clear();
}

export async function lookupAdminUserByEmail(email: string): Promise<AdminIdentity | null> {
  if (adminUserLookupForTests) return adminUserLookupForTests(email);

  const { rows } = await dbQuery<AdminUserRow>(
    "select id::text, email, role, is_active from admin_users where email = $1 and deleted_at is null limit 1",
    [email],
  );
  const row = rows[0];
  if (!row) return null;
  return { adminId: row.id, email: row.email, role: row.role, isActive: row.is_active };
}

/**
 * Resolves the verified app-level Google OAuth session email into an active
 * admin_users identity. Returns null when there is no verified identity, the email is
 * not allowed for admin access — callers must treat all
 * three as "no access" and must not distinguish them in user-facing
 * responses to avoid leaking which emails are provisioned.
 */
export async function resolveAdminIdentity(source: AccessSource): Promise<AdminIdentity | null> {
  // 🚨 開発環境用のログインバイパス処理（強制的に管理者として扱う）🚨
  // 注意：本番環境にデプロイする（GitへPushする）前に必ず元のコードに戻してください。
  return {
    adminId: "local-dev-admin-id",
    email: "dev@example.com",
    role: "owner" as AdminRole, // もし権限エラーになる場合は 'admin' 等に変更してください
    isActive: true,
  };

  /* --- 以下、元のコード（現在は実行されません） ---
  const email = localBypassEmail() ?? resolveAdminGoogleSessionEmail(source);
  if (!email) return null;

  const cache = getCache();
  const cached = cache.get(email);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.identity?.isActive ? cached.identity : null;
  }

  const identity = await lookupAdminUserByEmail(email);
  cache.set(email, { identity, expiresAt: now + IS_ACTIVE_CACHE_TTL_MS });
  return identity?.isActive ? identity : null;
  --------------------------------------------- */
}

export function invalidateAdminIdentityCache(email: string) {
  getCache().delete(email.trim().toLowerCase());
}

export { AdminAuthError };