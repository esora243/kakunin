import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Storage } from "@google-cloud/storage";
import pg from "pg";
import sharp from "sharp";

const { Pool } = pg;
const WIDTHS = [320, 640, 1280];
const FORMATS = ["webp", "avif"];
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 12_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ASSET_REFERENCE_LOCK_KEY = 2_024_608_001;
const BACKFILL_SINGLETON_LOCK_KEY = 2_024_608_002;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function publicUrlFor(baseUrl, objectPath) {
  return `${baseUrl.replace(/\/+$/, "")}/${objectPath}`;
}

async function generateVariant(source, width, format) {
  const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: true });
  const { data, info } = await (format === "webp"
    ? pipeline.webp({ quality: 82, effort: 4 })
    : pipeline.avif({ quality: 50, effort: 4 })
  ).toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    contentType: `image/${format}`,
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}

export async function assertTarget(client, expectedEnvironment) {
  const expectedDatabase = requiredEnv("HUGMEID_EXPECTED_DATABASE");
  const identity = await client.query("select current_database() as database_name");
  if (identity.rows[0]?.database_name !== expectedDatabase) {
    throw new Error(`Database ${identity.rows[0]?.database_name} does not match expected ${expectedDatabase}`);
  }
  const sentinel = await client.query(
    "select value from public.app_environment where key = 'database_environment'",
  );
  if (sentinel.rows[0]?.value !== expectedEnvironment) {
    throw new Error(`Database environment attestation is not ${expectedEnvironment}`);
  }
  const schema = await client.query("select to_regclass('public.asset_variants')::text as relation");
  if (schema.rows[0]?.relation !== "asset_variants") throw new Error("asset_variants migration is not applied");
}

