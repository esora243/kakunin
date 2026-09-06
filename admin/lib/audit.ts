import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import type { AdminIdentity } from "./auth/types";

export type AuditLogEntry = {
  actorAdminId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  metadata?: Record<string, unknown>;
};

/**
 * Writes an audit log row using the given transaction client so the mutation
 * and the audit write commit or roll back together. If this insert throws,
 * the caller's dbTransaction rolls back the whole mutation — audit failure
 * must never be swallowed.
 */
export async function writeAuditLog(client: PoolClient, entry: AuditLogEntry): Promise<void> {
  await client.query(
    `insert into admin_audit_logs
       (actor_admin_id, action, resource_type, resource_id, before_snapshot, after_snapshot, metadata)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.actorAdminId,
      entry.action,
      entry.resourceType,
      entry.resourceId ?? null,
      entry.beforeSnapshot === undefined ? null : JSON.stringify(entry.beforeSnapshot),
      entry.afterSnapshot === undefined ? null : JSON.stringify(entry.afterSnapshot),
      JSON.stringify(entry.metadata ?? {}),
    ],
  );
}

const ADMIN_ACCESS_DEDUPE_WINDOW = "30 minutes";

/**
 * Records "admin.access" once per admin per rolling dedupe window. The
 * page and API entrypoints call this when resolving an OAuth-backed admin
 * session, and layout-level calls keep the local bypass path audited too.
 */
export async function recordAdminAccessEventIfNeeded(identity: AdminIdentity): Promise<void> {
  const { rows } = await dbQuery<{ recent: boolean }>(
    `select exists(
       select 1 from admin_audit_logs
       where actor_admin_id = $1
         and action = 'admin.access'
         and created_at > now() - interval '${ADMIN_ACCESS_DEDUPE_WINDOW}'
     ) as recent`,
    [identity.adminId],
  );
  if (rows[0]?.recent) return;

  await dbQuery(
    `insert into admin_audit_logs (actor_admin_id, action, resource_type, resource_id, metadata)
     values ($1::uuid, 'admin.access', 'admin_session', $1::text, '{}'::jsonb)`,
    [identity.adminId],
  );
}
