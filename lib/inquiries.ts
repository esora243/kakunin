import "server-only";

import { createHash } from "node:crypto";

import type { AuthSessionPayload } from "./auth/types";
import { apiErrorResult, invalidRequestResult, unauthorizedResult, type ApiJsonResult } from "./api-results";
import { dbQuery } from "./db/postgres";

const inquiryIntents = new Set(["job", "activity", "content", "school_career", "sponsor_partner", "problem_report", "other"]);

type InquiryRequestBody = {
  idempotencyKey?: unknown;
  intent?: unknown;
  message?: unknown;
  jobId?: unknown;
  activityId?: unknown;
  contentId?: unknown;
};

type InquiryQuery = <T extends object = Record<string, unknown>>(
  text: string,
  values?: readonly unknown[],
) => Promise<{ rows: T[] }>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function sessionHasActiveUser(session: AuthSessionPayload, query: InquiryQuery) {
  const { rows } = await query<{ id: string }>(
    `
      select id::text
      from users
      where id = $1
        and deactivated_at is null
      limit 1
    `,
    [session.userId],
  );
  return rows.length > 0;
}

export async function createInquiryJson(
  session: AuthSessionPayload,
  body: unknown,
  dependencies: { query?: InquiryQuery } = {},
): Promise<ApiJsonResult> {
  const query: InquiryQuery = dependencies.query ?? dbQuery;
  if (!body || typeof body !== "object") return invalidRequestResult("問い合わせ内容を入力してください");
  const requestBody = body as InquiryRequestBody;
  const idempotencyKey = optionalString(requestBody.idempotencyKey);
  const intent = optionalString(requestBody.intent);
  const message = optionalString(requestBody.message);
  const jobId = optionalString(requestBody.jobId);
  const activityId = optionalString(requestBody.activityId);
  const contentId = optionalString(requestBody.contentId);

  if (!idempotencyKey || !UUID_PATTERN.test(idempotencyKey)) {
    return invalidRequestResult("idempotencyKeyにはUUIDを指定してください");
  }
  if (!intent || !inquiryIntents.has(intent)) return invalidRequestResult("問い合わせ種別を選択してください");
  if (!message) return invalidRequestResult("問い合わせ内容を入力してください");
  if (message.length > 4000) return invalidRequestResult("問い合わせ内容は4000文字以内で入力してください");
  if (!(await sessionHasActiveUser(session, query))) return unauthorizedResult();

  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ intent, message, jobId, activityId, contentId }))
    .digest("hex");
  const { rows } = await query<{ id: string; created_at: string; request_fingerprint: string }>(
    `
      insert into inquiries
        (user_id, intent, job_id, activity_id, content_id, message, idempotency_key, request_fingerprint)
      values ($1, $2, $3, $4, $5, $6, $7::uuid, $8)
      on conflict (user_id, idempotency_key) where idempotency_key is not null do nothing
      returning id::text, created_at::text, request_fingerprint
    `,
    [session.userId, intent, jobId, activityId, contentId, message, idempotencyKey, fingerprint],
  );

  let row = rows[0];
  if (!row) {
    const existing = await query<{ id: string; created_at: string; request_fingerprint: string }>(
      `select id::text, created_at::text, request_fingerprint
         from inquiries
        where user_id = $1 and idempotency_key = $2::uuid
        limit 1`,
      [session.userId, idempotencyKey],
    );
    row = existing.rows[0];
    if (!row || row.request_fingerprint !== fingerprint) {
      return apiErrorResult("idempotency_key_reused", "同じidempotencyKeyを異なる内容には使用できません", 409);
    }
  }

  return { body: { ok: true, item: { id: row.id, createdAt: row.created_at } } };
}
