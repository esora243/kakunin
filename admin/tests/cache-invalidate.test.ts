import assert from "node:assert/strict";
import test from "node:test";
import {
  invalidatePublicCache,
  mutateWithPublicCacheInvalidation,
  retryCacheInvalidation,
} from "../lib/cache-invalidate";
import type { PoolClient } from "pg";

function withCacheEnvironment(run: () => Promise<void>) {
  const previousUrl = process.env.PUBLIC_APP_REVALIDATE_URL;
  const previousSecret = process.env.REVALIDATE_ADMIN_SECRET;
  process.env.PUBLIC_APP_REVALIDATE_URL = "https://app.example.test/api/admin/revalidate";
  process.env.REVALIDATE_ADMIN_SECRET = "test-secret";
  return run().finally(() => {
    if (previousUrl === undefined) delete process.env.PUBLIC_APP_REVALIDATE_URL;
    else process.env.PUBLIC_APP_REVALIDATE_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.REVALIDATE_ADMIN_SECRET;
    else process.env.REVALIDATE_ADMIN_SECRET = previousSecret;
  });
}

test("cache invalidation stops waiting when the public app does not respond", async () => {
  await withCacheEnvironment(async () => {
    const result = await invalidatePublicCache(["contents"], {
      timeoutMs: 5,
      fetchImpl: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const keepAlive = setTimeout(() => reject(new Error("test timeout")), 100);
          init?.signal?.addEventListener(
            "abort",
            () => {
              clearTimeout(keepAlive);
              reject(init.signal?.reason);
            },
            { once: true },
          );
        }),
    });

    assert.deepEqual(result, { ok: false, error: "network_error" });
  });
});

test("failed cache invalidation keeps the durable job pending with attempt details", async () => {
  await withCacheEnvironment(async () => {
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const result = await retryCacheInvalidation("job-1", {
      fetchImpl: async () => new Response(null, { status: 503 }),
      query: async (text, values) => {
        calls.push({ text, values });
        return calls.length === 1
          ? { rows: [{ id: "job-1", tags: ["contents"], status: "pending" }] }
          : { rows: [{ status: "pending" }] };
      },
    });
    assert.deepEqual(result, { ok: false, error: "http_503" });
    assert.match(calls[1]?.text ?? "", /attempt_count = attempt_count \+ 1/);
    assert.match(calls[1]?.text ?? "", /when status = 'complete' then status else \$2 end/);
    assert.deepEqual(calls[1]?.values, ["job-1", "pending", "http_503"]);
  });
});

test("a concurrent failed retry cannot move an already completed job back to pending", async () => {
  await withCacheEnvironment(async () => {
    const result = await retryCacheInvalidation("job-1", {
      fetchImpl: async () => new Response(null, { status: 503 }),
      query: async (text) => text.trimStart().startsWith("select")
        ? { rows: [{ id: "job-1", tags: ["contents"], status: "pending" }] }
        : { rows: [{ status: "complete" }] },
    });
    assert.deepEqual(result, { ok: true });
  });
});

test("retrying an already completed job is idempotent and makes no network call", async () => {
  let fetched = false;
  const result = await retryCacheInvalidation("job-1", {
    fetchImpl: async () => { fetched = true; return new Response(null, { status: 200 }); },
    query: async () => ({ rows: [{ id: "job-1", tags: ["contents"], status: "complete" }] }),
  });
  assert.deepEqual(result, { ok: true });
  assert.equal(fetched, false);
});

test("post-commit job lookup failures return a warning instead of hiding the committed mutation behind 500", async () => {
  const client = {
    query: async () => ({ rows: [{ id: "job-1" }] }),
  } as unknown as PoolClient;
  const result = await mutateWithPublicCacheInvalidation(
    "admin-1",
    async () => ({ id: "content-1" }),
    { resourceType: "contents", resourceId: "content-1", tags: ["contents"] },
    {
      transaction: async (callback) => callback(client),
      query: async () => { throw new Error("database unavailable after commit"); },
    },
  );
  assert.deepEqual(result, {
    value: { id: "content-1" },
    cacheResult: { ok: false, error: "job_lookup_failed" },
  });
});

test("a rolled-back mutation never enqueues an outbox job", async () => {
  let outboxQueries = 0;
  const client = {
    query: async () => { outboxQueries += 1; return { rows: [{ id: "job-1" }] }; },
  } as unknown as PoolClient;
  await assert.rejects(
    mutateWithPublicCacheInvalidation(
      "admin-1",
      async () => { throw new Error("mutation failed"); },
      { resourceType: "contents", resourceId: "content-1", tags: ["contents"] },
      { transaction: async (callback) => callback(client) },
    ),
    /mutation failed/,
  );
  assert.equal(outboxQueries, 0);
});
