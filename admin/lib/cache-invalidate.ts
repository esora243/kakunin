import "server-only";

import type { PoolClient } from "pg";
import { dbQuery, dbQueryWithStatementTimeout, dbTransaction } from "./db/postgres";
import { logSafeError } from "./safe-log";

export type CacheInvalidationResult = { ok: true } | { ok: false; error: string };
export type CacheInvalidationDescriptor = { resourceType: string; resourceId: string; tags: string[] };
const CACHE_INVALIDATION_TIMEOUT_MS = 5_000;

type CacheInvalidationDependencies = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  query?: (text: string, values: readonly unknown[]) => Promise<{ rows: unknown[] }>;
  transaction?: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
};

export async function invalidatePublicCache(tags: string[], dependencies: CacheInvalidationDependencies = {}): Promise<CacheInvalidationResult> {
  const url = process.env.PUBLIC_APP_REVALIDATE_URL?.trim();
  const secret = process.env.REVALIDATE_ADMIN_SECRET?.trim();
  if (!url || !secret) return { ok: false, error: "not_configured" };
  try {
    const response = await (dependencies.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-revalidate-secret": secret },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? CACHE_INVALIDATION_TIMEOUT_MS),
    });
    return response.ok ? { ok: true } : { ok: false, error: `http_${response.status}` };
  } catch {
    return { ok: false, error: "network_error" };
  }
}

export async function enqueuePublicCacheInvalidation(client: PoolClient, actorAdminId: string, descriptor: CacheInvalidationDescriptor): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public_cache_invalidation_jobs
       (actor_admin_id, resource_type, resource_id, tags, status)
     values ($1, $2, $3, $4::text[], 'pending') returning id::text`,
    [actorAdminId, descriptor.resourceType, descriptor.resourceId, descriptor.tags],
  );
  if (!rows[0]?.id) throw new Error("Cache invalidation job was not created");
  return rows[0].id;
}

async function processCacheInvalidationJob(jobId: string, dependencies: CacheInvalidationDependencies = {}): Promise<CacheInvalidationResult> {
  const query = dependencies.query
    ?? ((text: string, values: readonly unknown[]) => dbQueryWithStatementTimeout(text, values, CACHE_INVALIDATION_TIMEOUT_MS));
  let result;
  try {
    result = await query(
      `select id::text, tags, status from public_cache_invalidation_jobs where id = $1 limit 1`,
      [jobId],
    );
  } catch {
    logSafeError({ event: "cache_invalidation_job_lookup_failed", code: "job_lookup_failed", resourceId: jobId });
    return { ok: false, error: "job_lookup_failed" };
  }
  const job = result.rows[0] as { id: string; tags: string[]; status: string } | undefined;
  if (!job) return { ok: false, error: "job_not_found" };
  if (job.status === "complete") return { ok: true };
  const invalidation = await invalidatePublicCache(job.tags, dependencies);
  try {
    const updated = await query(
      `update public_cache_invalidation_jobs
       set status = case when status = 'complete' then status else $2 end,
           attempt_count = attempt_count + 1,
           last_error = case when status = 'complete' then last_error else $3 end,
           completed_at = case
             when status = 'complete' then completed_at
             when $2 = 'complete' then now()
             else null
           end,
           updated_at = now()
       where id = $1
       returning status`,
      [jobId, invalidation.ok ? "complete" : "pending", invalidation.ok ? null : invalidation.error],
    );
    if ((updated.rows[0] as { status?: string } | undefined)?.status === "complete") return { ok: true };
  } catch {
    logSafeError({ event: "cache_invalidation_job_update_failed", code: "job_update_failed", resourceId: jobId });
    return { ok: false, error: "job_update_failed" };
  }
  return invalidation;
}

export async function mutateWithPublicCacheInvalidation<T>(
  actorAdminId: string,
  mutation: (client: PoolClient) => Promise<T>,
  descriptor: CacheInvalidationDescriptor | ((value: T) => CacheInvalidationDescriptor | null),
  dependencies: CacheInvalidationDependencies = {},
): Promise<{ value: T; cacheResult: CacheInvalidationResult }> {
  const committed = await (dependencies.transaction ?? dbTransaction)(async (client) => {
    const value = await mutation(client);
    const resolved = typeof descriptor === "function" ? descriptor(value) : descriptor;
    const jobId = resolved ? await enqueuePublicCacheInvalidation(client, actorAdminId, resolved) : null;
    return { value, jobId };
  });
  if (!committed.jobId) return { value: committed.value, cacheResult: { ok: true } };
  return { value: committed.value, cacheResult: await processCacheInvalidationJob(committed.jobId, dependencies) };
}

export type PendingRetry = { id: string; resourceType: string; resourceId: string; tags: string[] };

export async function listPendingCacheInvalidationRetries(limit = 20): Promise<PendingRetry[]> {
  const { rows } = await dbQuery<{ id: string; resource_type: string; resource_id: string; tags: string[] }>(
    `select id::text, resource_type, resource_id, tags
     from public_cache_invalidation_jobs where status = 'pending'
     order by created_at asc limit $1`,
    [limit],
  );
  return rows.map((row) => ({ id: row.id, resourceType: row.resource_type, resourceId: row.resource_id, tags: row.tags }));
}

export async function retryCacheInvalidation(jobId: string, dependencies: CacheInvalidationDependencies = {}): Promise<CacheInvalidationResult> {
  return processCacheInvalidationJob(jobId, dependencies);
}
