import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { writeAuditLog } from "./audit";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { timestampsMatch } from "./concurrency";
import { assertValidSlug } from "./slug";
import { assertApprovalStatusMutable, publishStateOf } from "./publishing";
import { assertContentAssetReferencesAvailable } from "./assets";
import {
  CONTENT_TYPES,
  isContentType,
  type AdminContentRow,
  type ContentCategoryOption,
  type ContentFilters,
  type ContentInput,
} from "./content-dto";

// Contents DB access layer for the admin app. Contents is the primary
// editorial domain (docs/admin-management-app-spec.md "Contents Management").
// Physical deletion is not supported — the hugmeid_admin_runtime capability
// role only has select/insert/update on `contents` (see
// cloudsql/migrations/20260730000002_runtime_access.sql) — so the only "removal"
// path is setActive(..., false).

const UNIQUE_VIOLATION = "23505";

const CONTENT_COLUMNS = `
  id::text,
  slug,
  content_type,
  category,
  title,
  dek,
  body_md,
  hero_image_url,
  thumbnail_image_url,
  related_activity_id::text,
  related_job_id::text,
  published_at::text,
  first_published_at::text,
  approval_status,
  approval_requested_by_admin_id::text,
  approval_requested_at::text,
  approved_by_admin_id::text,
  approved_at::text,
  is_active,
  click_count,
  created_by_admin_id::text,
  updated_by_admin_id::text,
  created_at::text,
  updated_at::text
`;

const COLUMN_FOR: Record<keyof ContentInput, string> = {
  title: "title",
  slug: "slug",
  contentType: "content_type",
  category: "category",
  bodyMd: "body_md",
  dek: "dek",
  heroImageUrl: "hero_image_url",
  thumbnailImageUrl: "thumbnail_image_url",
  relatedActivityId: "related_activity_id",
  relatedJobId: "related_job_id",
};

const ROW_VALUE_FOR: Record<keyof ContentInput, keyof AdminContentRow> = {
  title: "title",
  slug: "slug",
  contentType: "content_type",
  category: "category",
  bodyMd: "body_md",
  dek: "dek",
  heroImageUrl: "hero_image_url",
  thumbnailImageUrl: "thumbnail_image_url",
  relatedActivityId: "related_activity_id",
  relatedJobId: "related_job_id",
};

const REQUIRED_INPUT_KEYS: (keyof ContentInput)[] = ["title", "slug", "contentType", "category", "bodyMd"];

const TEXT_INPUT_KEYS = new Set<keyof ContentInput>([
  "title",
  "slug",
  "dek",
]);

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

