import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { acquireBackfillLock, assertTarget, saveOrAdoptVariant } from "./backfill-asset-variants.mjs";

function variant(data = Buffer.from("variant")) {
  return {
    data,
    contentType: "image/webp",
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}

test("backfill creates a missing variant with an immutable precondition", async () => {
  const calls = [];
  const file = {
    name: "w320.webp",
    async save(_data, options) {
      calls.push(options.preconditionOpts?.ifGenerationMatch);
    },
    async getMetadata() {
      return [{ generation: "7" }];
    },
  };
  assert.deepEqual(await saveOrAdoptVariant(file, variant()), { created: true, generation: "7" });
  assert.deepEqual(calls, [0]);
});

test("backfill adopts a matching orphan left by an interrupted run", async () => {
  const data = Buffer.from("matching-orphan");
  const file = {
    name: "w640.webp",
    async save() {
      throw Object.assign(new Error("precondition"), { code: 412 });
    },
    async download() {
      return [data];
    },
    async getMetadata() {
      return [{ contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" }];
    },
  };
  assert.deepEqual(await saveOrAdoptVariant(file, variant(data)), { created: false, generation: undefined });
});

test("backfill refuses to adopt an orphan with different bytes", async () => {
  const file = {
    name: "w1280.webp",
    async save() {
      throw Object.assign(new Error("precondition"), { statusCode: 412 });
    },
    async download() {
      return [Buffer.from("different")];
    },
    async getMetadata() {
      return [{ contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" }];
    },
  };
  await assert.rejects(() => saveOrAdoptVariant(file, variant()), /does not match generated content/);
});

test("a second backfill run is rejected by the singleton lock before image work", async () => {
  const client = {
    async query() {
      return { rows: [{ acquired: false }] };
    },
  };
  await assert.rejects(() => acquireBackfillLock(client), /already running/);
});

test("backfill target guard uses the canonical database environment sentinel", async () => {
  const previousDatabase = process.env.HUGMEID_EXPECTED_DATABASE;
  process.env.HUGMEID_EXPECTED_DATABASE = "hugmeid_production_v2";
  const client = {
    async query(sql) {
      if (sql.includes("current_database")) return { rows: [{ database_name: "hugmeid_production_v2" }] };
      if (sql.includes("app_environment")) return { rows: [{ value: "production" }] };
      if (sql.includes("to_regclass")) return { rows: [{ relation: "asset_variants" }] };
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  try {
    await assertTarget(client, "production");
    await assert.rejects(() => assertTarget(client, "staging"), /environment attestation is not staging/);
  } finally {
    if (previousDatabase === undefined) delete process.env.HUGMEID_EXPECTED_DATABASE;
    else process.env.HUGMEID_EXPECTED_DATABASE = previousDatabase;
  }
});
