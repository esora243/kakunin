import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import test from "node:test";
import { GET as oauthStartRoute } from "../app/auth/google/route";
import { GET as oauthCallbackRoute } from "../app/auth/callback/route";
import { GET as logoutRoute } from "../app/logout/route";
import { adminApiRoute } from "../lib/api-route";
import { setAdminUserLookupForTests } from "../lib/auth/admin-session";
import {
  getGoogleOAuthFlowCookieName,
  normalizeReturnTo,
  resetGoogleJwkCacheForTests,
  setGoogleIdTokenVerifierForTests,
  setGoogleTokenExchangeForTests,
} from "../lib/auth/google-oauth";
import { ADMIN_GOOGLE_SESSION_COOKIE } from "../lib/auth/google-session";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = globalThis.fetch;

function resetEnv() {
  process.env = {
    ...ORIGINAL_ENV,
    HUGMEID_DEPLOY_ENV: "local",
    HUGMEID_DATABASE_ENV: "local",
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "https://admin.example.test/auth/callback",
    ADMIN_SESSION_SECRET: "12345678901234567890123456789012",
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
  setGoogleTokenExchangeForTests(null);
  setGoogleIdTokenVerifierForTests(null);
  resetGoogleJwkCacheForTests();
  globalThis.fetch = ORIGINAL_FETCH;
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

function validGooglePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: "google-client-id",
    exp: Math.floor(Date.now() / 1000) + 60,
    email: "Owner@Example.COM ",
    email_verified: true,
    nonce: "nonce-from-cookie",
    ...overrides,
  };
}

function getSetCookie(response: Response, prefix: string): string {
  const header = response.headers.getSetCookie().find((value) => value.startsWith(prefix));
  assert.ok(header, `missing Set-Cookie header for ${prefix}`);
  return header;
}

function cookieValueFromSetCookie(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0].split("=").slice(1).join("=");
}

async function callbackRequestWithNonce() {
  const startResponse = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  const flowSetCookie = getSetCookie(startResponse, `${getGoogleOAuthFlowCookieName()}=`);
  const location = new URL(startResponse.headers.get("location") ?? "");
  const nonce = location.searchParams.get("nonce");
  assert.ok(nonce);
  return {
    nonce,
    request: new Request(`https://admin.example.test/auth/callback?code=auth-code&state=${location.searchParams.get("state")}`, {
      headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${cookieValueFromSetCookie(flowSetCookie)}` },
    }),
  };
}

async function callbackRequest() {
  return (await callbackRequestWithNonce()).request;
}

function signedGoogleIdToken(kid: string, privateKey: KeyObject, nonce: string): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(validGooglePayload({ nonce }))).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(`${encodedHeader}.${encodedPayload}`), privateKey).toString("base64url");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

test("OAuth returnTo permits only resolved internal admin paths", () => {
  assert.equal(normalizeReturnTo("/contents?state=draft#results"), "/contents?state=draft#results");
  assert.equal(normalizeReturnTo("https://admin.example.test/contents"), "/");
  assert.equal(normalizeReturnTo("/\\attacker.example"), "/");
  assert.equal(normalizeReturnTo("/%5C%5Cattacker.example"), "/");
  assert.equal(normalizeReturnTo("/%2Fattacker.example"), "/");
  assert.equal(normalizeReturnTo("/%2e%2e//attacker.example"), "/");
  assert.equal(normalizeReturnTo("https://attacker.example/contents"), "/");
});

test("OAuth start moves to the configured host before setting the flow cookie", async () => {
  const response = await oauthStartRoute(
    new Request("https://alternate.example.test/auth/google?returnTo=/contents"),
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://admin.example.test/auth/google?returnTo=%2Fcontents");
  assert.deepEqual(response.headers.getSetCookie(), []);
});

test("OAuth start trusts the external host forwarded by the deployment proxy", async () => {
  const response = await oauthStartRoute(
    new Request("http://0.0.0.0:8080/auth/google", {
      headers: {
        "x-forwarded-host": "admin.example.test",
        "x-forwarded-proto": "https",
      },
    }),
  );

  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /^https:\/\/accounts\.google\.com\//);
  assert.ok(response.headers.getSetCookie().some((value) => value.startsWith(`${getGoogleOAuthFlowCookieName()}=`)));
});

async function callProtectedAdminRoute(sessionCookieValue: string) {
  const route = adminApiRoute("any", async (identity) => ({ ok: true, email: identity.email }));
  const response = await route(
    new Request("https://admin.example.test/api/probe", {
      headers: { cookie: `${ADMIN_GOOGLE_SESSION_COOKIE}=${cookieValueFromSetCookie(sessionCookieValue)}` },
    }),
  );
  return {
    response,
    body: (await response.json()) as { ok?: true; email?: string; error?: { code: string } },
  };
}

test("OAuth callback creates a Google session cookie that unlocks protected routes", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  setGoogleTokenExchangeForTests(async () => ({ id_token: "id-token" }));

  const startResponse = await oauthStartRoute(new Request("https://admin.example.test/auth/google?returnTo=/contents"));
  const flowSetCookie = getSetCookie(startResponse, `${getGoogleOAuthFlowCookieName()}=`);
  const flowCookieValue = cookieValueFromSetCookie(flowSetCookie);
  const location = new URL(startResponse.headers.get("location") ?? "");
  const state = location.searchParams.get("state");
  const nonce = location.searchParams.get("nonce");
  assert.ok(state);
  assert.ok(nonce);

  setGoogleIdTokenVerifierForTests(async () => validGooglePayload({ nonce }));

  const callbackResponse = await oauthCallbackRoute(
    new Request(`http://localhost:8080/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${flowCookieValue}` },
    }),
  );

  assert.equal(callbackResponse.status, 307);
  assert.equal(callbackResponse.headers.get("location"), "https://admin.example.test/contents");
  const sessionSetCookie = getSetCookie(callbackResponse, `${ADMIN_GOOGLE_SESSION_COOKIE}=`);
  assert.match(sessionSetCookie, /HttpOnly/);
  assert.match(sessionSetCookie, /SameSite=Lax/);
  assert.match(sessionSetCookie, /Secure/);

  const result = await callProtectedAdminRoute(sessionSetCookie);
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.body, { ok: true, email: "owner@example.com" });
});

