import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient, QueryResult } from "pg";
import { dbQueryWithStatementTimeout } from "../lib/db/postgres";

function queryResult(rows: object[] = []): QueryResult {
  return { command: "TEST", rowCount: rows.length, oid: 0, fields: [], rows };
}

test("timed DB query applies a transaction-local PostgreSQL statement timeout", async () => {
  const calls: Array<{ text: string; values?: unknown[] }> = [];
  const releases: Array<Error | boolean | undefined> = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      calls.push({ text, values });
      return queryResult(text.startsWith("insert") ? [{ id: "audit-1" }] : []);
    },
    release: (error?: Error | boolean) => releases.push(error),
  } as unknown as PoolClient;

  const result = await dbQueryWithStatementTimeout(
    "insert into admin_audit_logs default values returning id",
    [],
    5_000,
    { acquireClient: async () => client },
  );

  assert.deepEqual(
    calls.map((call) => call.text),
    [
      "begin",
      "select set_config('statement_timeout', $1, true)",
      "insert into admin_audit_logs default values returning id",
      "commit",
    ],
  );
  assert.deepEqual(calls[1]?.values, ["5000ms"]);
  assert.deepEqual(result.rows, [{ id: "audit-1" }]);
  assert.deepEqual(releases, [undefined]);
});

test("timed DB query destroys its pooled connection when the deadline fires", async () => {
  const releases: Array<Error | boolean | undefined> = [];
  const client = {
    query: async (text: string) => {
      if (text.startsWith("insert")) return new Promise<QueryResult>(() => undefined);
      return queryResult();
    },
    release: (error?: Error | boolean) => releases.push(error),
  } as unknown as PoolClient;

  await assert.rejects(
    dbQueryWithStatementTimeout("insert into admin_audit_logs default values", [], 5, {
      acquireClient: async () => client,
    }),
    /exceeded its statement timeout/,
  );

  assert.equal(releases.length, 1);
  assert.ok(releases[0] instanceof Error);
});

test("timed DB query never starts after pool acquisition resolves past the deadline", async () => {
  const calls: string[] = [];
  const releases: Array<Error | boolean | undefined> = [];
  const client = {
    query: async (text: string) => { calls.push(text); return queryResult(); },
    release: (error?: Error | boolean) => releases.push(error),
  } as unknown as PoolClient;
  let resolveClient!: (client: PoolClient) => void;
  const pendingClient = new Promise<PoolClient>((resolve) => { resolveClient = resolve; });

  const operation = dbQueryWithStatementTimeout("update public_cache_invalidation_jobs set status = 'complete'", [], 5, {
    acquireClient: async () => pendingClient,
  });
  await assert.rejects(operation, /exceeded its statement timeout/);
  resolveClient(client);
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, []);
  assert.equal(releases.length, 1);
  assert.ok(releases[0] instanceof Error);
});
