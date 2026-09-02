import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createSessionToken, isSessionInfrastructureError, SessionError, verifySessionToken } from "../lib/auth/session-token";
import { LEGAL_CONSENT_VERSION } from "../lib/legal-consent";

function signPayload(payload: object, secret = "test-secret") {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

test("session token verifies a signed payload", async () => {
  process.env.SESSION_SECRET = "test-secret";
  const token = await createSessionToken({ userId: "user-1", legalConsentVersion: LEGAL_CONSENT_VERSION });
  assert.deepEqual(await verifySessionToken(token), { userId: "user-1" });
});

test("session token rejects a tampered signature", async () => {
  process.env.SESSION_SECRET = "test-secret";
  const token = await createSessionToken({ userId: "user-1", legalConsentVersion: LEGAL_CONSENT_VERSION });
  const tampered = `${token.split(".")[0]}.invalid-signature`;
  await assert.rejects(
    () => verifySessionToken(tampered),
    (error) => error instanceof SessionError && error.code === "session_invalid",
  );
});

test("session token rejects legacy and stale legal consent claims", async () => {
  process.env.SESSION_SECRET = "test-secret";
  const exp = Math.floor(Date.now() / 1000) + 60;

  await assert.rejects(
    () => verifySessionToken(signPayload({ userId: "user-1", exp })),
    (error) => error instanceof SessionError && error.code === "session_invalid",
  );
  await assert.rejects(
    () =>
      verifySessionToken(
        signPayload({
          userId: "user-1",
          legalConsentVersion: "2026-01-01",
          exp,
        }),
      ),
    (error) => error instanceof SessionError && error.code === "session_invalid",
  );
});

test("session token creation cannot promote a stale consent claim", async () => {
  process.env.SESSION_SECRET = "test-secret";
  await assert.rejects(
    () =>
      createSessionToken({
        userId: "user-1",
        legalConsentVersion: "2026-01-01" as typeof LEGAL_CONSENT_VERSION,
      }),
    (error) => error instanceof SessionError && error.code === "session_invalid",
  );
});

test("session token signs the current legal consent without leaking it downstream", async () => {
  process.env.SESSION_SECRET = "test-secret";
  const token = await createSessionToken({ userId: "user-1", legalConsentVersion: LEGAL_CONSENT_VERSION });
  const claims = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as Record<string, unknown>;

  assert.equal(claims.legalConsentVersion, LEGAL_CONSENT_VERSION);
  assert.deepEqual(await verifySessionToken(token), { userId: "user-1" });
});

test("session token rejects oversized cookie payloads before signature work", async () => {
  process.env.SESSION_SECRET = "test-secret";
  await assert.rejects(
    () => verifySessionToken(`${"x".repeat(2049)}.signature`),
    (error) => error instanceof SessionError && error.code === "session_invalid",
  );
});

test("production session secret must have enough entropy", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true, enumerable: true, writable: true });
  process.env.SESSION_SECRET = "short";
  await assert.rejects(
    () => createSessionToken({ userId: "user-1", legalConsentVersion: LEGAL_CONSENT_VERSION }),
    (error) => error instanceof SessionError && error.code === "session_secret_missing",
  );
  Object.defineProperty(process.env, "NODE_ENV", { value: previousNodeEnv, configurable: true, enumerable: true, writable: true });
});

test("session cookie reader only converts invalid tokens to unauthenticated", () => {
  const source = readFileSync(join(process.cwd(), "lib/auth/session.ts"), "utf8");
  assert.match(source, /error instanceof SessionError && error\.code === "session_invalid"/);
  assert.match(source, /throw error/);
});

test("session infrastructure errors are classified separately from invalid cookies", () => {
  assert.equal(isSessionInfrastructureError(new SessionError("session_secret_missing", "secret missing")), true);
  assert.equal(isSessionInfrastructureError(new SessionError("session_invalid", "bad cookie")), false);
  assert.equal(isSessionInfrastructureError(new Error("database unavailable")), false);
});

test("profile and notification routes classify session failures inside their error boundary", () => {
  for (const [path, sessionRead] of [
    ["app/api/me/profile/route.ts", "await readSessionFromCookies"],
    ["app/api/me/notification-settings/route.ts", "await session()"],
  ] as const) {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    assert.ok(source.indexOf("try {") < source.indexOf(sessionRead));
    assert.match(source, /isSessionInfrastructureError/);
    assert.match(source, /service_unavailable/);
  }
});

test("session cookies are signed httpOnly cookies with production secure mode", () => {
  const source = readFileSync(join(process.cwd(), "lib/auth/session.ts"), "utf8");
  const tokenSource = readFileSync(join(process.cwd(), "lib/auth/session-token.ts"), "utf8");

  assert.match(source, /httpOnly:\s*true/);
  assert.match(source, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.match(source, /sameSite:\s*"lax"/);
  assert.match(source, /maxAge:\s*SESSION_TTL_SECONDS/);
  assert.match(tokenSource, /timingSafeEqual/);
});

test("LINE session route does not expose raw SessionError details", () => {
  const source = readFileSync(join(process.cwd(), "app/api/auth/line/session/route.ts"), "utf8");
  const sessionErrorBlock = source.slice(source.indexOf("if (error instanceof SessionError)"));

  assert.doesNotMatch(sessionErrorBlock, /message:\s*error\.message/);
  assert.doesNotMatch(sessionErrorBlock, /code:\s*error\.code/);
  assert.match(sessionErrorBlock, /code:\s*"session_unavailable"/);
});
