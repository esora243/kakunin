import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  DatabaseConfigError,
  resolveDatabaseRuntimeEnvironment,
} from "../lib/db/environment";

function testEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

test("resolveDatabaseRuntimeEnvironment defaults local development to local labels", () => {
  assert.deepEqual(resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "development" })), {
    deployEnv: "local",
    databaseEnv: "local",
  });
});

test("resolveDatabaseRuntimeEnvironment accepts matching staging and production labels", () => {
  assert.deepEqual(
    resolveDatabaseRuntimeEnvironment(
      testEnv({ NODE_ENV: "production", HUGMEID_DEPLOY_ENV: "staging", HUGMEID_DATABASE_ENV: "staging" }),
    ),
    { deployEnv: "staging", databaseEnv: "staging" },
  );

  assert.deepEqual(
    resolveDatabaseRuntimeEnvironment(
      testEnv({ NODE_ENV: "production", HUGMEID_DEPLOY_ENV: "production", HUGMEID_DATABASE_ENV: "production" }),
    ),
    { deployEnv: "production", databaseEnv: "production" },
  );
});

test("resolveDatabaseRuntimeEnvironment requires explicit deploy env in production mode", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "production" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "deploy_env_required" &&
      error.deployEnv === "missing",
  );
});

test("resolveDatabaseRuntimeEnvironment preserves database env state when deploy env is missing", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "production", HUGMEID_DATABASE_ENV: "staging" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "deploy_env_required" &&
      error.deployEnv === "missing" &&
      error.databaseEnv === "staging",
  );

  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "production", HUGMEID_DATABASE_ENV: "preview" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "deploy_env_required" &&
      error.deployEnv === "missing" &&
      error.databaseEnv === "invalid",
  );
});

test("resolveDatabaseRuntimeEnvironment rejects local deploy labels in production mode", () => {
  assert.throws(
    () =>
      resolveDatabaseRuntimeEnvironment(
        testEnv({ NODE_ENV: "production", HUGMEID_DEPLOY_ENV: "local", HUGMEID_DATABASE_ENV: "local" }),
      ),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "deploy_env_invalid" &&
      error.deployEnv === "local" &&
      error.databaseEnv === "local",
  );
});

test("resolveDatabaseRuntimeEnvironment rejects invalid environment labels", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "preview", HUGMEID_DATABASE_ENV: "preview" })),
    (error) => error instanceof DatabaseConfigError && error.code === "deploy_env_invalid",
  );

  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "staging", HUGMEID_DATABASE_ENV: "prod" })),
    (error) => error instanceof DatabaseConfigError && error.code === "database_env_invalid",
  );
});

test("resolveDatabaseRuntimeEnvironment requires database env for Cloud Run environments", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "staging" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "database_env_required" &&
      error.deployEnv === "staging" &&
      error.databaseEnv === "missing",
  );
});

test("resolveDatabaseRuntimeEnvironment rejects staging and production database mismatches", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "staging", HUGMEID_DATABASE_ENV: "production" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "database_env_mismatch" &&
      error.deployEnv === "staging" &&
      error.databaseEnv === "production",
  );

  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "production", HUGMEID_DATABASE_ENV: "staging" })),
    (error) =>
      error instanceof DatabaseConfigError &&
      error.code === "database_env_mismatch" &&
      error.deployEnv === "production" &&
      error.databaseEnv === "staging",
  );
});

test("postgres runtime checks the database environment sentinel before app queries", () => {
  const source = readFileSync(join(process.cwd(), "lib/db/postgres.ts"), "utf8");

  assert.match(source, /assertDatabaseEnvironmentSentinel/);
  assert.match(source, /from app_environment where key = 'database_environment'/);
  assert.match(source, /hugmeidDatabaseEnvironmentCheck = undefined/);
  assert.match(source, /await assertDatabaseEnvironmentSentinel\(\);[\s\S]+const result = await getPool\(\)\.query/);
  assert.match(source, /await assertDatabaseEnvironmentSentinel\(\);[\s\S]+const client = await getPool\(\)\.connect/);
});