export async function saveOrAdoptVariant(file, variant) {
  try {
    await file.save(variant.data, {
      contentType: variant.contentType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000, immutable" },
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    const [metadata] = await file.getMetadata();
    if (!metadata.generation) throw new Error(`Created object ${file.name} has no generation`);
    return { created: true, generation: metadata.generation };
  } catch (error) {
    const code = error && typeof error === "object" ? error.code ?? error.statusCode : undefined;
    if (code !== 412) throw error;
    const [metadata] = await file.getMetadata();
    if (
      metadata.contentType !== variant.contentType ||
      metadata.cacheControl !== "public, max-age=31536000, immutable"
    ) {
      throw new Error(`Existing orphan ${file.name} has unexpected metadata`);
    }
    const [existing] = await file.download();
    const checksum = createHash("sha256").update(existing).digest("hex");
    if (checksum !== variant.checksum) throw new Error(`Existing orphan ${file.name} does not match generated content`);
    return { created: false, generation: undefined };
  }
}

export async function acquireBackfillLock(client) {
  const result = await client.query("select pg_try_advisory_lock($1) as acquired", [BACKFILL_SINGLETON_LOCK_KEY]);
  if (result.rows[0]?.acquired !== true) throw new Error("Another asset variant backfill is already running");
}

async function backfillAsset({ asset, bucket, baseUrl, pool, storage }) {
  const sourceFile = storage.bucket(bucket).file(asset.object_path);
  const [sourceMetadata] = await sourceFile.getMetadata();
  const actualBytes = Number(sourceMetadata.size ?? 0);
  if (!Number.isSafeInteger(actualBytes) || actualBytes < 1 || actualBytes > MAX_UPLOAD_BYTES || actualBytes !== Number(asset.byte_size)) {
    throw new Error(`Asset ${asset.id} source size does not match its database record`);
  }
  if (sourceMetadata.contentType !== asset.content_type) {
    throw new Error(`Asset ${asset.id} source content type does not match its database record`);
  }
  const source = await sourceFile.download();
  const sourceChecksum = createHash("sha256").update(source[0]).digest("hex");
  if (sourceChecksum !== asset.checksum) throw new Error(`Asset ${asset.id} source checksum does not match its database record`);
  const metadata = await sharp(source[0]).metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_IMAGE_DIMENSION ||
    metadata.height > MAX_IMAGE_DIMENSION ||
    metadata.width * metadata.height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(`Asset ${asset.id} exceeds the image processing limits`);
  }

  const stored = [];
  const variants = [];
  const widths = [...new Set(WIDTHS.map((width) => Math.min(width, metadata.width)))];
  try {
    for (const width of widths) {
      for (const format of FORMATS) {
        const variant = await generateVariant(source[0], width, format);
        const objectPath = `contents/variants/${asset.id}/w${variant.width}.${format}`;
        const file = storage.bucket(bucket).file(objectPath);
        const saved = await saveOrAdoptVariant(file, variant);
        if (saved.created) stored.push({ objectPath, generation: saved.generation });
        variants.push({
          bucket,
          objectPath,
          publicUrl: publicUrlFor(baseUrl, objectPath),
          contentType: variant.contentType,
          width: variant.width,
          height: variant.height,
          byteSize: variant.data.byteLength,
          checksum: variant.checksum,
        });
      }
    }

    const delivery = variants
      .filter((variant) => variant.contentType === "image/webp")
      .sort((left, right) => right.width - left.width)[0];
    if (!delivery) throw new Error(`Asset ${asset.id} has no WebP delivery variant`);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("select pg_advisory_xact_lock($1)", [ASSET_REFERENCE_LOCK_KEY]);
      const current = await client.query(
        "select deleted_at, purged_at from assets where id = $1 for update",
        [asset.id],
      );
      if (!current.rows[0] || current.rows[0].deleted_at || current.rows[0].purged_at) {
        throw new Error(`Asset ${asset.id} is no longer active`);
      }
      const existing = await client.query("select count(*)::integer as count from asset_variants where asset_id = $1", [asset.id]);
      if (existing.rows[0]?.count !== 0) throw new Error(`Asset ${asset.id} already has variants`);

      for (const variant of variants) {
        await client.query(
          `insert into asset_variants
             (asset_id, bucket, object_path, public_url, content_type, width, height, byte_size, checksum)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            asset.id,
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
      }
      await client.query("update contents set hero_image_url = $1 where hero_image_url = $2", [delivery.publicUrl, asset.public_url]);
      await client.query(
        "update contents set body_md = replace(body_md, $2, $1) where position($2 in coalesce(body_md, '')) > 0",
        [delivery.publicUrl, asset.public_url],
      );
      await client.query(
        `insert into admin_audit_logs (action, resource_type, resource_id, metadata)
         values ('asset.variants.backfill', 'assets', $1, $2::jsonb)`,
        [
          asset.id,
          JSON.stringify({
            sourceUrl: asset.public_url,
            deliveryUrl: delivery.publicUrl,
            variantCount: variants.length,
            runId: requiredEnv("HUGMEID_BACKFILL_RUN_ID"),
          }),
        ],
      );
      await client.query("commit");
      return variants.length;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch (rollbackError) {
        console.error("asset variant backfill rollback failed", { assetId: asset.id, rollbackError });
      }
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    try {
      const committed = await pool.query(
        "select count(*)::integer as count from asset_variants where asset_id = $1",
        [asset.id],
      );
      if (committed.rows[0]?.count === variants.length && variants.length > 0) {
        console.warn("asset variant backfill recovered an ambiguous commit", { assetId: asset.id });
        return variants.length;
      }
    } catch (verificationError) {
      console.error("asset variant backfill commit state could not be verified; uploaded objects were retained", {
        assetId: asset.id,
        verificationError,
      });
      throw error;
    }
    for (const object of stored.reverse()) {
      try {
        await storage.bucket(bucket).file(object.objectPath).delete({
          ignoreNotFound: true,
          ifGenerationMatch: object.generation,
        });
      } catch (cleanupError) {
        console.error("asset variant backfill cleanup failed", { bucket, objectPath: object.objectPath, cleanupError });
      }
    }
    throw error;
  }
}

export async function main() {
  const expectedEnvironment = requiredEnv("HUGMEID_DATABASE_ENV");
  if (!new Set(["staging", "production"]).has(expectedEnvironment)) throw new Error("Backfill only supports staging or production");
  if (requiredEnv("HUGMEID_BACKFILL_CONFIRM") !== expectedEnvironment) throw new Error("Backfill confirmation does not match target");
  const apply = process.env.HUGMEID_BACKFILL_APPLY === "1";
  const bucket = requiredEnv("GCS_PUBLIC_ASSET_BUCKET");
  const baseUrl = requiredEnv("GCS_PUBLIC_ASSET_BASE_URL");
  const expectedBaseUrl = requiredEnv("HUGMEID_EXPECTED_ASSET_BASE_URL").replace(/\/+$/, "");
  if (baseUrl.replace(/\/+$/, "") !== expectedBaseUrl) throw new Error("Asset base URL does not match the approved target");
  requiredEnv("HUGMEID_BACKFILL_RUN_ID");
  const pool = new Pool({ max: 2, application_name: "hugmeid-asset-variant-backfill" });
  const storage = new Storage();
  const controlClient = await pool.connect();
  let lockAcquired = false;
  try {
    let assets;
    await acquireBackfillLock(controlClient);
    lockAcquired = true;
    await assertTarget(controlClient, expectedEnvironment);
    const result = await controlClient.query(
      `select a.id::text, a.bucket, a.object_path, a.public_url, a.content_type, a.byte_size, a.checksum
       from assets a
       where a.deleted_at is null and a.purged_at is null
         and not exists (select 1 from asset_variants v where v.asset_id = a.id)
       order by a.created_at`,
    );
    assets = result.rows;
    for (const asset of assets) {
      if (asset.bucket !== bucket) throw new Error(`Asset ${asset.id} bucket does not match configured target`);
      if (!asset.public_url.startsWith(`${expectedBaseUrl}/`)) {
        throw new Error(`Asset ${asset.id} URL does not match configured target`);
      }
      if (!/^[0-9a-f]{64}$/.test(asset.checksum)) throw new Error(`Asset ${asset.id} checksum is not canonical SHA-256`);
    }
    console.log(JSON.stringify({ environment: expectedEnvironment, apply, assets: assets.length }));
    if (!apply) return;
    let variants = 0;
    for (const asset of assets) {
      variants += await backfillAsset({ asset, bucket, baseUrl, pool, storage });
      console.log(JSON.stringify({ assetId: asset.id, status: "backfilled" }));
    }
    console.log(JSON.stringify({ status: "complete", assets: assets.length, variants }));
  } finally {
    if (lockAcquired) {
      try {
        await controlClient.query("select pg_advisory_unlock($1)", [BACKFILL_SINGLETON_LOCK_KEY]);
      } catch (unlockError) {
        console.error("asset variant backfill advisory unlock failed", { unlockError });
      }
    }
    controlClient.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Asset variant backfill failed", error);
    process.exitCode = 1;
  });
}
