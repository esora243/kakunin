import "server-only";

import { Pool, type PoolClient, type PoolConfig, type QueryResult, types } from "pg";
import {
  DatabaseConfigError,
  resolveDatabaseRuntimeEnvironment,
  type DatabaseRuntimeEnvironment,
  type SanitizedRuntimeEnvironment,
} from "./environment";

types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);

export { DatabaseConfigError } from "./environment";

const globalForPostgres = globalThis as typeof globalThis & {
  hugmeidPostgresPool?: Pool;
  hugmeidDatabaseEnvironmentCheck?: Promise<void>;
};

function getDatabaseConfig(): PoolConfig {
  const runtimeEnvironment = resolveDatabaseRuntimeEnvironment();
  const database = process.env.PGDATABASE;
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const connectionName = process.env.CLOUD_SQL_CONNECTION_NAME;
  const host = process.env.PGHOST ?? (connectionName ? `/cloudsql/${connectionName}` : undefined);
  const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;

  if (!database || !user || !password || !host) {
    throw new DatabaseConfigError("Cloud SQL PostgreSQL config is not configured", {
      code: "database_config_missing",
      deployEnv: runtimeEnvironment.deployEnv,
      databaseEnv: runtimeEnvironment.databaseEnv,
    });
  }

  return { database, user, password, host, port };
}

function getPool() {
  if (!globalForPostgres.hugmeidPostgresPool) {
    globalForPostgres.hugmeidPostgresPool = new Pool({
      ...getDatabaseConfig(),
      max: Number(process.env.PGPOOL_MAX ?? 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return globalForPostgres.hugmeidPostgresPool;
}

export function getDatabaseRuntimeEnvironment(): DatabaseRuntimeEnvironment {
  return resolveDatabaseRuntimeEnvironment();
}

function sanitizeDatabaseEnvironment(value: unknown): SanitizedRuntimeEnvironment {
  return value === "local" || value === "staging" || value === "production" ? value : "invalid";
}

async function assertDatabaseEnvironmentSentinel() {
  const runtimeEnvironment = resolveDatabaseRuntimeEnvironment();
  if (runtimeEnvironment.deployEnv === "local") return;

  if (!globalForPostgres.hugmeidDatabaseEnvironmentCheck) {
    globalForPostgres.hugmeidDatabaseEnvironmentCheck = (async () => {
      const { rows } = await getPool().query<{ value: string }>(
        "select value from app_environment where key = 'database_environment' limit 1",
      );
      const databaseEnv = rows[0]?.value;
      if (databaseEnv !== runtimeEnvironment.databaseEnv) {
        throw new DatabaseConfigError("Cloud SQL database environment sentinel does not match runtime configuration", {
          code: "database_env_mismatch",
          deployEnv: runtimeEnvironment.deployEnv,
          databaseEnv: databaseEnv ? sanitizeDatabaseEnvironment(databaseEnv) : "missing",
        });
      }
    })().catch((error) => {
      globalForPostgres.hugmeidDatabaseEnvironmentCheck = undefined;
      throw error;
    });
  }

  return globalForPostgres.hugmeidDatabaseEnvironmentCheck;
}

type DbQueryResult<T> = Omit<QueryResult, "rows"> & { rows: T[] };

type TimedQueryDependencies = {
  acquireClient?: () => Promise<PoolClient>;
};

export async function dbQuery<T extends object = Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<DbQueryResult<T>> {
  await assertDatabaseEnvironmentSentinel();
  const result = await getPool().query(text, [...values]);
  return result as DbQueryResult<T>;
}

export async function dbQueryWithStatementTimeout<T extends object = Record<string, unknown>>(
  text: string,
  values: readonly unknown[],
  statementTimeoutMs: number,
  dependencies: TimedQueryDependencies = {},
): Promise<DbQueryResult<T>> {
  if (!Number.isFinite(statementTimeoutMs) || statementTimeoutMs <= 0) {
    throw new Error("statementTimeoutMs must be a positive finite number");
  }

  const timeoutMs = Math.max(1, Math.trunc(statementTimeoutMs));
  const timeoutError = new Error("Database query exceeded its statement timeout");
  let client: PoolClient | undefined;
  let connectionDestroyed = false;
  let deadlineExceeded = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      deadlineExceeded = true;
      if (client) {
        connectionDestroyed = true;
        client.release(timeoutError);
      }
      reject(timeoutError);
    }, timeoutMs);
  });

  const operation = (async () => {
    try {
      await assertDatabaseEnvironmentSentinel();
      if (deadlineExceeded) throw timeoutError;
      const acquiredClient = await (dependencies.acquireClient ?? (() => getPool().connect()))();
      if (deadlineExceeded) {
        acquiredClient.release(timeoutError);
        throw timeoutError;
      }
      client = acquiredClient;
      await client.query("begin");
      await client.query("select set_config('statement_timeout', $1, true)", [`${timeoutMs}ms`]);
      const result = await client.query<T>(text, [...values]);
      await client.query("commit");
      return result as DbQueryResult<T>;
    } catch (error) {
      if (client && !connectionDestroyed) {
        try {
          await client.query("rollback");
        } catch {
          connectionDestroyed = true;
          client.release(error instanceof Error ? error : new Error("Database rollback failed"));
        }
      }
      throw error;
    }
  })();

  try {
    return await Promise.race([operation, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (client && !connectionDestroyed) client.release();
  }
}

export async function dbTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await assertDatabaseEnvironmentSentinel();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
