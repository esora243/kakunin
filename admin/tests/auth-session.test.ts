import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { adminApiRoute } from "../lib/api-route";
import {
  localBypassEmail,
  setNextRequestAccessSourceForTests,
  type AccessSource,
} from "../lib/auth/access";
import { setAdminUserLookupForTests } from "../lib/auth/admin-session";
import {
  ADMIN_GOOGLE_SESSION_COOKIE,
  createAdminGoogleSessionToken,
  verifyAdminGoogleSessionToken,
} from "../lib/auth/google-session";
import { getAdminIdentityForPage } from "../lib/auth/page-identity";
import { AdminAuthError } from "../lib/auth/types";

const ORIGINAL_ENV = { ...process.env };
const STRONG_TEST_ADMIN_SESSION_SECRET = "test-admin-session-secret-with-32-plus-characters";

function resetEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    HUGMEID_DEPLOY_ENV: "local",
    HUGMEID_DATABASE_ENV: "local",
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://admin.example.test/auth/callback",
    ADMIN_SESSION_SECRET: STRONG_TEST_ADMIN_SESSION_SECRET,
    REVALIDATE_ADMIN_SECRET: "test-revalidation-secret",
    PUBLIC_APP_REVALIDATE_URL: "https://app.example.test/api/admin/revalidate",
    GCS_PUBLIC_ASSET_BASE_URL: "https://app.example.test/api/assets/public",
    GCS_PUBLIC_ASSET_BUCKET: "hugmeid-public-assets-test",
    PGHOST: "127.0.0.1",
    PGDATABASE: "hugmeid_test",
    PGUSER: "postgres",
    PGPASSWORD: "test-password",
  };
}

test.beforeEach(resetEnv);
test.afterEach(() => {
  setAdminUserLookupForTests(null);
  setNextRequestAccessSourceForTests(null);
  process.env = { ...ORIGINAL_ENV };
});

function ownerIdentity(email = "owner@example.com") {
  return {
    adminId: "admin-owner",
    email,
    role: "owner" as const,
    isActive: true,
  };
}

function sessionCookie(payload: { email?: string; emailVerified?: boolean; exp?: number } = {}) {
  const token = createAdminGoogleSessionToken({
    email: payload.email ?? "Owner@Example.COM ",
    emailVerified: payload.emailVerified ?? true,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 60,
  });
  return `${ADMIN_GOOGLE_SESSION_COOKIE}=${encodeURIComponent(token)}`;
}

function rawSessionCookie(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET ?? "").update(encodedPayload).digest("base64url");
  return `${ADMIN_GOOGLE_SESSION_COOKIE}=${encodeURIComponent(`${encodedPayload}.${signature}`)}`;
}

async function callAdminRoute(headers: HeadersInit = {}) {
  let handlerCalled = false;
  const route = adminApiRoute("any", async (identity) => {
    handlerCalled = true;
    return { ok: true, email: identity.email };
  });

  const response = await route(new Request("https://admin.example.test/api/probe", { headers }));
  const body = (await response.json()) as { ok?: true; email?: string; error?: { code: string } };
  return { response, body, handlerCalled };
}

test("adminApiRoute rejects text/plain mutation requests from a different origin", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  const route = adminApiRoute("any", async () => ({ ok: true }));

  const response = await route(
    new Request("https://admin.example.test/api/probe", {
      method: "POST",
      headers: {
        cookie: sessionCookie(),
        origin: "https://example.test",
        "content-type": "text/plain",
      },
      body: JSON.stringify({ action: "mutate" }),
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error?: { code: string } }).error?.code, "forbidden_origin");
});

test("adminApiRoute accepts mutation requests from the exact admin origin", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  const route = adminApiRoute("any", async () => ({ ok: true }));

  const response = await route(
    new Request("https://admin.example.test/api/probe", {
      method: "POST",
      headers: { cookie: sessionCookie(), origin: "https://admin.example.test" },
    }),
  );

  assert.equal(response.status, 200);
});

test("admin Google session tokens normalize a verified email", () => {
  const token = createAdminGoogleSessionToken({
    email: "Owner@Example.COM ",
    emailVerified: true,
    exp: Math.floor(Date.now() / 1000) + 60,
  });

  assert.deepEqual(verifyAdminGoogleSessionToken(token), {
    email: "owner@example.com",
    emailVerified: true,
    exp: verifyAdminGoogleSessionToken(token).exp,
  });
});

