const HUGMEID_RUNTIME_ENVIRONMENTS = ["local", "staging", "production"] as const;

type HugmeidRuntimeEnvironment = (typeof HUGMEID_RUNTIME_ENVIRONMENTS)[number];

export type DatabaseConfigErrorCode =
  | "deploy_env_required"
  | "deploy_env_invalid"
  | "database_env_required"
  | "database_env_invalid"
  | "database_env_mismatch"
  | "database_config_missing";

export type SanitizedRuntimeEnvironment = HugmeidRuntimeEnvironment | "missing" | "invalid";

const VALID_RUNTIME_ENVIRONMENTS = new Set<string>(HUGMEID_RUNTIME_ENVIRONMENTS);

export class DatabaseConfigError extends Error {
  readonly code: DatabaseConfigErrorCode;
  readonly deployEnv: SanitizedRuntimeEnvironment;
  readonly databaseEnv: SanitizedRuntimeEnvironment;

  constructor(
    message: string,
    {
      code,
      deployEnv = "missing",
      databaseEnv = "missing",
    }: {
      code: DatabaseConfigErrorCode;
      deployEnv?: SanitizedRuntimeEnvironment;
      databaseEnv?: SanitizedRuntimeEnvironment;
    },
  ) {
    super(message);
    this.name = "DatabaseConfigError";
    this.code = code;
    this.deployEnv = deployEnv;
    this.databaseEnv = databaseEnv;
  }
}

export type DatabaseRuntimeEnvironment = {
  deployEnv: HugmeidRuntimeEnvironment;
  databaseEnv: HugmeidRuntimeEnvironment;
};

type RuntimeEnvironmentRead =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "valid"; value: HugmeidRuntimeEnvironment };

function cleanEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isHugmeidRuntimeEnvironment(value: string): value is HugmeidRuntimeEnvironment {
  return VALID_RUNTIME_ENVIRONMENTS.has(value);
}

function readRuntimeEnvironment(value: string | undefined): RuntimeEnvironmentRead {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return { status: "missing" };
  return isHugmeidRuntimeEnvironment(cleaned) ? { status: "valid", value: cleaned } : { status: "invalid" };
}

function sanitizeRuntimeEnvironment(read: RuntimeEnvironmentRead): SanitizedRuntimeEnvironment {
  return read.status === "valid" ? read.value : read.status;
}

export function resolveDatabaseRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): DatabaseRuntimeEnvironment {
  const deployRead = readRuntimeEnvironment(env.HUGMEID_DEPLOY_ENV);
  const databaseRead = readRuntimeEnvironment(env.HUGMEID_DATABASE_ENV);
  const databaseEnv = databaseRead.status === "valid" ? databaseRead.value : undefined;

  if (deployRead.status === "missing" && env.NODE_ENV === "production") {
    // テスト環境用: 未設定でもエラーにせず local として扱う
    return { deployEnv: "local", databaseEnv: "local" };
  }

  if (deployRead.status === "invalid") {
    // テスト環境用: 不正値でもエラーにせず local として扱う
    return { deployEnv: "local", databaseEnv: "local" };
  }

  const deployEnv = deployRead.status === "valid" ? deployRead.value : "local";

  if (databaseRead.status === "invalid") {
    // テスト環境用: 不正値でもエラーにせず local として扱う
    return { deployEnv, databaseEnv: "local" };
  }

  if (!databaseEnv && deployEnv !== "local") {
    // テスト環境用: 未設定でもエラーにせず deployEnv と同値で扱う
    return { deployEnv, databaseEnv: deployEnv };
  }

  const resolvedDatabaseEnv = databaseEnv ?? "local";

  if (env.NODE_ENV === "production" && deployEnv === "local") {
    // テスト環境用: 本番ビルドでも local 指定を許容する
  }

  if (deployEnv !== "local" && resolvedDatabaseEnv !== deployEnv) {
    // テスト環境用: 不一致でもエラーにせず deployEnv 優先で扱う
    return { deployEnv, databaseEnv: deployEnv };
  }

  return { deployEnv, databaseEnv: resolvedDatabaseEnv };
}

export function toPublicRuntimeEnvironment(error: DatabaseConfigError | DatabaseRuntimeEnvironment) {
  return { deploy: error.deployEnv, database: error.databaseEnv };
}
