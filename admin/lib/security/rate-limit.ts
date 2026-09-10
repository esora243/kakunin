import "server-only";

import { dbQuery } from "../db/postgres";
import { HttpError } from "../errors";
import { clientKey } from "./request";

export async function enforceSharedRateLimit(
  request: Request,
  options: { namespace: string; identity: string; limit: number; windowMs: number },
): Promise<void> {
  const now = new Date();
  const { rows } = await dbQuery<{ count: number; reset_at: string }>(
    `with input as (
       select $1::text as namespace, $2::text as identity, $3::text as client_key,
              $4::timestamptz as now_at, ($5::float8 * interval '1 millisecond') as window_interval
     ), cleanup as (
       delete from rate_limit_buckets
       where reset_at <= (select now_at - interval '10 minutes' from input)
     ), upsert as (
       insert into rate_limit_buckets (namespace, identity, client_key, count, reset_at, updated_at)
       select namespace, identity, client_key, 1, now_at + window_interval, now_at from input
       on conflict (namespace, identity, client_key) do update set
         count = case when rate_limit_buckets.reset_at <= excluded.updated_at then 1 else rate_limit_buckets.count + 1 end,
         reset_at = case when rate_limit_buckets.reset_at <= excluded.updated_at then excluded.reset_at else rate_limit_buckets.reset_at end,
         updated_at = excluded.updated_at
       returning count, reset_at
     ) select count, reset_at from upsert`,
    [options.namespace, options.identity, clientKey(request), now.toISOString(), options.windowMs],
  );
  const bucket = rows[0];
  if (!bucket || bucket.count <= options.limit) return;
  const retryAfter = Math.max(1, Math.ceil((new Date(bucket.reset_at).getTime() - now.getTime()) / 1000));
  throw new HttpError("Too many requests", 429, "rate_limited", { "Retry-After": String(retryAfter) });
}