test("admin Google session tokens reject unverified and expired sessions", () => {
  assert.throws(
    () =>
      createAdminGoogleSessionToken({
        email: "owner@example.com",
        emailVerified: false,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    (error) => error instanceof AdminAuthError && error.code === "email_unverified",
  );

  assert.throws(
    () =>
      createAdminGoogleSessionToken({
        email: "owner@example.com",
        emailVerified: true,
        exp: Math.floor(Date.now() / 1000) - 1,
      }),
    (error) => error instanceof AdminAuthError && error.code === "session_invalid",
  );
});

test("admin Google session tokens require a strong secret in staging deploy env even outside production Node mode", () => {
  Object.assign(process.env, {
    HUGMEID_DEPLOY_ENV: "staging",
    HUGMEID_DATABASE_ENV: "staging",
    NODE_ENV: "test",
    ADMIN_SESSION_SECRET: "short",
  });

  assert.throws(
    () =>
      createAdminGoogleSessionToken({
        email: "owner@example.com",
        emailVerified: true,
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    (error) => error instanceof AdminAuthError && error.code === "config_missing",
  );
});

test("localBypassEmail only works in the local deploy environment", () => {
  process.env.ADMIN_LOCAL_AUTH_BYPASS_EMAIL = "Owner@Example.COM ";
  assert.equal(localBypassEmail(), "owner@example.com");

  process.env.HUGMEID_DEPLOY_ENV = "staging";
  assert.throws(
    () => localBypassEmail(),
    (error) => error instanceof AdminAuthError && error.code === "local_bypass_not_allowed",
  );
});

test("adminApiRoute denies missing app-level admin Google session before handler access", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async () => ownerIdentity());

  const result = await callAdminRoute();

  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "unauthenticated");
  assert.equal(result.handlerCalled, false);
});

test("adminApiRoute ignores forged IAP and direct identity headers", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async () => ownerIdentity());

  const result = await callAdminRoute({
    "X-Goog-IAP-JWT-Assertion": "forged",
    "X-Goog-Authenticated-User-Email": "accounts.google.com:owner@example.com",
    "X-Hugmeid-Admin-Email": "owner@example.com",
  });

  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "unauthenticated");
  assert.equal(result.handlerCalled, false);
});

test("adminApiRoute ignores query tokens and public app sessions", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async () => ownerIdentity());
  const route = adminApiRoute("any", async () => ({ ok: true }));

  const response = await route(
    new Request("https://admin.example.test/api/probe?admin_token=owner@example.com", {
      headers: { cookie: "hugmeid_session=public-user-session-token" },
    }),
  );
  const body = (await response.json()) as { error?: { code: string } };

  assert.equal(response.status, 403);
  assert.equal(body.error?.code, "unauthenticated");
});

test("adminApiRoute denies invalid, expired, and unverified admin Google sessions", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async () => ownerIdentity());

  let result = await callAdminRoute({ cookie: `${ADMIN_GOOGLE_SESSION_COOKIE}=not-a-token` });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "session_invalid");
  assert.equal(result.handlerCalled, false);

  result = await callAdminRoute({
    cookie: rawSessionCookie({
      email: "owner@example.com",
      emailVerified: true,
      exp: Math.floor(Date.now() / 1000) - 1,
    }),
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "session_invalid");
  assert.equal(result.handlerCalled, false);

  result = await callAdminRoute({
    cookie: rawSessionCookie({
      email: "owner@example.com",
      emailVerified: false,
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "email_unverified");
  assert.equal(result.handlerCalled, false);
});

test("adminApiRoute returns 503 for auth configuration and identity lookup failures", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const validCookie = sessionCookie();
  process.env.ADMIN_SESSION_SECRET = "short";
  let result = await callAdminRoute({ cookie: validCookie });
  assert.equal(result.response.status, 503);
  assert.equal(result.body.error?.code, "service_unavailable");

  process.env.ADMIN_SESSION_SECRET = STRONG_TEST_ADMIN_SESSION_SECRET;
  setAdminUserLookupForTests(async () => { throw new Error("database unavailable"); });
  result = await callAdminRoute({ cookie: sessionCookie() });
  assert.equal(result.response.status, 503);
  assert.equal(result.body.error?.code, "identity_unavailable");
});

test("adminApiRoute requires a valid admin Google session and active admin_users row", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  setAdminUserLookupForTests(async () => null);
  let result = await callAdminRoute({ cookie: sessionCookie() });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "unauthenticated");
  assert.equal(result.handlerCalled, false);

  setAdminUserLookupForTests(async () => ({ ...ownerIdentity(), isActive: false }));
  result = await callAdminRoute({ cookie: sessionCookie() });
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "unauthenticated");
  assert.equal(result.handlerCalled, false);

  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  result = await callAdminRoute({ cookie: sessionCookie() });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.email, "owner@example.com");
  assert.equal(result.handlerCalled, true);
});

test("getAdminIdentityForPage uses the app-level admin Google session identity", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  const token = sessionCookie().split("=")[1];
  const source: AccessSource = {
    getHeader: () => null,
    getCookie: (name) => (name === ADMIN_GOOGLE_SESSION_COOKIE ? decodeURIComponent(token) : null),
  };
  setNextRequestAccessSourceForTests(source);

  assert.deepEqual(await getAdminIdentityForPage(), ownerIdentity("owner@example.com"));
});

test("adminApiRoute rejects local bypass outside local", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  process.env.ADMIN_LOCAL_AUTH_BYPASS_EMAIL = "owner@example.com";
  const result = await callAdminRoute();
  assert.equal(result.response.status, 403);
  assert.equal(result.body.error?.code, "local_bypass_not_allowed");
  assert.equal(result.handlerCalled, false);
});
