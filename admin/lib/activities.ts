import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { writeAuditLog } from "./audit";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { timestampsMatch } from "./concurrency";
import { assertActivityDateRange } from "./date-range";
import { assertValidSlug } from "./slug";

export type ActivityListRow = {
  id: string;
  title: string;
  host_name: string;
  action_type: string;
  location_pref: string | null;
  deadline_at: string | null;
  thumbnail_image_url: string | null;
  is_active: boolean;
  published_at: string | null;
  updated_at: string;
  kind_name: string;
};

export type ActivityDetailRow = ActivityListRow & {
  slug: string;
  kind: string;
  summary: string | null;
  description_md: string | null;
  action_url: string | null;
  target_audience: string | null;
  location_detail: string | null;
  starts_at: string | null;
  ends_at: string | null;
  capacity_display: string | null;
  requirements_json: unknown;
  benefits_json: unknown;
  source_name: string | null;
  source_url: string | null;
  source_last_modified_at: string | null;
  synced_at: string;
  created_at: string;
};

export type ActivityRowFilters = {
  q?: string;
};

export const ACTIVITY_ACTION_TYPES = ["apply", "signup", "join", "attend", "inquire"] as const;
export type ActivityActionType = (typeof ACTIVITY_ACTION_TYPES)[number];

export type ActivityInput = {
  slug: string;
  kind: string;
  title: string;
  hostName: string;
  actionType: ActivityActionType;
  actionUrl?: string | null;
  targetAudience?: string | null;
  locationPref?: string | null;
  locationDetail?: string | null;
  summary?: string | null;
  descriptionMd?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  deadlineAt?: string | null;
  capacityDisplay?: string | null;
  requirementsJson?: string[];
  benefitsJson?: string[];
  sourceName?: string | null;
  sourceUrl?: string | null;
  thumbnailImageUrl?: string | null;
};

const LIST_SELECT = `
  select
    a.id::text,
    a.title,
    a.host_name,
    a.action_type,
    a.location_pref,
    a.deadline_at::text,
    a.thumbnail_image_url,
    a.is_active,
    a.published_at::text,
    a.updated_at::text,
    ak.name as kind_name
  from activities a
  join activity_kinds ak on ak.code = a.kind
`;

export async function listActivityRows(filters: ActivityRowFilters = {}): Promise<ActivityListRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const q = typeof filters.q === "string" ? filters.q.trim() : "";

  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(a.title ilike $${values.length} or a.host_name ilike $${values.length})`);
  }

  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await dbQuery<ActivityListRow>(
    `${LIST_SELECT} ${where} order by a.updated_at desc limit 200`,
    values,
  );
  return rows;
}

export async function getActivityRowById(id: string): Promise<ActivityDetailRow | null> {
  const { rows } = await dbQuery<ActivityDetailRow>(
    `
      select
        a.id::text,
        a.title,
        a.host_name,
        a.action_type,
        a.location_pref,
        a.deadline_at::text,
        a.thumbnail_image_url,
        a.is_active,
        a.published_at::text,
        a.updated_at::text,
        ak.name as kind_name,
        a.slug,
        a.kind,
        a.summary,
        a.description_md,
        a.action_url,
        a.target_audience,
        a.location_detail,
        a.starts_at::text,
        a.ends_at::text,
        a.capacity_display,
        a.requirements_json,
        a.benefits_json,
        a.source_name,
        a.source_url,
        a.source_last_modified_at::text,
        a.synced_at::text,
        a.created_at::text
      from activities a
      join activity_kinds ak on ak.code = a.kind
      where a.id = $1
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function requireString(value: unknown, message: string): string {
  const trimmed = stringOrNull(value);
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

function optionalUrl(value: unknown, field: string): string | null {
  const url = stringOrNull(value);
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) throw new ValidationError(`${field} must be an https URL`);
  return url;
}

