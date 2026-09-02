import { createHmac, createPublicKey, createVerify, randomBytes, timingSafeEqual, type JsonWebKey } from "node:crypto";
import { resolveDatabaseRuntimeEnvironment } from "../db/environment";
import { lookupAdminUserByEmail } from "./admin-session";
import { ADMIN_GOOGLE_SESSION_COOKIE, createAdminGoogleSessionToken } from "./google-session";
import { AdminAuthError } from "./types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_JWK_CACHE_TTL_MS = 60 * 60 * 1000;
const GOOGLE_OAUTH_FLOW_COOKIE = "admin_google_oauth_flow";
const GOOGLE_OAUTH_FLOW_TTL_SECONDS = 10 * 60;
const GOOGLE_SESSION_TTL_SECONDS = 8 * 60 * 60;
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;

type GoogleIdTokenPayload = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  email?: unknown;
  email_verified?: unknown;
  nonce?: unknown;
};

type GoogleTokenResponse = {
  id_token?: string;
};

type GoogleTokenErrorResponse = {
  error?: unknown;
};

type GoogleJwkSet = {
  keys: Array<JsonWebKey & { kid?: string }>;
};

type GoogleJwkCache = {
  expiresAt: number;
  keys: Map<string, JsonWebKey>;
};

type GoogleOAuthFlowPayload = {
  state: string;
  nonce: string;
  returnTo: string;
  exp: number;
};

type TokenExchange = (code: string) => Promise<GoogleTokenResponse>;
type IdTokenVerifier = (idToken: string) => Promise<GoogleIdTokenPayload>;

let tokenExchangeForTests: TokenExchange | null = null;
let idTokenVerifierForTests: IdTokenVerifier | null = null;

const globalForGoogleKeys = globalThis as typeof globalThis & {
  hugmeidGoogleOauthJwkCache?: GoogleJwkCache;
};

export function setGoogleTokenExchangeForTests(exchange: TokenExchange | null): void {
  tokenExchangeForTests = exchange;
}

export function setGoogleIdTokenVerifierForTests(verifier: IdTokenVerifier | null): void {
  idTokenVerifierForTests = verifier;
}

export function resetGoogleJwkCacheForTests(): void {
  globalForGoogleKeys.hugmeidGoogleOauthJwkCache = undefined;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

function requiredEnv(name: "GOOGLE_OAUTH_CLIENT_ID" | "GOOGLE_OAUTH_CLIENT_SECRET" | "GOOGLE_OAUTH_REDIRECT_URI"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AdminAuthError(`${name} must be configured`, "config_missing");
  return value;
}

export function publicAdminOrigin(): string {
  try {
    return new URL(requiredEnv("GOOGLE_OAUTH_REDIRECT_URI")).origin;
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError("GOOGLE_OAUTH_REDIRECT_URI must be an absolute URL", "config_missing");
  }
}

function requiredSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new AdminAuthError("ADMIN_SESSION_SECRET is required", "config_missing");
  const deployEnv = resolveDatabaseRuntimeEnvironment().deployEnv;
  if (deployEnv !== "local" && secret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) {
    throw new AdminAuthError("ADMIN_SESSION_SECRET must be at least 32 characters outside local development", "config_missing");
  }
  return secret;
}

