import "server-only";

import { dbQuery } from "./db/postgres";

export type AuditLogFilters = {
  actorAdminId?: string;
  resourceType?: string;
  action?: string;
  from?: string;
  to?: string;
};

export type AuditLogListRow = {
  id: string;
  actor_admin_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
};

export type AuditLogDetailRow = AuditLogListRow & {
  before_snapshot: unknown;
  after_snapshot: unknown;
  metadata: unknown;
};

function buildWhereClause(filters: AuditLogFilters): { clause: string; values: unknown[] } {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.actorAdminId) {
    values.push(filters.actorAdminId);
    conditions.push(`l.actor_admin_id = $${values.length}`);
  }
  if (filters.resourceType) {
    values.push(filters.resourceType);
    conditions.push(`l.resource_type = $${values.length}`);
  }
  if (filters.action) {
    values.push(`%${filters.action}%`);
    conditions.push(`l.action ilike $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    conditions.push(`l.created_at >= $${values.length}`);
  }
  if (filters.to) {
    values.push(filters.to);
    conditions.push(`l.created_at <= $${values.length}`);
  }

  const clause = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  return { clause, values };
}

/**
 * Looks up an admin_users id by an exact or partial email match, for the
 * "actor" filter field on the audit logs list page (which accepts either an
 * admin id or an email). Returns the first match's id, or null if none.
 */
export async function findAdminIdByEmail(emailQuery: string): Promise<string | null> {
  const { rows } = await dbQuery<{ id: string }>(
    `select id from admin_users where email ilike $1 order by email limit 1`,
    [`%${emailQuery}%`],
  );
  return rows[0]?.id ?? null;
}

export async function listAuditLogRows(
  filters: AuditLogFilters = {},
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<{ rows: AuditLogListRow[]; total: number }> {
  const { clause, values } = buildWhereClause(filters);

  const { rows } = await dbQuery<AuditLogListRow & { total_count: string }>(
    `select
       l.id,
       l.actor_admin_id,
       au.email as actor_email,
       l.action,
       l.resource_type,
       l.resource_id,
       l.created_at,
       count(*) over() as total_count
     from admin_audit_logs l
     left join admin_users au on au.id = l.actor_admin_id
     ${clause}
     order by l.created_at desc
     limit $${values.length + 1} offset $${values.length + 2}`,
    [...values, limit, offset],
  );

  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  return {
    rows: rows.map(({ total_count, ...row }) => row),
    total,
  };
}

export async function getAuditLogRowById(id: string): Promise<AuditLogDetailRow | null> {
  const { rows } = await dbQuery<AuditLogDetailRow>(
    `select
       l.id,
       l.actor_admin_id,
       au.email as actor_email,
       l.action,
       l.resource_type,
       l.resource_id,
       l.before_snapshot,
       l.after_snapshot,
       l.metadata,
       l.created_at
     from admin_audit_logs l
     left join admin_users au on au.id = l.actor_admin_id
     where l.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
