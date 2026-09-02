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
    throw new DatabaseConfigError("HUGMEID_DEPLOY_ENV is required when NODE_ENV is production", {
      code: "deploy_env_required",
      deployEnv: "missing",
      databaseEnv: sanitizeRuntimeEnvironment(databaseRead),
    });
  }

  if (deployRead.status === "invalid") {
    throw new DatabaseConfigError("HUGMEID_DEPLOY_ENV must be local, staging, or production", {
      code: "deploy_env_invalid",
      deployEnv: "invalid",
      databaseEnv: sanitizeRuntimeEnvironment(databaseRead),
    });
  }

  const deployEnv = deployRead.status === "valid" ? deployRead.value : "local";

  if (databaseRead.status === "invalid") {
    throw new DatabaseConfigError("HUGMEID_DATABASE_ENV must be local, staging, or production", {
      code: "database_env_invalid",
      deployEnv,
      databaseEnv: "invalid",
    });
  }

  if (!databaseEnv && deployEnv !== "local") {
    throw new DatabaseConfigError("HUGMEID_DATABASE_ENV is required for staging and production deployments", {
      code: "database_env_required",
      deployEnv,
      databaseEnv: "missing",
    });
  }

  const resolvedDatabaseEnv = databaseEnv ?? "local";

  if (env.NODE_ENV === "production" && deployEnv === "local") {
    throw new DatabaseConfigError("HUGMEID_DEPLOY_ENV cannot be local when NODE_ENV is production", {
      code: "deploy_env_invalid",
      deployEnv,
      databaseEnv: resolvedDatabaseEnv,
    });
  }

  if (deployEnv !== "local" && resolvedDatabaseEnv !== deployEnv) {
    throw new DatabaseConfigError("HUGMEID_DATABASE_ENV must match HUGMEID_DEPLOY_ENV outside local development", {
      code: "database_env_mismatch",
      deployEnv,
      databaseEnv: resolvedDatabaseEnv,
    });
  }

  return { deployEnv, databaseEnv: resolvedDatabaseEnv };
}

export function toPublicRuntimeEnvironment(error: DatabaseConfigError | DatabaseRuntimeEnvironment) {
  return { deploy: error.deployEnv, database: error.databaseEnv };
}
