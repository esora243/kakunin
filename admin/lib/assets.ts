import "server-only";

import type { PoolClient } from "pg";
import { dbQuery } from "./db/postgres";
import { ConflictError, NotFoundError } from "./errors";

export type AssetContentType = "image/jpeg" | "image/png" | "image/webp";
export type AssetVariantContentType = "image/webp" | "image/avif";

export type AssetVariantRow = {
  id: string;
  assetId: string;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  contentType: AssetVariantContentType;
  width: number;
  height: number;
  byteSize: number;
  checksum: string;
  createdAt: string;
};

export type AssetRow = {
  id: string;
  bucket: string;
  objectPath: string;
  publicUrl: string;
  contentType: AssetContentType;
  byteSize: number;
  checksum: string;
  uploadedByAdminId: string | null;
  uploadedByEmail: string | null;
  createdAt: string;
  deletedAt: string | null;
  purgedAt: string | null;
  variants: AssetVariantRow[];
};

export type InsertAssetRowInput = {
  bucket: string;
  objectPath: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  checksum: string;
  uploadedByAdminId: string;
};

export type InsertAssetVariantInput = Omit<
  AssetVariantRow,
  "id" | "assetId" | "createdAt"
>;

export type AssetUsageRow = {
  publicUrl: string;
  resourceType: "contents";
  resourceId: string;
  resourceTitle: string;
  usageField: "hero_image_url" | "body_md";
  isActive: boolean;
  publishedAt: string | null;
};

type AssetDbRow = {
  id: string;
  bucket: string;
  object_path: string;
  public_url: string;
  content_type: AssetContentType;
  byte_size: string | number;
  checksum: string;
  uploaded_by_admin_id: string | null;
  uploaded_by_email: string | null;
  created_at: string;
  deleted_at: string | null;
  purged_at: string | null;
};

type AssetVariantDbRow = {
  id: string;
  asset_id: string;
  bucket: string;
  object_path: string;
  public_url: string;
  content_type: AssetVariantContentType;
  width: number;
  height: number;
  byte_size: string | number;
  checksum: string;
  created_at: string;
};

function toAssetVariantRow(row: AssetVariantDbRow): AssetVariantRow {
  return {
    id: row.id,
    assetId: row.asset_id,
    bucket: row.bucket,
    objectPath: row.object_path,
    publicUrl: row.public_url,
    contentType: row.content_type,
    width: Number(row.width),
    height: Number(row.height),
    byteSize: Number(row.byte_size),
    checksum: row.checksum,
    createdAt: row.created_at,
  };
}

function toAssetRow(row: AssetDbRow, variants: AssetVariantRow[] = []): AssetRow {
  return {
    id: row.id,
    bucket: row.bucket,
    objectPath: row.object_path,
    publicUrl: row.public_url,
    contentType: row.content_type,
    byteSize: Number(row.byte_size),
    checksum: row.checksum,
    uploadedByAdminId: row.uploaded_by_admin_id,
    uploadedByEmail: row.uploaded_by_email,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    purgedAt: row.purged_at,
    variants,
  };
}

async function listAssetVariantsForAssetIds(assetIds: string[]): Promise<Map<string, AssetVariantRow[]>> {
  const variants = new Map<string, AssetVariantRow[]>();
  if (assetIds.length === 0) return variants;
  const { rows } = await dbQuery<AssetVariantDbRow>(
    `select id::text, asset_id::text, bucket, object_path, public_url, content_type,
            width, height, byte_size, checksum, created_at::text
     from asset_variants
     where asset_id = any($1::uuid[])
     order by asset_id, width, content_type`,
    [assetIds],
  );
  for (const row of rows) {
    const variant = toAssetVariantRow(row);
    variants.set(variant.assetId, [...(variants.get(variant.assetId) ?? []), variant]);
  }
  return variants;
}