test("OAuth callback rejects bad state", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const startResponse = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  const flowSetCookie = getSetCookie(startResponse, `${getGoogleOAuthFlowCookieName()}=`);
  setGoogleTokenExchangeForTests(async () => ({ id_token: "id-token" }));
  setGoogleIdTokenVerifierForTests(async () => validGooglePayload());

  const response = await oauthCallbackRoute(
    new Request("https://admin.example.test/auth/callback?code=auth-code&state=wrong-state", {
      headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${cookieValueFromSetCookie(flowSetCookie)}` },
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { code: "session_invalid", message: "Admin identity could not be verified" },
  });
});

test("OAuth callback distinguishes invalid grants from unavailable Google services", async () => {
  const cases = [
    { status: 400, body: { error: "invalid_grant", error_description: "sensitive detail" }, expectedStatus: 403, expectedCode: "session_invalid" },
    { status: 401, body: { error: "invalid_client", error_description: "secret rejected" }, expectedStatus: 503, expectedCode: "upstream_unavailable" },
    { status: 429, body: { error: "rate_limited" }, expectedStatus: 503, expectedCode: "upstream_unavailable" },
    { status: 503, body: { error: "server_error" }, expectedStatus: 503, expectedCode: "upstream_unavailable" },
  ];

  for (const testCase of cases) {
    globalThis.fetch = async () => new Response(JSON.stringify(testCase.body), {
      status: testCase.status,
      headers: { "Content-Type": "application/json" },
    });
    const response = await oauthCallbackRoute(await callbackRequest());
    const text = await response.text();
    assert.equal(response.status, testCase.expectedStatus);
    assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, testCase.expectedCode);
    assert.doesNotMatch(text, /sensitive detail|secret rejected|server_error/);
  }

  globalThis.fetch = async () => { throw new Error("network secret"); };
  const response = await oauthCallbackRoute(await callbackRequest());
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, "upstream_unavailable");
  assert.doesNotMatch(text, /network secret/);
});

test("OAuth callback returns 403 for malformed tokens and 503 for JWK failures", async () => {
  globalThis.fetch = async () => Response.json({ id_token: "malformed-token" });
  let response = await oauthCallbackRoute(await callbackRequest());
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "session_invalid");

  const jwt = [
    Buffer.from(JSON.stringify({ alg: "RS256", kid: "key-1" })).toString("base64url"),
    Buffer.from(JSON.stringify({ iss: "https://accounts.google.com" })).toString("base64url"),
    Buffer.from("signature").toString("base64url"),
  ].join(".");
  globalThis.fetch = async (input) => String(input).includes("oauth2.googleapis.com/token")
    ? Response.json({ id_token: jwt })
    : new Response(JSON.stringify({ internal: "do not expose" }), { status: 503 });
  response = await oauthCallbackRoute(await callbackRequest());
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, "upstream_unavailable");
  assert.doesNotMatch(text, /do not expose/);
});

test("OAuth callback refreshes a valid JWK cache once when Google rotates to an unknown kid", async () => {
  const oldKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const newKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const oldJwk = { ...oldKey.publicKey.export({ format: "jwk" }), kid: "old-key" };
  const newJwk = { ...newKey.publicKey.export({ format: "jwk" }), kid: "new-key" };
  let jwkFetches = 0;
  let currentToken = "";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  setGoogleTokenExchangeForTests(async () => ({ id_token: currentToken }));
  globalThis.fetch = async () => Response.json({ keys: jwkFetches++ === 0 ? [oldJwk] : [newJwk] });

  let callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("old-key", oldKey.privateKey, callback.nonce);
  assert.equal((await oauthCallbackRoute(callback.request)).status, 307);

  callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("new-key", newKey.privateKey, callback.nonce);
  assert.equal((await oauthCallbackRoute(callback.request)).status, 307);
  assert.equal(jwkFetches, 2);
});

test("OAuth callback returns 503 when an unknown kid cannot refresh Google's JWKs", async () => {
  const oldKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const newKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const oldJwk = { ...oldKey.publicKey.export({ format: "jwk" }), kid: "old-key" };
  let jwkFetches = 0;
  let currentToken = "";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  setGoogleTokenExchangeForTests(async () => ({ id_token: currentToken }));
  globalThis.fetch = async () => {
    jwkFetches += 1;
    return jwkFetches === 1 ? Response.json({ keys: [oldJwk] }) : new Response(null, { status: 503 });
  };

  let callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("old-key", oldKey.privateKey, callback.nonce);
  assert.equal((await oauthCallbackRoute(callback.request)).status, 307);

  callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("new-key", newKey.privateKey, callback.nonce);
  const response = await oauthCallbackRoute(callback.request);
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "upstream_unavailable");
  assert.equal(jwkFetches, 2);
});

test("OAuth callback returns 403 when a refreshed JWK set still lacks the token kid", async () => {
  const oldKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const unknownKey = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const oldJwk = { ...oldKey.publicKey.export({ format: "jwk" }), kid: "old-key" };
  let jwkFetches = 0;
  let currentToken = "";
  setAdminUserLookupForTests(async (email) => ownerIdentity(email));
  setGoogleTokenExchangeForTests(async () => ({ id_token: currentToken }));
  globalThis.fetch = async () => {
    jwkFetches += 1;
    return Response.json({ keys: [oldJwk] });
  };

  let callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("old-key", oldKey.privateKey, callback.nonce);
  assert.equal((await oauthCallbackRoute(callback.request)).status, 307);

  callback = await callbackRequestWithNonce();
  currentToken = signedGoogleIdToken("unknown-key", unknownKey.privateKey, callback.nonce);
  const response = await oauthCallbackRoute(callback.request);
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error: { code: string } }).error.code, "session_invalid");
  assert.equal(jwkFetches, 2);
});

test("OAuth callback rejects wrong audience, expired tokens, nonce mismatch, and unverified email", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const startResponse = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  const flowSetCookie = getSetCookie(startResponse, `${getGoogleOAuthFlowCookieName()}=`);
  const location = new URL(startResponse.headers.get("location") ?? "");
  const state = location.searchParams.get("state");
  const nonce = location.searchParams.get("nonce");
  assert.ok(state);
  assert.ok(nonce);
  setGoogleTokenExchangeForTests(async () => ({ id_token: "id-token" }));

  const cases = [
    { payload: validGooglePayload({ aud: "wrong-audience", nonce }), expected: "session_invalid" },
    { payload: validGooglePayload({ exp: Math.floor(Date.now() / 1000) - 1, nonce }), expected: "session_invalid" },
    { payload: validGooglePayload({ nonce: "wrong-nonce" }), expected: "session_invalid" },
    { payload: validGooglePayload({ email_verified: false, nonce }), expected: "email_unverified" },
  ];

  for (const testCase of cases) {
    setGoogleIdTokenVerifierForTests(async () => testCase.payload);
    const response = await oauthCallbackRoute(
      new Request(`https://admin.example.test/auth/callback?code=auth-code&state=${state}`, {
        headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${cookieValueFromSetCookie(flowSetCookie)}` },
      }),
    );
    const body = (await response.json()) as { error?: { code: string } };
    assert.equal(response.status, 403);
    assert.equal(body.error?.code, testCase.expected);
  }
});

test("OAuth callback rejects missing or inactive admin_users rows", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";
  const startResponse = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  const flowSetCookie = getSetCookie(startResponse, `${getGoogleOAuthFlowCookieName()}=`);
  const location = new URL(startResponse.headers.get("location") ?? "");
  const state = location.searchParams.get("state");
  const nonce = location.searchParams.get("nonce");
  assert.ok(state);
  assert.ok(nonce);
  setGoogleTokenExchangeForTests(async () => ({ id_token: "id-token" }));
  setGoogleIdTokenVerifierForTests(async () => validGooglePayload({ nonce }));

  setAdminUserLookupForTests(async () => null);
  let response = await oauthCallbackRoute(
    new Request(`https://admin.example.test/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${cookieValueFromSetCookie(flowSetCookie)}` },
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error?: { code: string } }).error?.code, "session_invalid");

  setAdminUserLookupForTests(async (email) => ({ ...ownerIdentity(email), isActive: false }));
  response = await oauthCallbackRoute(
    new Request(`https://admin.example.test/auth/callback?code=auth-code&state=${state}`, {
      headers: { cookie: `${getGoogleOAuthFlowCookieName()}=${cookieValueFromSetCookie(flowSetCookie)}` },
    }),
  );
  assert.equal(response.status, 403);
  assert.equal(((await response.json()) as { error?: { code: string } }).error?.code, "session_invalid");
});

