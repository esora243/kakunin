import "server-only";

import { NextResponse } from "next/server";
import { accessSourceFromRequest } from "./auth/access";
import { resolveAdminIdentity } from "./auth/admin-session";
import { publicAdminOrigin } from "./auth/google-oauth";
import { AdminAuthError, adminAuthErrorStatus, adminAuthPublicMessage } from "./auth/types";
import type { AdminIdentity, AdminRole } from "./auth/types";
import { DatabaseConfigError } from "./db/postgres";
import { HttpError } from "./errors";
import { randomUUID } from "node:crypto";
import { logSafeError } from "./safe-log";
import { assertAdminRuntimeConfig } from "./runtime-config";

export type AdminApiHandler<T> = (identity: AdminIdentity, request: Request) => Promise<T>;
type AdminApiRouteDependencies = { assertRuntimeConfig?: () => void };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function errorResponse(code: string, message: string, status: number, requestId: string, extraHeaders?: Record<string, string>) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { ...NO_STORE_HEADERS, "X-Request-ID": requestId, ...extraHeaders } });
}

/**
 * Wraps an admin API route handler with app-level Google OAuth session
 * verification, admin_users lookup + is_active check, optional role gate, and
 * a forced no-store response. Missing/invalid identity returns 403 before any
 * admin data access.
 */
export function adminApiRoute<T>(
  requiredRole: AdminRole | "any",
  handler: AdminApiHandler<T>,
  dependencies: AdminApiRouteDependencies = {},
): (request: Request) => Promise<Response> {
  let runtimeConfigAvailable = true;
  try {
    (dependencies.assertRuntimeConfig ?? assertAdminRuntimeConfig)();
  } catch {
    runtimeConfigAvailable = false;
  }
  return async (request: Request) => {
    const requestId = randomUUID();
    if (!runtimeConfigAvailable) {
      logSafeError({ event: "admin_runtime_config_error", code: "service_unavailable", requestId });
      return errorResponse("service_unavailable", "Admin service is temporarily unavailable", 503, requestId);
    }
    let identity: AdminIdentity | null;
    try {
      if (MUTATION_METHODS.has(request.method) && request.headers.get("origin") !== publicAdminOrigin()) {
        return errorResponse("forbidden_origin", "Admin request origin is not allowed", 403, requestId);
      }
      identity = await resolveAdminIdentity(accessSourceFromRequest(request));
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return errorResponse(error.code, adminAuthPublicMessage(error), adminAuthErrorStatus(error), requestId);
      }
      logSafeError({ event: "admin_identity_error", code: "identity_unavailable", requestId });
      return errorResponse("identity_unavailable", "Admin identity is temporarily unavailable", 503, requestId);
    }

    if (!identity) return errorResponse("unauthenticated", "No verified admin identity", 403, requestId);
    if (requiredRole === "owner" && identity.role !== "owner") {
      return errorResponse("forbidden", "This action is owner-only", 403, requestId);
    }

    try {
      const body = await handler(identity, request);
      return NextResponse.json(body, { status: 200, headers: { ...NO_STORE_HEADERS, "X-Request-ID": requestId } });
    } catch (error) {
      if (error instanceof HttpError) {
        return errorResponse(error.code, error.message, error.status, requestId, error.headers);
      }
      if (error instanceof DatabaseConfigError) {
        return errorResponse("database_unavailable", "Database is not available", 503, requestId);
      }
      logSafeError({ event: "admin_api_error", code: "internal_error", requestId });
      return errorResponse("internal_error", "Unexpected server error", 500, requestId);
    }
  };
}
