import type { AuthSessionPayload } from "./auth/types";

export type ApiJsonResult<TBody = unknown> = {
  body: TBody;
  status?: number;
};

export type ApiErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export function publicCacheHeadersForResult(result: ApiJsonResult, cacheControl: string): HeadersInit {
  const status = result.status ?? 200;
  return status >= 200 && status < 300
    ? { "Cache-Control": cacheControl }
    : { "Cache-Control": "no-store" };
}

export function apiErrorResult(code: string, message: string, status: number): ApiJsonResult<ApiErrorBody> {
  return { body: { ok: false, error: { code, message } }, status };
}

export function unauthorizedResult() {
  return apiErrorResult("unauthorized", "Login is required", 401);
}

export function invalidRequestResult(message: string) {
  return apiErrorResult("invalid_request", message, 400);
}

export function notFoundResult(message: string) {
  return apiErrorResult("not_found", message, 404);
}

export async function withRequiredSession(
  readSession: () => Promise<AuthSessionPayload | null>,
  handler: (session: AuthSessionPayload) => Promise<ApiJsonResult>,
): Promise<ApiJsonResult> {
  const session = await readSession();
  if (!session) return unauthorizedResult();
  return handler(session);
}