/** Inserts a new assets row inside the caller's dbTransaction. */
export async function insertAssetRow(client: PoolClient, input: InsertAssetRowInput): Promise<AssetRow> {
  const { rows } = await client.query<AssetDbRow>(
    `insert into assets (bucket, object_path, public_url, content_type, byte_size, checksum, uploaded_by_admin_id)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, bucket, object_path, public_url, content_type, byte_size, checksum,
               uploaded_by_admin_id, null as uploaded_by_email, created_at, deleted_at, purged_at`,
    [
      input.bucket,
      input.objectPath,
      input.publicUrl,
      input.contentType,
      input.byteSize,
      input.checksum,
      input.uploadedByAdminId,
    ],
  );
  return toAssetRow(rows[0]);
}

export async function insertAssetVariants(
  client: PoolClient,
  assetId: string,
  variants: InsertAssetVariantInput[],
): Promise<AssetVariantRow[]> {
  const inserted: AssetVariantRow[] = [];
  for (const variant of variants) {
    const { rows } = await client.query<AssetVariantDbRow>(
      `insert into asset_variants
         (asset_id, bucket, object_path, public_url, content_type, width, height, byte_size, checksum)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id::text, asset_id::text, bucket, object_path, public_url, content_type,
                 width, height, byte_size, checksum, created_at::text`,
      [
        assetId,
        variant.bucket,
        variant.objectPath,
        variant.publicUrl,
        variant.contentType,
        variant.width,
        variant.height,
        variant.byteSize,
        variant.checksum,
      ],
    );
    inserted.push(toAssetVariantRow(rows[0]));
  }
  return inserted;
}

/** Lists assets, most recent first, joined with the uploading admin's email. */
export async function listAssetRows(options: { includeDeleted?: boolean } = {}): Promise<AssetRow[]> {
  const { includeDeleted = false } = options;
  const { rows } = await dbQuery<AssetDbRow>(
    `select a.id, a.bucket, a.object_path, a.public_url, a.content_type, a.byte_size, a.checksum,
            a.uploaded_by_admin_id, u.email as uploaded_by_email, a.created_at, a.deleted_at, a.purged_at
     from assets a
     left join admin_users u on u.id = a.uploaded_by_admin_id
     where $1 or a.deleted_at is null
     order by a.created_at desc`,
    [includeDeleted],
  );
  const variants = await listAssetVariantsForAssetIds(rows.map((row) => row.id));
  return rows.map((row) => toAssetRow(row, variants.get(row.id) ?? []));
}

export async function getAssetRowById(id: string): Promise<AssetRow | null> {
  const { rows } = await dbQuery<AssetDbRow>(
    `select a.id, a.bucket, a.object_path, a.public_url, a.content_type, a.byte_size, a.checksum,
            a.uploaded_by_admin_id, u.email as uploaded_by_email, a.created_at, a.deleted_at, a.purged_at
     from assets a
     left join admin_users u on u.id = a.uploaded_by_admin_id
     where a.id = $1
     limit 1`,
    [id],
  );
  if (!rows[0]) return null;
  const variants = await listAssetVariantsForAssetIds([rows[0].id]);
  return toAssetRow(rows[0], variants.get(rows[0].id) ?? []);
}

const ASSET_REFERENCE_LOCK_KEY = 2_024_608_001;

export async function lockAssetReferenceMutation(client: PoolClient): Promise<void> {
  await client.query("select pg_advisory_xact_lock($1)", [ASSET_REFERENCE_LOCK_KEY]);
}