function optionalThumbnailUrl(value: unknown): string | null {
  const url = stringOrNull(value);
  if (!url) return null;
  if (!/^https:\/\//i.test(url)) throw new ValidationError("thumbnailImageUrl must be an https URL");
  return url;
}

function optionalTimestamp(value: unknown, field: string): string | null {
  const text = stringOrNull(value);
  if (!text) return null;
  if (Number.isNaN(Date.parse(text))) throw new ValidationError(`${field} must be a valid date/time`);
  return text;
}

function optionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

export function pickActivityInputFields(body: Record<string, unknown>): ActivityInput {
  const actionType = requireString(body.actionType, "Action type is required");
  if (!ACTIVITY_ACTION_TYPES.includes(actionType as ActivityActionType)) {
    throw new ValidationError("Action type is invalid");
  }
  const startsAt = optionalTimestamp(body.startsAt, "Starts at");
  const endsAt = optionalTimestamp(body.endsAt, "Ends at");
  assertActivityDateRange(startsAt, endsAt);

  return {
    slug: requireString(body.slug, "Slug is required"),
    kind: requireString(body.kind, "Kind is required"),
    title: requireString(body.title, "Title is required"),
    hostName: requireString(body.hostName, "Host name is required"),
    actionType: actionType as ActivityActionType,
    actionUrl: optionalUrl(body.actionUrl, "Action URL"),
    targetAudience: stringOrNull(body.targetAudience),
    locationPref: stringOrNull(body.locationPref),
    locationDetail: stringOrNull(body.locationDetail),
    summary: stringOrNull(body.summary),
    descriptionMd: stringOrNull(body.descriptionMd),
    startsAt,
    endsAt,
    deadlineAt: optionalTimestamp(body.deadlineAt, "Deadline at"),
    capacityDisplay: stringOrNull(body.capacityDisplay),
    requirementsJson: optionalStringArray(body.requirementsJson),
    benefitsJson: optionalStringArray(body.benefitsJson),
    sourceName: stringOrNull(body.sourceName),
    sourceUrl: optionalUrl(body.sourceUrl, "Source URL"),
    thumbnailImageUrl: optionalThumbnailUrl(body.thumbnailImageUrl),
  };
}

export function pickActivityThumbnailPatch(body: Record<string, unknown>): { thumbnailImageUrl: string | null } {
  return { thumbnailImageUrl: optionalThumbnailUrl(body.thumbnailImageUrl) };
}

async function getActivityRowByIdForUpdate(client: PoolClient, id: string): Promise<ActivityDetailRow | null> {
  const { rows } = await client.query<ActivityDetailRow>(
    `
      select
        a.id::text,
        a.title,
        a.host_name,
        a.action_type,
        a.location_pref,
        a.deadline_at::text,
        a.thumbnail_image_url,
        a.is_active,
        a.published_at::text,
        a.updated_at::text,
        ak.name as kind_name,
        a.slug,
        a.kind,
        a.summary,
        a.description_md,
        a.action_url,
        a.target_audience,
        a.location_detail,
        a.starts_at::text,
        a.ends_at::text,
        a.capacity_display,
        a.requirements_json,
        a.benefits_json,
        a.source_name,
        a.source_url,
        a.source_last_modified_at::text,
        a.synced_at::text,
        a.created_at::text
      from activities a
      join activity_kinds ak on ak.code = a.kind
      where a.id = $1
      for update of a
      limit 1
    `,
    [id],
  );
  return rows[0] ?? null;
}

export async function createActivity(client: PoolClient, input: ActivityInput, actorAdminId: string): Promise<ActivityDetailRow> {
  assertValidSlug(input.slug);
  let rows: { id: string }[];
  try {
    ({ rows } = await client.query<{ id: string }>(
      `
        insert into activities (
          slug, kind, title, host_name, summary, description_md, action_type, action_url,
          target_audience, location_pref, location_detail, starts_at, ends_at, deadline_at,
          capacity_display, requirements_json, benefits_json, source_name, source_url,
          thumbnail_image_url, source_last_modified_at, synced_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::timestamptz, $13::timestamptz, $14::timestamptz, $15, $16::jsonb, $17::jsonb, $18, $19, $20, now(), now())
        returning id::text
      `,
      [
        input.slug,
        input.kind,
        input.title,
        input.hostName,
        input.summary,
        input.descriptionMd,
        input.actionType,
        input.actionUrl,
        input.targetAudience,
        input.locationPref,
        input.locationDetail,
        input.startsAt,
        input.endsAt,
        input.deadlineAt,
        input.capacityDisplay,
        JSON.stringify(input.requirementsJson ?? []),
        JSON.stringify(input.benefitsJson ?? []),
        input.sourceName,
        input.sourceUrl,
        input.thumbnailImageUrl ?? null,
      ],
    ));
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Slug is already in use", "slug_conflict");
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("Referenced activity kind does not exist", "invalid_foreign_key");
    }
    throw error;
  }
  const after = await getActivityRowByIdForUpdate(client, rows[0].id);
  if (!after) throw new NotFoundError("Activity not found after create");
  await writeAuditLog(client, { actorAdminId, action: "activity.create", resourceType: "activities", resourceId: after.id, afterSnapshot: after });
  return after;
}

