import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { LEGAL_CONSENT_VERSION } from "../lib/legal-consent";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("legal consent version matches the published documents", () => {
  assert.equal(LEGAL_CONSENT_VERSION, "2026-07-25");
  assert.match(source("lib/legal.ts"), /formatVersionDate\(LEGAL_CONSENT_VERSION\)/);
  assert.doesNotMatch(source("lib/legal.ts"), /利用した時点で.*取消不能な同意/);
  assert.match(source("lib/legal.ts"), /マーケティング通知およびプッシュ通知は任意/);
});

test("explicit consent version is preserved from the login action through session creation", () => {
  const loginModal = source("components/LoginModal.tsx");
  const auth = source("components/AuthContext.tsx");
  const route = source("app/api/auth/line/session/route.ts");

  assert.match(loginModal, /onLogin\(LEGAL_CONSENT_VERSION\)/);
  assert.match(auth, /storePendingLegalConsent\(legalConsentVersion\)/);
  assert.match(auth, /createLineSession\(idToken, legalConsentVersion\)/);
  assert.match(route, /setSessionCookie\(\{ userId: me\.id, legalConsentVersion \}\)/);
});

test("LIFF redirect resume requires a current pending consent marker", () => {
  const auth = source("components/AuthContext.tsx");
  const resume = auth.slice(auth.indexOf("if (state.isConfigured && state.isLoggedIn)"));
  const pendingRead = resume.indexOf("readPendingLegalConsent()");
  const tokenRead = resume.indexOf("getLiffIdToken()");
  const sessionWrite = resume.indexOf("createLineSession(idToken, legalConsentVersion)");

  assert.ok(pendingRead >= 0);
  assert.ok(tokenRead > pendingRead);
  assert.ok(sessionWrite > tokenRead);
});

test("LINE session rejects missing or stale consent before LINE verification and database writes", () => {
  const route = source("app/api/auth/line/session/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));
  const consentGuard = post.indexOf("!isCurrentLegalConsentVersion(legalConsentVersion)");
  const lineVerify = post.indexOf("verifyLineIdToken({ idToken })");
  const userWrite = post.indexOf("upsertUserByLineUid(lineUid, legalConsentVersion)");

  assert.ok(consentGuard >= 0);
  assert.ok(lineVerify > consentGuard);
  assert.ok(userWrite > lineVerify);
  assert.match(post, /code:\s*"legal_consent_required"/);
});

test("LINE user upsert and append-only consent insert share one transaction", () => {
  const users = source("lib/users.ts");
  const upsert = users.slice(
    users.indexOf("export async function upsertUserByLineUid"),
    users.indexOf("export async function getMeForSession"),
  );

  assert.match(upsert, /return dbTransaction\(async \(client\) =>/);
  assert.match(upsert, /insert into users/);
  assert.match(upsert, /insert into user_legal_consents/);
  assert.match(upsert, /on conflict \(user_id, version\) do nothing/);
});

test("legal consent baseline and role policy remain unique, server-timestamped, and append-only", () => {
  const baseline = source("cloudsql/baseline/20260730000000_schema.sql");
  const access = source("cloudsql/migrations/20260730000002_runtime_access.sql");

  assert.match(baseline, /CREATE TABLE public\.user_legal_consents/);
  assert.match(baseline, /accepted_at timestamp with time zone DEFAULT now\(\) NOT NULL/);
  assert.match(baseline, /user_legal_consents_user_id_version_key UNIQUE \(user_id, version\)/);
  assert.match(access, /grant select, insert on public\.user_legal_consents to hugmeid_public_runtime/);
  assert.doesNotMatch(access, /grant[^;]*(?:update|delete)[^;]*user_legal_consents/i);
});

test("public browsing has no global consent gate and legal documents remain reachable", () => {
  assert.equal(existsSync(join(process.cwd(), "components/LegalConsentGate.tsx")), false);
  assert.equal(existsSync(join(process.cwd(), "components/LegalConsentModal.tsx")), false);
  assert.equal(existsSync(join(process.cwd(), "app/terms/page.tsx")), true);
  assert.equal(existsSync(join(process.cwd(), "app/privacy/page.tsx")), true);
  assert.match(source("components/LoginModal.tsx"), /href="\/terms"/);
  assert.match(source("components/LoginModal.tsx"), /href="\/privacy"/);
});
