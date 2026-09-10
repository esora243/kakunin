import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveDatabaseRuntimeEnvironment } from "../db/environment";
import { AdminAuthError } from "./types";
import type { AccessSource } from "./access";

export const ADMIN_GOOGLE_SESSION_COOKIE = "admin_google_session";
const MIN_PRODUCTION_ADMIN_SESSION_SECRET_LENGTH = 32;

export type AdminGoogleSessionPayload = {
  email: string;
  emailVerified: boolean;
  exp: number;
};

function requiredAdminSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new AdminAuthError("ADMIN_SESSION_SECRET is required", "config_missing");
  if (
    resolveDatabaseRuntimeEnvironment().deployEnv !== "local" &&
    secret.length < MIN_PRODUCTION_ADMIN_SESSION_SECRET_LENGTH
  ) {
    throw new AdminAuthError("ADMIN_SESSION_SECRET must be at least 32 characters outside local development", "config_missing");
  }
  return secret;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", requiredAdminSessionSecret()).update(encodedPayload).digest("base64url");
}

function parsePayload(value: unknown): AdminGoogleSessionPayload {
  if (!value || typeof value !== "object") {
    throw new AdminAuthError("Admin Google session payload is invalid", "session_invalid");
  }
  const payload = value as Record<string, unknown>;
  const email = normalizeEmail(payload.email);
  if (!email) throw new AdminAuthError("Admin Google session email is missing", "session_invalid");
  if (payload.emailVerified !== true) {
    throw new AdminAuthError("Admin Google session email is unverified", "email_unverified");
  }
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AdminAuthError("Admin Google session is expired", "session_invalid");
  }
  return { email, emailVerified: true, exp: payload.exp };
}

export function createAdminGoogleSessionToken(payload: AdminGoogleSessionPayload): string {
  const normalized = parsePayload(payload);
  const encodedPayload = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64url");
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyAdminGoogleSessionToken(token: string): AdminGoogleSessionPayload {
  const [encodedPayload, signature, extra] = token.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    throw new AdminAuthError("Admin Google session token is invalid", "session_invalid");
  }

  const expectedSignature = signPayload(encodedPayload);
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AdminAuthError("Admin Google session signature is invalid", "session_invalid");
  }

  try {
    return parsePayload(JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")));
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError("Admin Google session payload is invalid", "session_invalid");
  }
}

export function resolveAdminGoogleSessionEmail(source: AccessSource): string | null {
  const token = source.getCookie(ADMIN_GOOGLE_SESSION_COOKIE);
  if (!token) return null;
  return verifyAdminGoogleSessionToken(token).email;
}
