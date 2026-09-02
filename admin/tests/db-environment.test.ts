import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseConfigError, resolveDatabaseRuntimeEnvironment } from "../lib/db/environment";

function testEnv(values: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

test("resolveDatabaseRuntimeEnvironment defaults local development to local labels", () => {
  assert.deepEqual(resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "development" })), {
    deployEnv: "local",
    databaseEnv: "local",
  });
});

test("resolveDatabaseRuntimeEnvironment requires explicit deploy env in production mode", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ NODE_ENV: "production" })),
    (error) => error instanceof DatabaseConfigError && error.code === "deploy_env_required",
  );
});

test("resolveDatabaseRuntimeEnvironment rejects staging and production database mismatches", () => {
  assert.throws(
    () => resolveDatabaseRuntimeEnvironment(testEnv({ HUGMEID_DEPLOY_ENV: "staging", HUGMEID_DATABASE_ENV: "production" })),
    (error) => error instanceof DatabaseConfigError && error.code === "database_env_mismatch",
  );
});

test("resolveDatabaseRuntimeEnvironment accepts matching staging labels for the admin runtime connection", () => {
  assert.deepEqual(
    resolveDatabaseRuntimeEnvironment(
      testEnv({ NODE_ENV: "production", HUGMEID_DEPLOY_ENV: "staging", HUGMEID_DATABASE_ENV: "staging" }),
    ),
    { deployEnv: "staging", databaseEnv: "staging" },
  );
});