export async function countContentReferencesToAssetWithClient(client: PoolClient, assetId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `with target_urls as (
       select public_url from assets where id = $1
       union all
       select public_url from asset_variants where asset_id = $1
     ), matches as (
       select c.id from contents c join target_urls on c.hero_image_url = target_urls.public_url
       union
       select c.id from contents c join target_urls on position(target_urls.public_url in coalesce(c.body_md, '')) > 0
     )
     select count(*)::text as count from matches`,
    [assetId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function assertContentAssetReferencesAvailable(
  client: PoolClient,
  input: { heroImageUrl: string | null; bodyMd: string | null },
): Promise<void> {
  await lockAssetReferenceMutation(client);
  const { rows } = await client.query<{ public_url: string }>(
    `with managed_urls as (
       select a.public_url, a.deleted_at, a.purged_at
       from assets a
       union all
       select v.public_url, a.deleted_at, a.purged_at
       from asset_variants v
       join assets a on a.id = v.asset_id
     )
     select public_url
     from managed_urls
     where (deleted_at is not null or purged_at is not null)
       and (public_url = $1 or position(public_url in coalesce($2, '')) > 0)
     limit 1`,
    [input.heroImageUrl, input.bodyMd],
  );
  if (rows[0]) {
    throw new ConflictError("Content references an unavailable managed image", "asset_unavailable");
  }
}

/** Logical delete: serializes against Content writes and does not touch Cloud Storage. */
export async function softDeleteAsset(client: PoolClient, id: string, _actorAdminId: string): Promise<AssetRow> {
  await lockAssetReferenceMutation(client);
  const current = await client.query<AssetDbRow>(
    `select id, bucket, object_path, public_url, content_type, byte_size, checksum,
            uploaded_by_admin_id, null as uploaded_by_email, created_at, deleted_at, purged_at
     from assets where id = $1 for update`,
    [id],
  );
  if (!current.rows[0]) throw new NotFoundError("Asset not found");
  if (current.rows[0].deleted_at) return toAssetRow(current.rows[0]);
  const referenceCount = await countContentReferencesToAssetWithClient(client, id);
  if (referenceCount > 0) {
    throw new ConflictError(
      "Cannot delete: this asset is referenced by Contents. Update the referencing Content first.",
      "asset_referenced",
    );
  }
  const { rows } = await client.query<AssetDbRow>(
    `update assets set deleted_at = now()
     where id = $1 and deleted_at is null
     returning id, bucket, object_path, public_url, content_type, byte_size, checksum,
               uploaded_by_admin_id, null as uploaded_by_email, created_at, deleted_at, purged_at`,
    [id],
  );
  return toAssetRow(rows[0]);
}

export async function listAssetUsageForAssetIds(assetIds: string[]): Promise<Map<string, AssetUsageRow[]>> {
  const usage = new Map<string, AssetUsageRow[]>();
  if (assetIds.length === 0) return usage;

  const { rows } = await dbQuery<{
    asset_id: string;
    public_url: string;
    resource_id: string;
    resource_title: string;
    is_active: boolean;
    published_at: string | null;
    usage_field: "hero_image_url" | "body_md";
    updated_at: string;
  }>(
    `
      with target_assets as (
        select unnest($1::uuid[]) as asset_id
      ), target_urls as (
        select a.id as asset_id, a.public_url
        from assets a join target_assets on target_assets.asset_id = a.id
        union all
        select v.asset_id, v.public_url
        from asset_variants v join target_assets on target_assets.asset_id = v.asset_id
      )
      select
        target_urls.asset_id::text,
        c.hero_image_url as public_url,
        c.id::text as resource_id,
        c.title as resource_title,
        c.is_active,
        c.published_at::text as published_at,
        'hero_image_url'::text as usage_field,
        c.updated_at::text as updated_at
      from contents c
      join target_urls on c.hero_image_url = target_urls.public_url
      union all
      select
        target_urls.asset_id::text,
        target_urls.public_url,
        c.id::text as resource_id,
        c.title as resource_title,
        c.is_active,
        c.published_at::text as published_at,
        'body_md'::text as usage_field,
        c.updated_at::text as updated_at
      from contents c
      join target_urls on position(target_urls.public_url in coalesce(c.body_md, '')) > 0
      order by updated_at desc, resource_id desc
    `,
    [assetIds],
  );
  for (const row of rows) {
    const entries = usage.get(row.asset_id) ?? [];
    entries.push({
      publicUrl: row.public_url,
      resourceType: "contents",
      resourceId: row.resource_id,
      resourceTitle: row.resource_title,
      usageField: row.usage_field,
      isActive: row.is_active,
      publishedAt: row.published_at,
    });
    usage.set(row.asset_id, entries);
  }
  return usage;
}