test("OAuth callback returns a sanitized 503 when admin identity lookup is unavailable", async () => {
  setGoogleTokenExchangeForTests(async () => ({ id_token: "id-token" }));
  const callback = await callbackRequestWithNonce();
  setGoogleIdTokenVerifierForTests(async () => validGooglePayload({ nonce: callback.nonce }));
  setAdminUserLookupForTests(async () => { throw new Error("sensitive database detail"); });

  const response = await oauthCallbackRoute(callback.request);
  const text = await response.text();
  assert.equal(response.status, 503);
  assert.equal((JSON.parse(text) as { error: { code: string } }).error.code, "upstream_unavailable");
  assert.doesNotMatch(text, /sensitive database detail/);
});

test("logout clears session and OAuth flow cookies", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  const response = await logoutRoute(new Request("http://localhost:8080/logout"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://admin.example.test/");
  assert.ok(response.headers.getSetCookie().some((value) => value.startsWith(`${ADMIN_GOOGLE_SESSION_COOKIE}=`) && value.includes("Max-Age=0")));
  assert.ok(response.headers.getSetCookie().some((value) => value.startsWith(`${getGoogleOAuthFlowCookieName()}=`) && value.includes("Max-Age=0")));
});

test("OAuth routes fail closed when config or session secret is missing/weak", async () => {
  process.env.HUGMEID_DEPLOY_ENV = "staging";
  process.env.HUGMEID_DATABASE_ENV = "staging";

  delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  let response = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error?: { code: string } }).error?.code, "config_missing");

  process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client-id";
  process.env.ADMIN_SESSION_SECRET = "too-short";
  response = await oauthStartRoute(new Request("https://admin.example.test/auth/google"));
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error?: { code: string } }).error?.code, "config_missing");
});