function normalizeValue(key: keyof ContentInput, rawValue: unknown): unknown {
  if (rawValue == null) return null;
  if (typeof rawValue === "string" && TEXT_INPUT_KEYS.has(key)) {
    const trimmed = rawValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return rawValue;
}

function assertRequiredPresent(key: keyof ContentInput, value: unknown): void {
  if (value == null || (typeof value === "string" && value.trim().length === 0)) {
    throw new ValidationError(`${COLUMN_FOR[key]} is required`, "missing_required_field");
  }
}

const INPUT_KEYS = Object.keys(COLUMN_FOR) as (keyof ContentInput)[];

/** Picks only the known ContentInput keys out of an arbitrary JSON request body. */
export function pickContentInputFields(body: unknown): Partial<ContentInput> {
  if (typeof body !== "object" || body === null) return {};
  const source = body as Record<string, unknown>;
  const patch: Partial<ContentInput> = {};
  for (const key of INPUT_KEYS) {
    if (key in source) {
      (patch as Record<string, unknown>)[key] = source[key];
    }
  }
  return patch;
}

export async function listContentRows(filters: ContentFilters = {}): Promise<AdminContentRow[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const q = filters.q?.trim();
  if (q) {
    values.push(`%${q}%`);
    conditions.push(`(title ilike $${values.length} or coalesce(dek, '') ilike $${values.length} or slug ilike $${values.length})`);
  }
  const type = filters.type?.trim();
  if (type) {
    values.push(type);
    conditions.push(`content_type = $${values.length}`);
  }
  const category = filters.category?.trim();
  if (category) {
    values.push(category);
    conditions.push(`category = $${values.length}`);
  }

  const where = conditions.length > 0 ? `where ${conditions.join(" and ")}` : "";
  const { rows } = await dbQuery<AdminContentRow>(
    `select ${CONTENT_COLUMNS} from contents ${where} order by updated_at desc`,
    values,
  );

  const state = filters.state?.trim();
  if (state) {
    return rows.filter((row) => publishStateOf(row) === state);
  }
  return rows;
}

export async function getContentRowById(id: string): Promise<AdminContentRow | null> {
  const { rows } = await dbQuery<AdminContentRow>(`select ${CONTENT_COLUMNS} from contents where id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}

export async function listActiveContentCategories(): Promise<ContentCategoryOption[]> {
  const { rows } = await dbQuery<ContentCategoryOption>(
    `select code, name, display_order, is_active
     from content_categories
     where is_active = true
     order by display_order asc, name asc`,
  );
  return rows;
}

export type ContentVersionRow = {
  id: string;
  content_id: string;
  version_no: number;
  snapshot: AdminContentRow;
  created_by_admin_id: string | null;
  created_at: string;
};

async function fetchRowForUpdate(client: PoolClient, id: string): Promise<AdminContentRow | null> {
  const { rows } = await client.query(`select ${CONTENT_COLUMNS} from contents where id = $1 limit 1 for update`, [id]);
  return (rows[0] as AdminContentRow | undefined) ?? null;
}

async function insertContentVersion(client: PoolClient, row: AdminContentRow, actorAdminId: string): Promise<void> {
  await client.query(
    `
      insert into content_versions (content_id, version_no, snapshot, created_by_admin_id)
      values (
        $1,
        coalesce((select max(version_no) + 1 from content_versions where content_id = $1), 1),
        $2::jsonb,
        $3
      )
    `,
    [row.id, JSON.stringify(row), actorAdminId],
  );
}

export async function listContentVersions(contentId: string): Promise<ContentVersionRow[]> {
  const { rows } = await dbQuery<{
    id: string;
    content_id: string;
    version_no: number;
    snapshot: AdminContentRow;
    created_by_admin_id: string | null;
    created_at: string;
  }>(
    `select id::text, content_id::text, version_no, snapshot, created_by_admin_id::text, created_at::text
     from content_versions
     where content_id = $1
     order by version_no desc`,
    [contentId],
  );
  return rows;
}

export async function createContent(
  client: PoolClient,
  input: ContentInput,
  actorAdminId: string,
): Promise<AdminContentRow> {
  for (const key of REQUIRED_INPUT_KEYS) {
    assertRequiredPresent(key, (input as Record<string, unknown>)[key]);
  }
  if (!isContentType(input.contentType)) {
    throw new ValidationError(`content_type must be one of: ${CONTENT_TYPES.join(", ")}`, "invalid_content_type");
  }
  const slug = String(input.slug).trim();
  assertValidSlug(slug);
  const normalizedHeroImageUrl = normalizeValue("heroImageUrl", input.heroImageUrl) as string | null;
  const normalizedThumbnailImageUrl = normalizeValue("thumbnailImageUrl", input.thumbnailImageUrl) as string | null;
  await assertContentAssetReferencesAvailable(client, {
    heroImageUrl: normalizedHeroImageUrl,
    bodyMd: input.bodyMd,
  });

  const values = [
    slug,
    input.contentType,
    String(input.category).trim(),
    String(input.title).trim(),
    normalizeValue("dek", input.dek),
    input.bodyMd,
    normalizedHeroImageUrl,
    normalizedThumbnailImageUrl,
    normalizeValue("relatedActivityId", input.relatedActivityId),
    normalizeValue("relatedJobId", input.relatedJobId),
    actorAdminId,
  ];

  let row: AdminContentRow;
  try {
    const result = await client.query(
      `insert into contents
         (slug, content_type, category, title, dek, body_md, hero_image_url,
          thumbnail_image_url, related_activity_id, related_job_id,
          created_by_admin_id, updated_by_admin_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       returning ${CONTENT_COLUMNS}`,
      values,
    );
    row = result.rows[0] as AdminContentRow;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Slug is already in use", "slug_conflict");
    }
    throw error;
  }

  await writeAuditLog(client, {
    actorAdminId,
    action: "content.create",
    resourceType: "contents",
    resourceId: row.id,
    beforeSnapshot: null,
    afterSnapshot: row,
  });
  await insertContentVersion(client, row, actorAdminId);

  return row;
}

export async function updateContent(
  client: PoolClient,
  id: string,
  patch: Partial<ContentInput>,
  actorAdminId: string,
  options: { expectedUpdatedAt?: string; assertBeforeUpdate?: (before: AdminContentRow) => void } = {},
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Content not found");
  if (options.expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, options.expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  options.assertBeforeUpdate?.(before);

  if ("contentType" in patch && patch.contentType !== undefined) {
    if (!patch.contentType || !isContentType(patch.contentType)) {
      throw new ValidationError(`content_type must be one of: ${CONTENT_TYPES.join(", ")}`, "invalid_content_type");
    }
  }
  if ("slug" in patch && patch.slug !== undefined) {
    assertValidSlug(String(patch.slug).trim());
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  let materialChanged = false;

  for (const key of Object.keys(patch) as (keyof ContentInput)[]) {
    if (!(key in COLUMN_FOR) || patch[key] === undefined) continue;
    const normalized = normalizeValue(key, patch[key]);
    if (REQUIRED_INPUT_KEYS.includes(key)) {
      assertRequiredPresent(key, normalized);
    }
    if (normalized !== before[ROW_VALUE_FOR[key]]) {
      materialChanged = true;
    }
    values.push(normalized);
    setClauses.push(`${COLUMN_FOR[key]} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return { before, after: before };
  }

  await assertContentAssetReferencesAvailable(client, {
    heroImageUrl:
      patch.heroImageUrl === undefined
        ? before.hero_image_url
        : (normalizeValue("heroImageUrl", patch.heroImageUrl) as string | null),
    bodyMd: patch.bodyMd === undefined ? before.body_md : patch.bodyMd,
  });

  const scheduled = before.published_at !== null && new Date(before.published_at).getTime() > Date.now();
  const approvalRevisionChanged =
    materialChanged &&
    (scheduled ||
      (before.published_at === null &&
        (before.approval_status === "approved" || before.approval_status === "in_review")));
  if (approvalRevisionChanged) {
    if (scheduled) setClauses.push("published_at = null");
    setClauses.push(
      "approval_status = 'draft'",
      "approval_requested_by_admin_id = null",
      "approval_requested_at = null",
      "approved_by_admin_id = null",
      "approved_at = null",
    );
  }

  values.push(actorAdminId);
  setClauses.push(`updated_by_admin_id = $${values.length}`);
  values.push(id);

  let after: AdminContentRow;
  try {
    const result = await client.query(
      `update contents set ${setClauses.join(", ")} where id = $${values.length} returning ${CONTENT_COLUMNS}`,
      values,
    );
    after = result.rows[0] as AdminContentRow;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Slug is already in use", "slug_conflict");
    }
    throw error;
  }

  await writeAuditLog(client, {
    actorAdminId,
    action: "content.update",
    resourceType: "contents",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  await insertContentVersion(client, after, actorAdminId);

  return { before, after };
}

/**
 * Updates only the thumbnail URL on a Content row, without resetting the
 * approval workflow or invalidating the public list cache unless the
 * thumbnail is the version actually visible to readers.
 */
export async function updateContentThumbnail(
  client: PoolClient,
  id: string,
  thumbnailImageUrl: string | null,
  actorAdminId: string,
  options: { expectedUpdatedAt?: string } = {},
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Content not found");
  if (
    options.expectedUpdatedAt !== undefined
    && !(await timestampsMatch(client, before.updated_at, options.expectedUpdatedAt))
  ) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  const { rows } = await client.query<AdminContentRow>(
    `update contents set
       thumbnail_image_url = $2,
       updated_by_admin_id = $3
     where id = $1
     returning ${CONTENT_COLUMNS}`,
    [id, thumbnailImageUrl, actorAdminId],
  );
  const after = rows[0];
  await writeAuditLog(client, {
    actorAdminId,
    action: "content.thumbnail_update",
    resourceType: "contents",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
    metadata: { field: "thumbnail_image_url" },
  });
  return { before, after };
}

export async function setPublishedAt(
  client: PoolClient,
  id: string,
  publishedAt: Date | null,
  actorAdminId: string,
  options: { expectedUpdatedAt?: string; assertBeforePublish?: (before: AdminContentRow) => void } = {},
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Content not found");
  if (options.expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, options.expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  if (publishedAt && before.approval_status !== "approved") {
    throw new ValidationError("Content must be approved before publishing or scheduling", "approval_required");
  }
  if (publishedAt) {
    options.assertBeforePublish?.(before);
    await assertContentAssetReferencesAvailable(client, {
      heroImageUrl: before.hero_image_url,
      bodyMd: before.body_md,
    });
  }

  const result = await client.query(
    `update contents set
       published_at = $1,
       first_published_at = case when $1::timestamptz is not null then coalesce(first_published_at, $1::timestamptz) else first_published_at end,
       updated_by_admin_id = $2
     where id = $3
     returning ${CONTENT_COLUMNS}`,
    [publishedAt, actorAdminId, id],
  );
  const after = result.rows[0] as AdminContentRow;

  await writeAuditLog(client, {
    actorAdminId,
    action: publishedAt ? (publishedAt.getTime() > Date.now() ? "content.schedule_publish" : "content.publish") : "content.unpublish",
    resourceType: "contents",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  await insertContentVersion(client, after, actorAdminId);

  return { before, after };
}

export async function setApprovalStatus(
  client: PoolClient,
  id: string,
  status: "in_review" | "approved" | "changes_requested",
  actorAdminId: string,
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Content not found");
  assertApprovalStatusMutable(before);
  const result = await client.query(
    `
      update contents set
        approval_status = $1,
        approval_requested_by_admin_id = case when $1 = 'in_review' then $2 else approval_requested_by_admin_id end,
        approval_requested_at = case when $1 = 'in_review' then now() else approval_requested_at end,
        approved_by_admin_id = case when $1 = 'approved' then $2 else null end,
        approved_at = case when $1 = 'approved' then now() else null end,
        updated_by_admin_id = $2
      where id = $3
      returning ${CONTENT_COLUMNS}
    `,
    [status, actorAdminId, id],
  );
  const after = result.rows[0] as AdminContentRow;
  await writeAuditLog(client, {
    actorAdminId,
    action: `content.${status}`,
    resourceType: "contents",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  await insertContentVersion(client, after, actorAdminId);
  return { before, after };
}

export async function restoreContentVersion(
  client: PoolClient,
  contentId: string,
  versionNo: number,
  actorAdminId: string,
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, contentId);
  if (!before) throw new NotFoundError("Content not found");
  const { rows } = await client.query<{ snapshot: AdminContentRow }>(
    `select snapshot from content_versions where content_id = $1 and version_no = $2 limit 1`,
    [contentId, versionNo],
  );
  const snapshot = rows[0]?.snapshot;
  if (!snapshot) throw new NotFoundError("Content version not found");
  await assertContentAssetReferencesAvailable(client, {
    heroImageUrl: snapshot.hero_image_url,
    bodyMd: snapshot.body_md,
  });
  let result;
  try {
    result = await client.query(
      `
        update contents set
          slug = $2,
          content_type = $3,
          category = $4,
          title = $5,
          dek = $6,
          body_md = $7,
          hero_image_url = $8,
          thumbnail_image_url = $9,
          related_activity_id = $10,
          related_job_id = $11,
          published_at = null,
          approval_status = 'draft',
          approval_requested_by_admin_id = null,
          approval_requested_at = null,
          approved_by_admin_id = null,
          approved_at = null,
          is_active = $12,
          updated_by_admin_id = $13
        where id = $1
        returning ${CONTENT_COLUMNS}
      `,
      [
        contentId,
        snapshot.slug,
        snapshot.content_type,
        snapshot.category,
        snapshot.title,
        snapshot.dek,
        snapshot.body_md,
        snapshot.hero_image_url,
        snapshot.thumbnail_image_url ?? null,
        snapshot.related_activity_id,
        snapshot.related_job_id,
        before.is_active,
        actorAdminId,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError("Slug is already in use", "slug_conflict");
    }
    throw error;
  }
  const after = result.rows[0] as AdminContentRow;
  await writeAuditLog(client, {
    actorAdminId,
    action: "content.version_restore",
    resourceType: "contents",
    resourceId: contentId,
    beforeSnapshot: before,
    afterSnapshot: after,
    metadata: { versionNo },
  });
  await insertContentVersion(client, after, actorAdminId);
  return { before, after };
}

export async function setActive(
  client: PoolClient,
  id: string,
  isActive: boolean,
  actorAdminId: string,
  options: { expectedUpdatedAt?: string; assertBeforeActivation?: (before: AdminContentRow) => void } = {},
): Promise<{ before: AdminContentRow; after: AdminContentRow }> {
  const before = await fetchRowForUpdate(client, id);
  if (!before) throw new NotFoundError("Content not found");
  if (options.expectedUpdatedAt !== undefined && !(await timestampsMatch(client, before.updated_at, options.expectedUpdatedAt))) {
    throw new ConflictError("別の管理者が更新しました。再読み込みしてください", "stale_write");
  }
  if (isActive) {
    options.assertBeforeActivation?.(before);
    await assertContentAssetReferencesAvailable(client, {
      heroImageUrl: before.hero_image_url,
      bodyMd: before.body_md,
    });
  }

  const result = await client.query(
    `update contents set is_active = $1, updated_by_admin_id = $2 where id = $3 returning ${CONTENT_COLUMNS}`,
    [isActive, actorAdminId, id],
  );
  const after = result.rows[0] as AdminContentRow;

  await writeAuditLog(client, {
    actorAdminId,
    action: isActive ? "content.reactivate" : "content.deactivate",
    resourceType: "contents",
    resourceId: id,
    beforeSnapshot: before,
    afterSnapshot: after,
  });
  await insertContentVersion(client, after, actorAdminId);

  return { before, after };
}

/** Throws ValidationError listing any of title/slug/content_type/category/body_md that are missing, per the publish precondition. */
export function assertPublishable(row: AdminContentRow): void {
  const missing: string[] = [];
  if (!row.title || !row.title.trim()) missing.push("title");
  if (!row.slug || !row.slug.trim()) missing.push("slug");
  if (!row.content_type) missing.push("content_type");
  if (!row.category || !row.category.trim()) missing.push("category");
  if (!row.body_md || !row.body_md.trim()) missing.push("body_md");
  if (missing.length > 0) {
    throw new ValidationError(`Cannot publish: missing required fields: ${missing.join(", ")}`, "not_publishable");
  }
}
