import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { relatedTypePredicate } from "./inquiry-filters";

// Inquiries hold sensitive personal/consultation content, per
// docs/admin-management-app-spec.md "Inquiries". Editors may only ever see
// list metadata (created time, intent, status, related public resource
// title) — never message body, contact fields, raw user identifiers, or
// attachments. Owners get full detail + status update, and every owner
// detail read and every status change must be audit logged.

export type InquiryIntent =
  | "job"
  | "activity"
  | "content"
  | "school_career"
  | "sponsor_partner"
  | "problem_report"
  | "other";

export type InquiryStatus = "open" | "in_progress" | "closed";

export type InquiryRelatedType = "job" | "activity" | "content" | null;

export type InquiryMetadataRow = {
  id: string;
  created_at: string;
  intent: InquiryIntent;
  status: InquiryStatus;
  related_title: string | null;
  related_type: InquiryRelatedType;
};

export type InquiryMetadataFilters = {
  status?: InquiryStatus;
  intent?: InquiryIntent;
  relatedType?: InquiryRelatedType;
};

/**
 * Masks a raw user identifier for display, per spec's "Mask raw user
 * identifiers by default." Shows only a short, non-reversible prefix.
 */
export function maskUserId(userId: string): string {
  return `${userId.slice(0, 8)}…`;
}

// Deliberately never selects user_id, message, or any other contact-shaped
// column — defense in depth so an editor-facing bug cannot leak them even
// by accident, per the task's "if the column isn't in the SELECT list, an
// editor-facing bug can't leak it" rule.
const METADATA_SELECT = `
  select
    i.id::text as id,
    i.created_at::text as created_at,
    i.intent as intent,
    i.status as status,
    coalesce(j.title, a.title, c.title) as related_title,
    case
      when i.job_id is not null then 'job'
      when i.activity_id is not null then 'activity'
      when i.content_id is not null then 'content'
      else null
    end as related_type
  from inquiries i
  left join jobs j on j.id = i.job_id
  left join activities a on a.id = i.activity_id
  left join contents c on c.id = i.content_id
`;

export async function listInquiryMetadataRows(
  filters: InquiryMetadataFilters = {},
): Promise<InquiryMetadataRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    values.push(filters.status);
    conditions.push(`i.status = $${values.length}`);
  }
  if (filters.intent) {
    values.push(filters.intent);
    conditions.push(`i.intent = $${values.length}`);
  }
  if (filters.relatedType) {
    const predicate = relatedTypePredicate(filters.relatedType);
    if (predicate) conditions.push(predicate);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await dbQuery<InquiryMetadataRow>(
    `${METADATA_SELECT} ${where} order by i.created_at desc limit 200`,
    values,
  );
  return rows;
}

// Owner-only full detail row. Includes the raw user_id and message body —
// callers outside this module must never forward this type to a client
// response without masking; use loadInquiryDetailForOwner for that.
export type InquiryDetailRow = {
  id: string;
  user_id: string;
  intent: InquiryIntent;
  job_id: string | null;
  activity_id: string | null;
  content_id: string | null;
  message: string;
  status: InquiryStatus;
  created_at: string;
  updated_at: string;
  related_title: string | null;
  related_type: InquiryRelatedType;
};

export type InquiryDetailDTO = Omit<InquiryDetailRow, "user_id"> & {
  user_id_masked: string;
};

const DETAIL_SELECT = `
  select
    i.id::text as id,
    i.user_id::text as user_id,
    i.intent as intent,
    i.job_id::text as job_id,
    i.activity_id::text as activity_id,
    i.content_id::text as content_id,
    i.message as message,
    i.status as status,
    i.created_at::text as created_at,
    i.updated_at::text as updated_at,
    coalesce(j.title, a.title, c.title) as related_title,
    case
      when i.job_id is not null then 'job'
      when i.activity_id is not null then 'activity'
      when i.content_id is not null then 'content'
      else null
    end as related_type
  from inquiries i
  left join jobs j on j.id = i.job_id
  left join activities a on a.id = i.activity_id
  left join contents c on c.id = i.content_id
  where i.id = $1
  limit 1
`;

export async function getInquiryDetailRow(id: string): Promise<InquiryDetailRow | null> {
  const { rows } = await dbQuery<InquiryDetailRow>(DETAIL_SELECT, [id]);
  return rows[0] ?? null;
}

/**
 * Owner-only: loads full inquiry detail and records the mandatory audit read
 * in one place, so the API route and the Server Component page share a
 * single implementation instead of duplicating the audit side effect. Per
 * spec, the audit entry must not carry the message body — only
 * resource_id/action.
 */
export async function loadInquiryDetailForOwner(
  ownerAdminId: string,
  id: string,
): Promise<InquiryDetailDTO> {
  const row = await getInquiryDetailRow(id);
  if (!row) throw new NotFoundError("Inquiry not found");

  await dbQuery(
    `insert into admin_audit_logs (actor_admin_id, action, resource_type, resource_id, metadata)
     values ($1, 'inquiry.view_detail', 'inquiries', $2, '{}'::jsonb)`,
    [ownerAdminId, id],
  );

  const { user_id, ...rest } = row;
  return { ...rest, user_id_masked: maskUserId(user_id) };
}

// Launch allowed transitions per docs/admin-management-app-spec.md.
// "Inquiries" > "Allowed transitions". `closed -> in_progress` (reopen) is
// allowed here but the API route must additionally require explicit
// confirmation before calling updateInquiryStatus with it.
const ALLOWED_TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["closed"],
  closed: ["in_progress"],
};

export function isAllowedInquiryTransition(from: InquiryStatus, to: InquiryStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Validates and applies a status transition inside the caller's transaction.
 * Never trusts the client-declared `fromStatus` blindly: the UPDATE only
 * applies if the row's current status still matches `fromStatus`, so a
 * stale-state double-submit cannot silently apply an invalid transition.
 */
export async function updateInquiryStatus(
  client: PoolClient,
  id: string,
  fromStatus: InquiryStatus,
  toStatus: InquiryStatus,
): Promise<{ id: string; status: InquiryStatus; updated_at: string }> {
  if (!isAllowedInquiryTransition(fromStatus, toStatus)) {
    throw new ValidationError(
      `Inquiry status cannot transition from "${fromStatus}" to "${toStatus}"`,
      "invalid_inquiry_transition",
    );
  }

  const { rows } = await client.query(
    `update inquiries
       set status = $1
     where id = $2 and status = $3
     returning id::text as id, status as status, updated_at::text as updated_at`,
    [toStatus, id, fromStatus],
  );

  const updated = rows[0] as { id: string; status: InquiryStatus; updated_at: string } | undefined;
  if (!updated) {
    throw new ConflictError("Inquiry status has changed since it was loaded");
  }
  return updated;
}