function cookieAttributes(maxAgeSeconds: number): string {
  const deployEnv = resolveDatabaseRuntimeEnvironment().deployEnv;
  const secure = deployEnv !== "local" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function signValue(value: string): string {
  return createHmac("sha256", requiredSessionSecret()).update(value).digest("base64url");
}

function createFlowCookieValue(payload: GoogleOAuthFlowPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signValue(encodedPayload)}`;
}

function verifyFlowCookieValue(value: string): GoogleOAuthFlowPayload {
  const [encodedPayload, signature, extra] = value.split(".");
  if (!encodedPayload || !signature || extra !== undefined) {
    throw new AdminAuthError("OAuth flow cookie is invalid", "session_invalid");
  }
  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(signValue(encodedPayload), "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AdminAuthError("OAuth flow cookie is invalid", "session_invalid");
  }
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as GoogleOAuthFlowPayload;
    if (
      typeof payload.state !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.returnTo !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new AdminAuthError("OAuth flow cookie is invalid", "session_invalid");
    }
    return payload;
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError("OAuth flow cookie is invalid", "session_invalid");
  }
}

function sessionSetCookieHeader(email: string): string {
  const token = createAdminGoogleSessionToken({
    email,
    emailVerified: true,
    exp: Math.floor(Date.now() / 1000) + GOOGLE_SESSION_TTL_SECONDS,
  });
  return `${ADMIN_GOOGLE_SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieAttributes(GOOGLE_SESSION_TTL_SECONDS)}`;
}

function flowSetCookieHeader(payload: GoogleOAuthFlowPayload): string {
  return `${GOOGLE_OAUTH_FLOW_COOKIE}=${encodeURIComponent(createFlowCookieValue(payload))}; ${cookieAttributes(
    GOOGLE_OAUTH_FLOW_TTL_SECONDS,
  )}`;
}

function expiredCookieHeader(name: string): string {
  return `${name}=; ${cookieAttributes(0)}`;
}

function randomToken(): string {
  return Buffer.from(randomBytes(32)).toString("base64url");
}

function decodeJwtSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  if (tokenExchangeForTests) return tokenExchangeForTests(code);

  let response: Response;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
        redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
  } catch {
    throw new AdminAuthError("Google token exchange is unavailable", "upstream_unavailable");
  }
  if (!response.ok) {
    let providerCode: unknown;
    try {
      providerCode = ((await response.json()) as GoogleTokenErrorResponse).error;
    } catch {
      providerCode = undefined;
    }
    if (providerCode === "invalid_grant") {
      throw new AdminAuthError("Google authorization grant is invalid", "session_invalid");
    }
    throw new AdminAuthError("Google token exchange is unavailable", "upstream_unavailable");
  }
  try {
    return (await response.json()) as GoogleTokenResponse;
  } catch {
    throw new AdminAuthError("Google token exchange returned an invalid response", "upstream_unavailable");
  }
}

async function getGooglePublicKeys(forceRefresh = false): Promise<Map<string, JsonWebKey>> {
  const cached = globalForGoogleKeys.hugmeidGoogleOauthJwkCache;
  const now = Date.now();
  if (!forceRefresh && cached && cached.expiresAt > now) return cached.keys;

  let response: Response;
  try {
    response = await fetch(GOOGLE_JWKS_URL, { cache: "no-store" });
  } catch {
    throw new AdminAuthError("Google signing keys are unavailable", "upstream_unavailable");
  }
  if (!response.ok) throw new AdminAuthError("Google signing keys are unavailable", "upstream_unavailable");
  let jwks: GoogleJwkSet;
  try {
    jwks = (await response.json()) as GoogleJwkSet;
  } catch {
    throw new AdminAuthError("Google signing keys response is invalid", "upstream_unavailable");
  }
  if (!Array.isArray(jwks.keys)) {
    throw new AdminAuthError("Google signing keys response is invalid", "upstream_unavailable");
  }
  const keys = new Map<string, JsonWebKey>();
  for (const key of jwks.keys) {
    if (key.kid) keys.set(key.kid, key);
  }
  globalForGoogleKeys.hugmeidGoogleOauthJwkCache = { keys, expiresAt: now + GOOGLE_JWK_CACHE_TTL_MS };
  return keys;
}

async function verifyGoogleIdTokenSignature(idToken: string): Promise<GoogleIdTokenPayload> {
  try {
    const [encodedHeader, encodedPayload, encodedSignature, extra] = idToken.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature || extra !== undefined) {
      throw new Error("invalid JWT shape");
    }

    const header = decodeJwtSegment<{ alg?: unknown; kid?: unknown }>(encodedHeader);
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
      throw new Error("invalid JWT header");
    }

    let keys = await getGooglePublicKeys();
    let jwk = keys.get(header.kid);
    if (!jwk) {
      keys = await getGooglePublicKeys(true);
      jwk = keys.get(header.kid);
    }
    if (!jwk) throw new Error("unknown Google key id");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    const valid = verifier.verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(encodedSignature, "base64url"));
    if (!valid) throw new Error("invalid JWT signature");

    return decodeJwtSegment<GoogleIdTokenPayload>(encodedPayload);
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw new AdminAuthError("Google ID token signature is invalid", "session_invalid");
  }
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
  if (idTokenVerifierForTests) return idTokenVerifierForTests(idToken);
  return verifyGoogleIdTokenSignature(idToken);
}

function validateIdTokenPayload(payload: GoogleIdTokenPayload, expectedNonce: string): string {
  if (!GOOGLE_ISSUERS.has(String(payload.iss ?? ""))) {
    throw new AdminAuthError("Google ID token issuer is invalid", "session_invalid");
  }
  if (payload.aud !== requiredEnv("GOOGLE_OAUTH_CLIENT_ID")) {
    throw new AdminAuthError("Google ID token audience is invalid", "session_invalid");
  }
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new AdminAuthError("Google ID token is expired", "session_invalid");
  }
  if (payload.nonce !== expectedNonce) {
    throw new AdminAuthError("Google ID token nonce is invalid", "session_invalid");
  }
  if (payload.email_verified !== true) {
    throw new AdminAuthError("Google ID token email is not verified", "email_unverified");
  }
  const email = normalizeEmail(payload.email);
  if (!email) throw new AdminAuthError("Google ID token is missing an email claim", "session_invalid");
  return email;
}

export function getGoogleOAuthFlowCookieName(): string {
  return GOOGLE_OAUTH_FLOW_COOKIE;
}

export function normalizeReturnTo(input: string | null | undefined): string {
  if (!input || !input.startsWith("/") || input.startsWith("//")) return "/";
  const adminOrigin = publicAdminOrigin();
  let resolved: URL;
  try {
    resolved = new URL(input, adminOrigin);
  } catch {
    return "/";
  }
  if (
    resolved.origin !== adminOrigin ||
    !resolved.pathname.startsWith("/") ||
    resolved.pathname.startsWith("//") ||
    resolved.pathname.startsWith("/auth/") ||
    /%(?:2f|5c)/i.test(resolved.pathname)
  ) {
    return "/";
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

export function createGoogleAuthorizationRedirect(returnTo: string) {
  const flow: GoogleOAuthFlowPayload = {
    state: randomToken(),
    nonce: randomToken(),
    returnTo: normalizeReturnTo(returnTo),
    exp: Math.floor(Date.now() / 1000) + GOOGLE_OAUTH_FLOW_TTL_SECONDS,
  };

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requiredEnv("GOOGLE_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", flow.state);
  url.searchParams.set("nonce", flow.nonce);
  url.searchParams.set("prompt", "select_account");

  requiredSessionSecret();

  return {
    redirectUrl: url.toString(),
    setCookieHeader: flowSetCookieHeader(flow),
  };
}

export async function completeGoogleOAuthCallback(params: {
  code: string | null;
  state: string | null;
  flowCookie: string | null;
}) {
  if (!params.flowCookie) throw new AdminAuthError("OAuth flow cookie is missing", "session_invalid");
  const flow = verifyFlowCookieValue(params.flowCookie);
  if (!params.code || !params.state || params.state !== flow.state) {
    throw new AdminAuthError("OAuth state is invalid", "session_invalid");
  }

  const tokens = await exchangeCodeForTokens(params.code);
  if (!tokens.id_token) throw new AdminAuthError("Google token exchange did not return an ID token", "upstream_unavailable");
  const payload = await verifyGoogleIdToken(tokens.id_token);
  const email = validateIdTokenPayload(payload, flow.nonce);
  let adminIdentity;
  try {
    adminIdentity = await lookupAdminUserByEmail(email);
  } catch {
    throw new AdminAuthError("Admin identity lookup is unavailable", "upstream_unavailable");
  }
  if (!adminIdentity || !adminIdentity.isActive) {
    throw new AdminAuthError("Google account is not authorized for admin access", "session_invalid");
  }

  return {
    redirectTo: flow.returnTo,
    setCookieHeaders: [
      sessionSetCookieHeader(email),
      expiredCookieHeader(GOOGLE_OAUTH_FLOW_COOKIE),
    ],
  };
}

export function clearAdminAuthCookieHeaders(): string[] {
  return [
    expiredCookieHeader(ADMIN_GOOGLE_SESSION_COOKIE),
    expiredCookieHeader(GOOGLE_OAUTH_FLOW_COOKIE),
  ];
}