export async function updateActivity(
  client: PoolClient,
  id: string,
  input: ActivityInput,
  actorAdminId: string,
  expectedUpdatedAt?: string,
): Promise<{ before: ActivityDetailRow; after: ActivityDetailRow }> {
  const before = await getActivityRowByIdForUpdate(client, id);
  if (!before) throw new NotFoundError("Activity not found");
  if (expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  assertValidSlug(input.slug);
  try {
    await client.query(
      `
        update activities set
          slug = $2,
          kind = $3,
          title = $4,
          host_name = $5,
          summary = $6,
          description_md = $7,
          action_type = $8,
          action_url = $9,
          target_audience = $10,
          location_pref = $11,
          location_detail = $12,
          starts_at = $13::timestamptz,
          ends_at = $14::timestamptz,
          deadline_at = $15::timestamptz,
          capacity_display = $16,
          requirements_json = $17::jsonb,
          benefits_json = $18::jsonb,
          source_name = $19,
          source_url = $20,
          thumbnail_image_url = $21,
          source_last_modified_at = now(),
          synced_at = now()
        where id = $1
      `,
      [
        id,
        input.slug,
        input.kind,
        input.title,
        input.hostName,
        input.summary,
        input.descriptionMd,
        input.actionType,
        input.actionUrl,
        input.targetAudience,
        input.locationPref,
        input.locationDetail,
        input.startsAt,
        input.endsAt,
        input.deadlineAt,
        input.capacityDisplay,
        JSON.stringify(input.requirementsJson ?? []),
        JSON.stringify(input.benefitsJson ?? []),
        input.sourceName,
        input.sourceUrl,
        input.thumbnailImageUrl ?? null,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Slug is already in use", "slug_conflict");
    }
    if (isForeignKeyViolation(error)) {
      throw new ValidationError("Referenced activity kind does not exist", "invalid_foreign_key");
    }
    throw error;
  }
  const after = await getActivityRowByIdForUpdate(client, id);
  if (!after) throw new NotFoundError("Activity not found after update");
  await writeAuditLog(client, { actorAdminId, action: "activity.update", resourceType: "activities", resourceId: id, beforeSnapshot: before, afterSnapshot: after });
  return { before, after };
}

export async function updateActivityThumbnail(
  client: PoolClient,
  id: string,
  thumbnailImageUrl: string | null,
  actorAdminId: string,
  expectedUpdatedAt?: string,
): Promise<{ before: ActivityDetailRow; after: ActivityDetailRow }> {
  const before = await getActivityRowByIdForUpdate(client, id);
  if (!before) throw new NotFoundError("Activity not found");
  if (expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  await client.query(
    `update activities set
       thumbnail_image_url = $2,
       synced_at = now()
     where id = $1`,
    [id, thumbnailImageUrl],
  );
  const after = await getActivityRowByIdForUpdate(client, id);
  if (!after) throw new NotFoundError("Activity not found after thumbnail update");
  await writeAuditLog(client, {
    actorAdminId,
    action: "activity.thumbnail_update",
    resourceType: "activities",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
    metadata: { field: "thumbnail_image_url" },
  });
  return { before, after };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23503";
}

export async function setActivityPublishState(
  client: PoolClient,
  id: string,
  action: "publish" | "unpublish" | "deactivate",
  actorAdminId: string,
  publishedAt: Date = new Date(),
): Promise<{ before: ActivityDetailRow; after: ActivityDetailRow }> {
  const before = await getActivityRowByIdForUpdate(client, id);
  if (!before) throw new NotFoundError("Activity not found");
  if (action === "publish") {
    await client.query("update activities set published_at = $2, is_active = true where id = $1", [id, publishedAt]);
  } else {
    const setClause = action === "unpublish" ? "published_at = null" : "is_active = false";
    await client.query(`update activities set ${setClause} where id = $1`, [id]);
  }
  const after = await getActivityRowByIdForUpdate(client, id);
  if (!after) throw new NotFoundError("Activity not found after state change");
  await writeAuditLog(client, { actorAdminId, action: action === "publish" && publishedAt.getTime() > Date.now() ? "activity.schedule_publish" : `activity.${action}`, resourceType: "activities", resourceId: id, beforeSnapshot: before, afterSnapshot: after });
  return { before, after };
}
