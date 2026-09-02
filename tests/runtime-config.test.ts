import assert from "node:assert/strict";
import test from "node:test";
import { assertPublicRuntimeConfig, releaseSha } from "../lib/runtime-config";

const productionEnv = {
  NODE_ENV: "production",
  HUGMEID_DEPLOY_ENV: "production",
  HUGMEID_DATABASE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://hugmeid.example.com",
  NEXT_PUBLIC_CONTACT_EMAIL: "contact@hugmeid.example.com",
  NEXT_PUBLIC_LIFF_ID: "liff-id",
  IMAGE_ALLOWED_REMOTE_HOSTS: "assets.example.com,cdn.example.com",
  LINE_CHANNEL_ID: "line-channel",
  LINE_CHANNEL_SECRET: "line-secret",
  LINE_CHANNEL_ACCESS_TOKEN: "line-access-token",
  REVALIDATE_ADMIN_SECRET: "revalidate-secret",
  GCS_PUBLIC_ASSET_BUCKET: "hugmeid-public-assets-production",
  SESSION_SECRET: "s".repeat(32),
  HUGMEID_RELEASE_SHA: "a".repeat(40),
} as NodeJS.ProcessEnv;

test("non-local runtime config fails closed when a required value is absent", () => {
  for (const name of ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_CONTACT_EMAIL", "SESSION_SECRET", "LINE_CHANNEL_ID", "REVALIDATE_ADMIN_SECRET", "GCS_PUBLIC_ASSET_BUCKET"] as const) {
    const env = { ...productionEnv };
    delete env[name];
    assert.throws(() => assertPublicRuntimeConfig(env));
  }
});

test("non-local runtime config rejects local-only HTTP site URLs", () => {
  for (const siteUrl of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
    assert.throws(
      () => assertPublicRuntimeConfig({ ...productionEnv, NEXT_PUBLIC_SITE_URL: siteUrl }),
      /valid HTTPS URL/,
    );
  }
});

test("valid non-local runtime config and local release label are accepted", () => {
  assert.doesNotThrow(() => assertPublicRuntimeConfig(productionEnv));
  assert.equal(releaseSha({ ...process.env, HUGMEID_DEPLOY_ENV: "local" }), "local");
  assert.equal(releaseSha(productionEnv), "a".repeat(40));
});

test("unused future messaging tokens do not gate health when staging has a release identity", () => {
  const stagingEnv: NodeJS.ProcessEnv = {
    ...productionEnv,
    HUGMEID_DEPLOY_ENV: "staging",
    HUGMEID_DATABASE_ENV: "staging",
  };
  delete stagingEnv.LINE_CHANNEL_ACCESS_TOKEN;
  assert.doesNotThrow(() => assertPublicRuntimeConfig(stagingEnv));
  assert.equal(releaseSha(stagingEnv), "a".repeat(40));
});

test("all non-local health checks require a rollout release SHA", () => {
  for (const deployEnv of ["staging", "production"] as const) {
    const env: NodeJS.ProcessEnv = {
      ...productionEnv,
      HUGMEID_DEPLOY_ENV: deployEnv,
      HUGMEID_DATABASE_ENV: deployEnv,
    };
    delete env.HUGMEID_RELEASE_SHA;
    assert.throws(() => assertPublicRuntimeConfig(env), /HUGMEID_RELEASE_SHA/);
    assert.throws(() => releaseSha(env), /HUGMEID_RELEASE_SHA/);
  }
});

test("non-local image host allowlists fail closed when missing or malformed", () => {
  for (const value of [undefined, "", "https://assets.example.com", "assets.example.com,"]) {
    const env = { ...productionEnv, IMAGE_ALLOWED_REMOTE_HOSTS: value };
    assert.throws(() => assertPublicRuntimeConfig(env), /IMAGE_ALLOWED_REMOTE_HOSTS/);
  }
});
