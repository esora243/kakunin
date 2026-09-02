import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { purgeDeletedAsset } from "../lib/asset-purge";
import type { AssetRow } from "../lib/assets";
import { ConflictError } from "../lib/errors";

function assetRow(): AssetRow {
  return {
    id: "asset-1",
    bucket: "hugmeid-public-assets-staging",
    objectPath: "contents/source/example/original.webp",
    publicUrl: "https://app.hugmeid.com/api/assets/public/contents/source/example/original.webp",
    contentType: "image/webp",
    byteSize: 1234,
    checksum: "abc123",
    uploadedByAdminId: "admin-1",
    uploadedByEmail: "owner@example.com",
    createdAt: "2026-07-08T00:00:00.000Z",
    deletedAt: "2026-07-08T01:00:00.000Z",
    purgedAt: null,
    variants: [
      {
        id: "variant-1",
        assetId: "asset-1",
        bucket: "hugmeid-public-assets-staging",
        objectPath: "contents/variants/example/w320.webp",
        publicUrl: "https://app.hugmeid.com/api/assets/public/contents/variants/example/w320.webp",
        contentType: "image/webp",
        width: 320,
        height: 180,
        byteSize: 321,
        checksum: "def456",
        createdAt: "2026-07-08T00:00:00.000Z",
      },
    ],
  };
}

function createTransactionStub(options: {
  referenceCount?: number;
  state?: { deleted_at: string | null; purged_at: string | null };
  updateReturnsRow?: boolean;
} = {}) {
  const queries: string[] = [];
  const client = {
    async query(text: string) {
      queries.push(text);
      if (/deleted_at::text, purged_at::text from assets/.test(text)) {
        return {
          rows: [{
            bucket: "hugmeid-public-assets-staging",
            object_path: "contents/source/example/original.webp",
            ...(options.state ?? { deleted_at: "2026-07-08T01:00:00.000Z", purged_at: null }),
          }],
        };
      }
      if (/select count\(\*\)::text as count from matches/.test(text)) {
        return { rows: [{ count: String(options.referenceCount ?? 0) }] };
      }
      if (/from asset_variants/.test(text)) {
        return {
          rows: [{ bucket: "hugmeid-public-assets-staging", object_path: "contents/variants/example/w320.webp" }],
        };
      }
      if (/update assets/.test(text)) {
        return options.updateReturnsRow === false
          ? { rows: [] }
          : { rows: [{ id: "asset-1", purged_at: "2026-07-08T02:00:00.000Z" }] };
      }
      return { rows: [] };
    },
  } as unknown as PoolClient;
  return { client, queries };
}

function dependencies(options: Parameters<typeof createTransactionStub>[0] = {}) {
  const events: string[] = [];
  const tx = createTransactionStub(options);
  return {
    events,
    tx,
    input: {
      actorAdminId: "admin-1",
      asset: assetRow(),
      deleteStoredObjects: async (objects: Array<{ bucket: string; objectPath: string }>) => {
        events.push(`storage.delete:${objects.map((object) => object.objectPath).join(",")}`);
      },
      dbTransaction: async <T>(fn: (client: PoolClient) => Promise<T>) => {
        events.push("db.begin");
        const value = await fn(tx.client);
        events.push("db.commit");
        return value;
      },
      writeAuditLog: async () => {
        events.push("audit.asset.purge");
      },
    },
  };
}

test("purge serializes references, deletes variants before source, then audits", async () => {
  const { input, events } = dependencies();
  const result = await purgeDeletedAsset(input);
  assert.deepEqual(events, [
    "db.begin",
    "db.commit",
    "storage.delete:contents/variants/example/w320.webp,contents/source/example/original.webp",
    "db.begin",
    "audit.asset.purge",
    "db.commit",
  ]);
  assert.deepEqual(result, { id: "asset-1", purged: true });
});

test("purge refuses a reference created through any asset-family URL", async () => {
  const { input, events } = dependencies({ referenceCount: 1 });
  await assert.rejects(
    () => purgeDeletedAsset(input),
    (error) => error instanceof ConflictError && error.code === "asset_referenced",
  );
  assert.deepEqual(events, ["db.begin"]);
});

test("purge leaves state retryable when object deletion fails", async () => {
  const { input, events } = dependencies();
  input.deleteStoredObjects = async () => {
    events.push("storage.delete");
    throw new Error("boom");
  };
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      () => purgeDeletedAsset(input),
      (error) => error instanceof ConflictError && error.code === "purge_storage_delete_failed",
    );
  } finally {
    console.error = originalConsoleError;
  }
  assert.deepEqual(events, ["db.begin", "db.commit", "storage.delete"]);
});

test("purge is idempotent when the locked row is already purged", async () => {
  const { input, events } = dependencies({
    state: { deleted_at: "2026-07-08T01:00:00.000Z", purged_at: "2026-07-08T02:00:00.000Z" },
  });
  assert.deepEqual(await purgeDeletedAsset(input), { id: "asset-1", purged: true });
  assert.deepEqual(events, ["db.begin", "db.commit"]);
});

test("purge rejects a parent that is not logically deleted", async () => {
  const { input } = dependencies({ state: { deleted_at: null, purged_at: null } });
  await assert.rejects(
    () => purgeDeletedAsset(input),
    (error) => error instanceof ConflictError && error.code === "not_logically_deleted",
  );
});
