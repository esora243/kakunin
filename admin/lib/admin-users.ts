import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { assertNotActingOnSelf } from "./rbac";
import { ConflictError, ValidationError } from "./errors";
import type { AdminIdentity, AdminRole } from "./auth/types";

export type AdminUserRow = {
  id: string;
  email: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdByAdminId: string | null;
};

type AdminUserDbRow = {
  id: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_admin_id: string | null;
};

function toAdminUserRow(row: AdminUserDbRow): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdByAdminId: row.created_by_admin_id,
  };
}

const ADMIN_USER_COLUMNS =
  "id::text, email, role, is_active, created_at, updated_at, created_by_admin_id::text as created_by_admin_id";

/** Snapshot shape used for audit log before/after payloads. */
export function toAdminUserSnapshot(row: AdminUserRow): { email: string; role: AdminRole; is_active: boolean } {
  return { email: row.email, role: row.role, is_active: row.isActive };
}

export async function listAdminUserRows(): Promise<AdminUserRow[]> {
  const { rows } = await dbQuery<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where deleted_at is null order by created_at asc`,
  );
  return rows.map(toAdminUserRow);
}

export async function getAdminUserRowById(id: string): Promise<AdminUserRow | null> {
  const { rows } = await dbQuery<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where id = $1 and deleted_at is null limit 1`,
    [id],
  );
  return rows[0] ? toAdminUserRow(rows[0]) : null;
}

const UNIQUE_VIOLATION = "23505";

const ADMIN_EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type CreateAdminUserInput = {
  email: string;
  role: AdminRole;
};

export function normalizeAdminEmail(email: unknown): string {
  if (typeof email !== "string") {
    throw new ValidationError("email is required", "invalid_email");
  }
  const normalized = email.trim().toLowerCase();
  if (!normalized || !ADMIN_EMAIL_PATTERN.test(normalized)) {
    throw new ValidationError("email must be a valid email address", "invalid_email");
  }
  return normalized;
}

/**
 * Creates a new admin_users row inside the caller's dbTransaction. Records
 * created_by_admin_id per docs/admin-management-app-spec.md "admin_users".
 */
export async function createAdminUser(
  client: PoolClient,
  input: CreateAdminUserInput,
  actorAdminId: string,
): Promise<AdminUserRow> {
  const email = normalizeAdminEmail(input.email);
  const { rows: deletedRows } = await client.query<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where email = $1 and deleted_at is not null for update`,
    [email],
  );
  if (deletedRows[0]) {
    const { rows } = await client.query<AdminUserDbRow>(
      `update admin_users
       set role = $2, is_active = true, deleted_at = null, created_by_admin_id = $3
       where id = $1
       returning ${ADMIN_USER_COLUMNS}`,
      [deletedRows[0].id, input.role, actorAdminId],
    );
    return toAdminUserRow(rows[0]);
  }
  try {
    const { rows } = await client.query<AdminUserDbRow>(
      `insert into admin_users (email, role, created_by_admin_id)
       values ($1, $2, $3)
       returning ${ADMIN_USER_COLUMNS}`,
      [email, input.role, actorAdminId],
    );
    return toAdminUserRow(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("An admin user with this email already exists", "admin_user_exists");
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

/**
 * Enforces "at least one active owner must remain" before demoting or
 * deactivating a currently-active owner row, per the spec's "Owner
 * guardrails". The database also has a deferred constraint trigger as a
 * backstop, but this check exists to give operators a clear error instead
 * of a raw DB exception.
 */
async function assertLastOwnerNotRemoved(client: PoolClient, target: AdminUserRow): Promise<void> {
  if (target.role !== "owner" || !target.isActive) return;

  const { rows } = await client.query<{ count: string }>(
    `select count(*) as count from admin_users where role = 'owner' and is_active = true and id != $1`,
    [target.id],
  );
  const otherActiveOwners = Number(rows[0]?.count ?? 0);
  if (otherActiveOwners === 0) {
    throw new ConflictError("At least one active owner must remain", "last_owner_required");
  }
}

/**
 * Updates an admin_users row's role, applying both owner guardrails: the
 * last-active-owner check (guardrail #1) and the self-demotion block
 * (guardrail #2). Must be called inside the caller's dbTransaction.
 */
export async function updateAdminUserRole(
  client: PoolClient,
  id: string,
  role: AdminRole,
  actorIdentity: AdminIdentity,
): Promise<{ before: AdminUserRow; after: AdminUserRow }> {
  assertNotActingOnSelf(actorIdentity, id, "Owners cannot change their own role");

  const { rows: currentRows } = await client.query<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where id = $1 and deleted_at is null for update`,
    [id],
  );
  const before = currentRows[0] ? toAdminUserRow(currentRows[0]) : null;
  if (!before) {
    throw new ConflictError("Admin user not found", "not_found");
  }

  if (before.role !== role) {
    await assertLastOwnerNotRemoved(client, before);
  }

  const { rows } = await client.query<AdminUserDbRow>(
    `update admin_users set role = $2 where id = $1 returning ${ADMIN_USER_COLUMNS}`,
    [id, role],
  );
  return { before, after: toAdminUserRow(rows[0]) };
}

/**
 * Sets an admin_users row's active flag, applying both owner guardrails:
 * the last-active-owner check when deactivating (guardrail #1), and the
 * self-action block for both directions (guardrail #2). Must be called
 * inside the caller's dbTransaction.
 */
export async function setAdminUserActive(
  client: PoolClient,
  id: string,
  isActive: boolean,
  actorIdentity: AdminIdentity,
): Promise<{ before: AdminUserRow; after: AdminUserRow }> {
  assertNotActingOnSelf(
    actorIdentity,
    id,
    isActive ? "Owners cannot reactivate their own account" : "Owners cannot deactivate their own account",
  );

  const { rows: currentRows } = await client.query<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where id = $1 and deleted_at is null for update`,
    [id],
  );
  const before = currentRows[0] ? toAdminUserRow(currentRows[0]) : null;
  if (!before) {
    throw new ConflictError("Admin user not found", "not_found");
  }

  if (!isActive && before.isActive) {
    await assertLastOwnerNotRemoved(client, before);
  }

  const { rows } = await client.query<AdminUserDbRow>(
    `update admin_users set is_active = $2 where id = $1 returning ${ADMIN_USER_COLUMNS}`,
    [id, isActive],
  );
  return { before, after: toAdminUserRow(rows[0]) };
}

export async function removeAdminUserFromList(
  client: PoolClient,
  id: string,
  actorIdentity: AdminIdentity,
): Promise<AdminUserRow> {
  assertNotActingOnSelf(actorIdentity, id, "Owners cannot remove their own account");

  const { rows } = await client.query<AdminUserDbRow>(
    `select ${ADMIN_USER_COLUMNS} from admin_users where id = $1 and deleted_at is null for update`,
    [id],
  );
  const before = rows[0] ? toAdminUserRow(rows[0]) : null;
  if (!before) throw new ConflictError("Admin user not found", "not_found");
  if (before.isActive) {
    throw new ConflictError("Deactivate the admin user before removing them from the list", "admin_user_still_active");
  }

  await client.query(`update admin_users set deleted_at = now() where id = $1`, [id]);
  return before;
}
