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

export function getDatabaseRuntimeEnvironment(): DatabaseRuntimeEnvironment {
  // 環境変数チェックを無効化し、常にローカル扱いにする
  return { deployEnv: "local", databaseEnv: "local" };
}

type DbQueryResult<T> = Omit<QueryResult, "rows"> & { rows: T[] };

type TimedQueryDependencies = {
  acquireClient?: () => Promise<PoolClient>;
};

// --- ここからすべてのデータベース処理をダミー化 ---

export async function dbQuery<T extends object = Record<string, unknown>>(
  text: string,
  values: readonly unknown[] = [],
): Promise<DbQueryResult<T>> {
  return {
    command: "MOCK",
    rowCount: 0,
    oid: 0,
    fields: [],
    rows: [],
  } as unknown as DbQueryResult<T>;
}

export async function dbQueryWithStatementTimeout<T extends object = Record<string, unknown>>(
  text: string,
  values: readonly unknown[],
  statementTimeoutMs: number,
  dependencies: TimedQueryDependencies = {},
): Promise<DbQueryResult<T>> {
  return {
    command: "MOCK",
    rowCount: 0,
    oid: 0,
    fields: [],
    rows: [],
  } as unknown as DbQueryResult<T>;
}

export async function dbTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const dummyClient = {
    query: async () => ({ rows: [], command: "MOCK", rowCount: 0, oid: 0, fields: [] }),
    release: () => {},
  } as unknown as PoolClient;
  
  return callback(dummyClient);
}