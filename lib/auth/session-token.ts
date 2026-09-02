import type { AuthSessionPayload } from "@/lib/auth/types";
import {
  isCurrentLegalConsentVersion,
  type LegalConsentVersion,
} from "../legal-consent";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

const MIN_PRODUCTION_SESSION_SECRET_LENGTH = 32;
const MAX_SESSION_TOKEN_LENGTH = 2048;

export type ConsentedSessionClaims = AuthSessionPayload & {
  legalConsentVersion: LegalConsentVersion;
};

export class SessionError extends Error {
  code: "session_secret_missing" | "session_invalid";

  constructor(code: SessionError["code"], message: string) {
    super(message);
    this.name = "SessionError";
    this.code = code;
  }
}

export function isSessionInfrastructureError(error: unknown): boolean {
  return error instanceof SessionError && error.code === "session_secret_missing";
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new SessionError("session_secret_missing", "SESSION_SECRET is required");
  }
  if (process.env.NODE_ENV === "production" && secret.length < MIN_PRODUCTION_SESSION_SECRET_LENGTH) {
    throw new SessionError("session_secret_missing", "SESSION_SECRET must be at least 32 characters in production");
  }
  return secret;
}

function base64UrlEncode(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

async function sign(value: string, secret = getSessionSecret()) {
  const { createHmac } = await import("crypto");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export async function createSessionToken(payload: ConsentedSessionClaims, now = Date.now()) {
  if (!isCurrentLegalConsentVersion(payload.legalConsentVersion)) {
    throw new SessionError("session_invalid", "Current legal consent is required");
  }
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const body = base64UrlEncode(
    JSON.stringify({
      ...payload,
      exp: expiresAt,
    }),
  );
  return `${body}.${await sign(body)}`;
}

export async function verifySessionToken(token: string): Promise<AuthSessionPayload> {
  if (token.length > MAX_SESSION_TOKEN_LENGTH) {
    throw new SessionError("session_invalid", "Session token is too large");
  }
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) {
    throw new SessionError("session_invalid", "Session token shape is invalid");
  }
  const expected = await sign(body);
  const { timingSafeEqual } = await import("crypto");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new SessionError("session_invalid", "Session signature is invalid");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(body));
  } catch {
    throw new SessionError("session_invalid", "Session payload is invalid");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new SessionError("session_invalid", "Session payload is invalid");
  }
  const candidate = parsed as Record<string, unknown>;
  if (
    typeof candidate.userId !== "string" ||
    !candidate.userId ||
    typeof candidate.exp !== "number" ||
    candidate.exp <= Math.floor(Date.now() / 1000) ||
    !isCurrentLegalConsentVersion(candidate.legalConsentVersion)
  ) {
    throw new SessionError("session_invalid", "Session payload is invalid");
  }
  return { userId: candidate.userId };
}
