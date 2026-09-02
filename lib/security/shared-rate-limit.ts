import "server-only";

import { createHash } from "node:crypto";
import { dbQuery } from "../db/postgres";
import { rateLimitClientIp, rateLimitedResponse } from "./rate-limit";

type SharedRateLimitOptions = {
  namespace: string;
  identity: string;
  limit: number;
  windowMs: number;
  now?: number;
};

function clientKey(request: Request) {
  return createHash("sha256").update(rateLimitClientIp(request)).digest("hex");
}

export async function rejectSharedRateLimitedRequest(
  request: Request,
  { namespace, identity, limit, windowMs, now = Date.now() }: SharedRateLimitOptions,
) {
  const nowDate = new Date(now);
  const { rows } = await dbQuery<{ count: number; reset_at: string }>(
    `
      with input as (
        select
          $1::text as namespace,
          $2::text as identity,
          $3::text as client_key,
          $4::int4 as request_limit,
          ($5::float8 * interval '1 millisecond') as window_interval,
          $6::timestamptz as now_at
      ),
      cleanup as (
        delete from rate_limit_buckets
        where reset_at <= (select now_at - interval '10 minutes' from input)
      ),
      upsert as (
        insert into rate_limit_buckets (namespace, identity, client_key, count, reset_at, updated_at)
        select namespace, identity, client_key, 1, now_at + window_interval, now_at
        from input
        on conflict (namespace, identity, client_key)
        do update set
          count = case
            when rate_limit_buckets.reset_at <= excluded.updated_at then 1
            else rate_limit_buckets.count + 1
          end,
          reset_at = case
            when rate_limit_buckets.reset_at <= excluded.updated_at then excluded.reset_at
            else rate_limit_buckets.reset_at
          end,
          updated_at = excluded.updated_at
        returning count, reset_at
      )
      select count, reset_at from upsert
    `,
    [namespace, identity, clientKey(request), limit, windowMs, nowDate.toISOString()],
  );

  const bucket = rows[0];
  if (!bucket || bucket.count <= limit) return null;

  const resetAt = new Date(bucket.reset_at).getTime();
  const retryAfterSeconds = Number.isFinite(resetAt) ? Math.ceil((resetAt - nowDate.getTime()) / 1000) : Math.ceil(windowMs / 1000);
  return rateLimitedResponse(Math.max(1, retryAfterSeconds));
}
