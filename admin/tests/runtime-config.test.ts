import assert from "node:assert/strict";
import test from "node:test";
import { assertAdminRuntimeConfig } from "../lib/runtime-config";

const valid = {
  NODE_ENV: "production",
  HUGMEID_DEPLOY_ENV: "staging",
  HUGMEID_DATABASE_ENV: "staging",
  GOOGLE_OAUTH_CLIENT_ID: "client",
  GOOGLE_OAUTH_CLIENT_SECRET: "secret",
  GOOGLE_OAUTH_REDIRECT_URI: "https://admin.example.test/auth/callback",
  ADMIN_SESSION_SECRET: "s".repeat(32),
  REVALIDATE_ADMIN_SECRET: "revalidate-secret",
  GCS_PUBLIC_ASSET_BUCKET: "hugmeid-public-assets-staging",
  GCS_PUBLIC_ASSET_BASE_URL: "https://app.example.test/api/assets/public",
  PUBLIC_APP_REVALIDATE_URL: "https://app.example.test/api/admin/revalidate",
  PGDATABASE: "hugmeid",
  PGUSER: "admin",
  PGPASSWORD: "password",
  CLOUD_SQL_CONNECTION_NAME: "project:region:instance",
} as NodeJS.ProcessEnv;

test("admin non-local runtime config requires OAuth, session, and database configuration", () => {
  assert.doesNotThrow(() => assertAdminRuntimeConfig(valid));
  for (const name of ["GOOGLE_OAUTH_CLIENT_SECRET", "ADMIN_SESSION_SECRET", "REVALIDATE_ADMIN_SECRET", "GCS_PUBLIC_ASSET_BUCKET", "PGDATABASE"] as const) {
    const env = { ...valid };
    delete env[name];
    assert.throws(() => assertAdminRuntimeConfig(env));
  }
});

test("admin non-local runtime config requires a valid managed asset base URL", () => {
  for (const value of [
    undefined,
    "",
    "http://app.example.test/api/assets/public",
    "https://user:password@app.example.test/api/assets/public",
    "https://app.example.test:0/api/assets/public",
    "https://app.example.test/api/assets/public?variant=bad",
    "https://app.example.test/",
    "https://other.example.test/api/assets/public",
    "https://storage.googleapis.com/api/assets/public",
    "https://bucket.storage.googleapis.com/api/assets/public",
    "not a url",
  ]) {
    const env = { ...valid, GCS_PUBLIC_ASSET_BASE_URL: value };
    assert.throws(() => assertAdminRuntimeConfig(env), /GCS_PUBLIC_ASSET_BASE_URL/);
  }
});

test("admin non-local runtime config requires the matching canonical public revalidation URL", () => {
  for (const value of [
    undefined,
    "http://app.example.test/api/admin/revalidate",
    "https://app.example.test:0/api/admin/revalidate",
    "https://app.example.test/",
    "https://other.example.test/api/admin/revalidate",
    "https://app.example.test/api/admin/revalidate?secret=bad",
  ]) {
    const env = { ...valid, PUBLIC_APP_REVALIDATE_URL: value };
    assert.throws(() => assertAdminRuntimeConfig(env), /PUBLIC_APP_REVALIDATE_URL/);
  }
});
