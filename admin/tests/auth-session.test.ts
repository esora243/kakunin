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
import {
  isOpenAccessEnabled,
  OPEN_ACCESS_ADMIN_ID,
  OPEN_ACCESS_EMAIL,
} from "../lib/auth/open-access";
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

const openAccessIdentity = {
  adminId: OPEN_ACCESS_ADMIN_ID,
  email: OPEN_ACCESS_EMAIL,
  role: "owner" as const,
  isActive: true,
};

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

// ---------------------------------------------------------------------------
// オープンアクセスモード (常時有効): 認証は一切行わず、誰でも owner として利用可。
// ---------------------------------------------------------------------------

test("open access mode is always enabled and needs no configuration", () => {
  assert.equal(isOpenAccessEnabled(), true);
  assert.equal(isOpenAccessEnabled({} as NodeJS.ProcessEnv), true);
});

test("adminApiRoute accepts mutation requests from any origin without credentials", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const route = adminApiRoute("any", async () => ({ ok: true }));

  const response = await route(
    new Request("https://admin.example.test/api/probe", {
      method: "POST",
      headers: {
        origin: "https://example.test",
        "content-type": "text/plain",
      },
      body: JSON.stringify({ action: "mutate" }),
    }),
  );

  assert.equal(response.status, 200);
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

test("adminApiRoute runs the handler without any Google session or admin_users row", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async () => null);

  const result = await callAdminRoute();

  assert.equal(result.response.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.email, OPEN_ACCESS_EMAIL);
  assert.equal(result.handlerCalled, true);
});

test("adminApiRoute does not trust forged IAP or direct identity headers, but still runs open access", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  const result = await callAdminRoute({
    "X-Goog-IAP-JWT-Assertion": "forged",
    "X-Goog-Authenticated-User-Email": "accounts.google.com:owner@example.com",
    "X-Hugmeid-Admin-Email": "owner@example.com",
  });

  assert.equal(result.response.status, 200);
  // ヘッダーのメールではなく組み込みのオープンアクセスIDとして処理される
  assert.equal(result.body.email, OPEN_ACCESS_EMAIL);
  assert.equal(result.handlerCalled, true);
});

test("adminApiRoute runs open access regardless of query tokens and public app sessions", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const route = adminApiRoute("any", async () => ({ ok: true }));

  const response = await route(
    new Request("https://admin.example.test/api/probe?admin_token=owner@example.com", {
      headers: { cookie: "hugmeid_session=public-user-session-token" },
    }),
  );

  assert.equal(response.status, 200);
});

test("adminApiRoute ignores invalid, expired, and unverified session cookies under open access", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  let result = await callAdminRoute({ cookie: `${ADMIN_GOOGLE_SESSION_COOKIE}=not-a-token` });
  assert.equal(result.response.status, 200);
  assert.equal(result.handlerCalled, true);

  result = await callAdminRoute({
    cookie: rawSessionCookie({
      email: "owner@example.com",
      emailVerified: true,
      exp: Math.floor(Date.now() / 1000) - 1,
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.handlerCalled, true);

  result = await callAdminRoute({
    cookie: rawSessionCookie({
      email: "owner@example.com",
      emailVerified: false,
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.handlerCalled, true);
});

test("adminApiRoute is unaffected by auth configuration or admin_users lookup failures under open access", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  process.env.ADMIN_SESSION_SECRET = "short";

  let result = await callAdminRoute();
  assert.equal(result.response.status, 200);
  assert.equal(result.handlerCalled, true);

  process.env.ADMIN_SESSION_SECRET = STRONG_TEST_ADMIN_SESSION_SECRET;
  setAdminUserLookupForTests(async () => { throw new Error("database unavailable"); });
  result = await callAdminRoute();
  assert.equal(result.response.status, 200);
  assert.equal(result.handlerCalled, true);
});

test("adminApiRoute always resolves to the built-in owner identity without admin_users", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  setAdminUserLookupForTests(async () => null);
  const result = await callAdminRoute({ cookie: sessionCookie() });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.email, OPEN_ACCESS_EMAIL);
  assert.equal(result.handlerCalled, true);
});

test("getAdminIdentityForPage resolves the open-access identity regardless of cookies", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  const token = sessionCookie().split("=")[1];
  const source: AccessSource = {
    getHeader: () => null,
    getCookie: (name) => (name === ADMIN_GOOGLE_SESSION_COOKIE ? decodeURIComponent(token) : null),
  };
  setNextRequestAccessSourceForTests(source);

  assert.deepEqual(await getAdminIdentityForPage(), openAccessIdentity);
});

test("adminApiRoute works under open access even with a local bypass variable set outside local", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  process.env.ADMIN_LOCAL_AUTH_BYPASS_EMAIL = "owner@example.com";
  // オープンアクセスが先に解決されるため、devバイパスの設定値は評価されず動作する
  const result = await callAdminRoute();
  assert.equal(result.response.status, 200);
  assert.equal(result.body.email, OPEN_ACCESS_EMAIL);
  assert.equal(result.handlerCalled, true);
});
