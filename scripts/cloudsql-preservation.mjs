import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const PRESERVED_TABLES_BY_VERSION = {
  1: ["admin_users", "admin_audit_logs", "assets"],
  2: ["admin_users", "admin_audit_logs", "assets", "asset_variants"],
};
const CURRENT_FORMAT_VERSION = 2;
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const VALID_ENVIRONMENTS = new Set(["local", "staging", "production"]);

function quoteIdentifier(value) {
  if (!SAFE_IDENTIFIER.test(value)) throw new Error(`Unsafe PostgreSQL identifier: ${value}`);
  return `"${value}"`;
}

function sha256(values) {
  const hash = createHash("sha256");
  for (const value of values) {
    hash.update(value, "utf8");
    hash.update("\n", "utf8");
  }
  return hash.digest("hex");
}

function tablesChecksum(tables) {
  return sha256(
    tables.flatMap((table) => [
      table.name,
      JSON.stringify(table.columns),
      ...table.rows,
    ]),
  );
}

export function bundleChecksum(bundle) {
  return sha256([
    String(bundle.formatVersion),
    bundle.capturedAt,
    bundle.source.database,
    bundle.source.environment,
    bundle.source.attestation ?? "",
    tablesChecksum(bundle.tables),
  ]);
}

function validateBundle(bundle) {
  const preservedTables = PRESERVED_TABLES_BY_VERSION[bundle.formatVersion];
  if (!preservedTables || !Array.isArray(bundle.tables)) {
    throw new Error("Unsupported preservation bundle format");
  }
  const tableNames = bundle.tables.map((table) => table.name);
  if (JSON.stringify(tableNames) !== JSON.stringify(preservedTables)) {
    throw new Error(
      `Preservation bundle must contain exactly these tables in dependency order: ${preservedTables.join(", ")}`,
    );
  }
  for (const table of bundle.tables) {
    if (
      !Array.isArray(table.columns) ||
      table.columns.length === 0 ||
      !table.columns.includes("id") ||
      !table.columns.every((column) => typeof column === "string" && SAFE_IDENTIFIER.test(column)) ||
      !Array.isArray(table.rows) ||
      !table.rows.every((row) => typeof row === "string")
    ) {
      throw new Error(`Malformed preservation payload for public.${table.name}`);
    }
  }
  if (
    typeof bundle.capturedAt !== "string" ||
    typeof bundle.source?.database !== "string" ||
    !VALID_ENVIRONMENTS.has(bundle.source?.environment) ||
    bundle.source.attestation !== `hugmeid-environment:${bundle.source.environment}`
  ) {
    throw new Error("Preservation bundle has invalid source provenance");
  }
  const actualChecksum = bundleChecksum(bundle);
  if (bundle.bundleSha256 !== actualChecksum) {
    throw new Error(
      `Preservation bundle checksum mismatch: expected ${bundle.bundleSha256 ?? "missing"}, got ${actualChecksum}`,
    );
  }
}

function parseFlag(name) {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function inspectDatabaseIdentity(client) {
  const { rows } = await client.query(
    `select
       d.datname as database_name,
       pg_catalog.shobj_description(d.oid, 'pg_database') as attestation,
       to_regclass('public.app_environment') is not null as has_environment_sentinel
     from pg_catalog.pg_database d
     where d.datname = current_database()`,
  );
  if (!rows[0]) throw new Error("Could not identify the connected PostgreSQL database");
  let sentinel = null;
  if (rows[0].has_environment_sentinel) {
    const sentinelResult = await client.query(
      `select value from public.app_environment where key = 'database_environment'`,
    );
    sentinel = sentinelResult.rows[0]?.value ?? null;
  }
  return { ...rows[0], sentinel };
}

async function assertDatabaseIdentity(
  client,
  { expectedEnvironment, expectedDatabase, confirmedEnvironment, mutation },
) {
  if (!VALID_ENVIRONMENTS.has(expectedEnvironment)) {
    throw new Error("HUGMEID_DATABASE_ENV must be local, staging, or production");
  }
  if (!expectedDatabase) {
    throw new Error("HUGMEID_EXPECTED_DATABASE is required for preservation operations");
  }
  const identity = await inspectDatabaseIdentity(client);
  if (identity.database_name !== expectedDatabase) {
    throw new Error(
      `Connected database ${identity.database_name} does not match HUGMEID_EXPECTED_DATABASE=${expectedDatabase}`,
    );
  }
  if (identity.sentinel !== expectedEnvironment) {
    throw new Error(
      `Database environment sentinel is ${identity.sentinel ?? "missing"}, expected ${expectedEnvironment}`,
    );
  }
  const expectedAttestation = `hugmeid-environment:${expectedEnvironment}`;
  if (identity.attestation !== expectedAttestation) {
    throw new Error(
      `Database environment attestation is ${identity.attestation ?? "missing"}, expected ${expectedAttestation}`,
    );
  }
  if (mutation) {
    if (confirmedEnvironment !== expectedEnvironment) {
      throw new Error(`Restore requires --confirm-environment=${expectedEnvironment}`);
    }
  } else if (confirmedEnvironment !== expectedEnvironment) {
    throw new Error(`Export requires --confirm-source-environment=${expectedEnvironment}`);
  }
  return identity;
}

async function captureTableRows(client, tableName, projectedColumns) {
  const relation = `public.${quoteIdentifier(tableName)}`;
  const columnResult = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = $1
     order by ordinal_position`,
    [tableName],
  );
  if (columnResult.rowCount === 0) throw new Error(`Missing preserved table public.${tableName}`);
  const availableColumns = columnResult.rows.map((row) => row.column_name);
  const columns = projectedColumns ?? availableColumns;
  const missingColumns = columns.filter((column) => !availableColumns.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(
      `Projection for public.${tableName} contains missing columns: ${missingColumns.join(", ")}`,
    );
  }
  const projection = columns.map(quoteIdentifier).join(", ");
  const rowResult = await client.query(
    `select to_jsonb(projected_row)::text as row_json
     from (
       select ${projection}
       from ${relation}
       order by id::text
     ) projected_row`,
  );
  return {
    name: tableName,
    columns,
    rows: rowResult.rows.map((row) => row.row_json),
  };
}

async function captureTables(client, tableNames, templates) {
  const tables = [];
  for (const tableName of tableNames) {
    const template = templates?.find((table) => table.name === tableName);
    tables.push(await captureTableRows(client, tableName, template?.columns));
  }
  return tables;
}

export async function capturePreservationBundle(
  client,
  {
    expectedEnvironment,
    expectedDatabase,
    confirmedSourceEnvironment,
  } = {},
) {
  if (!VALID_ENVIRONMENTS.has(expectedEnvironment)) {
    throw new Error("HUGMEID_DATABASE_ENV must be local, staging, or production");
  }
  if (!expectedDatabase) {
    throw new Error("HUGMEID_EXPECTED_DATABASE is required for preservation operations");
  }
  await client.query("begin isolation level repeatable read read only");
  try {
    const identity = await assertDatabaseIdentity(client, {
      expectedEnvironment,
      expectedDatabase,
      confirmedEnvironment: confirmedSourceEnvironment,
      mutation: false,
    });
    const tables = await captureTables(client, PRESERVED_TABLES_BY_VERSION[CURRENT_FORMAT_VERSION]);
    await client.query("commit");
    const bundle = {
      formatVersion: CURRENT_FORMAT_VERSION,
      capturedAt: new Date().toISOString(),
      source: {
        database: identity.database_name,
        environment: identity.sentinel,
        attestation: identity.attestation,
      },
      tables,
    };
    return { ...bundle, bundleSha256: bundleChecksum(bundle) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export function preservationManifest(bundle) {
  validateBundle(bundle);
  const tables = bundle.tables.map((table) => {
    const parsedRows = table.rows.map((row) => JSON.parse(row));
    const ids = parsedRows.map((row) => String(row.id ?? ""));
    const createdAt = parsedRows
      .map((row) => row.created_at)
      .filter((value) => typeof value === "string")
      .sort();
    return {
      name: table.name,
      columns: table.columns,
      rowCount: table.rows.length,
      rowsSha256: sha256(table.rows),
      idsSha256: sha256(ids),
      firstCreatedAt: createdAt[0] ?? null,
      lastCreatedAt: createdAt.at(-1) ?? null,
    };
  });
  const assets = (bundle.tables.find((table) => table.name === "assets")?.rows ?? []).map((row) => JSON.parse(row));
  const variants = (bundle.tables.find((table) => table.name === "asset_variants")?.rows ?? []).map((row) => JSON.parse(row));
  const assetObjects = bundle.formatVersion === 1
    ? assets.map((row) => `${row.bucket}\u0000${row.object_path}\u0000${row.checksum}`).sort()
    : [
        ...assets
          .filter((row) => row.purged_at === null)
          .map((row) => `${row.bucket}\u0000${row.object_path}\u0000${row.checksum}`),
        ...variants
          .filter((variant) => assets.some((asset) => asset.id === variant.asset_id && asset.purged_at === null))
          .map((row) => `${row.bucket}\u0000${row.object_path}\u0000${row.checksum}`),
      ].sort();
  return {
    formatVersion: bundle.formatVersion,
    bundleSha256: bundle.bundleSha256,
    capturedAt: bundle.capturedAt,
    source: bundle.source,
    preservedTables: tables,
    assetObjects: {
      rowCount: assetObjects.length,
      referencesSha256: sha256(assetObjects),
    },
  };
}

function comparableManifest(manifest) {
  return {
    formatVersion: manifest.formatVersion,
    bundleSha256: manifest.bundleSha256,
    source: manifest.source,
    preservedTables: manifest.preservedTables,
    assetObjects: manifest.assetObjects,
  };
}

export function comparePreservationManifests(source, destination) {
  const sourceComparable = comparableManifest(source);
  const destinationComparable = comparableManifest(destination);
  if (JSON.stringify(sourceComparable) !== JSON.stringify(destinationComparable)) {
    throw new Error(
      `Preservation manifest mismatch:\nsource=${JSON.stringify(sourceComparable)}\ndestination=${JSON.stringify(destinationComparable)}`,
    );
  }
  return true;
}

export function verifyPreservationBundleManifest(bundle, sourceManifest) {
  const actualManifest = preservationManifest(bundle);
  if (JSON.stringify(actualManifest) !== JSON.stringify(sourceManifest)) {
    throw new Error("Preservation bundle does not match its source manifest");
  }
  return true;
}

async function assertRestoreColumns(client, table) {
  const targetColumns = await client.query(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = $1
     order by ordinal_position`,
    [table.name],
  );
  const targetSet = new Set(targetColumns.rows.map((row) => row.column_name));
  const missing = table.columns.filter((column) => !targetSet.has(column));
  if (missing.length > 0) {
    throw new Error(`Restore target public.${table.name} is missing source columns: ${missing.join(", ")}`);
  }
}

export async function restorePreservationBundle(
  client,
  bundle,
  {
    expectedEnvironment,
    expectedDatabase,
    confirmedEnvironment,
    schemaOwnerRole = "hugmeid_schema_owner",
    publicLoginRole,
    adminLoginRole,
    operatorLoginRole,
    expectedSourceDatabase,
    expectedSourceEnvironment,
    expectedSourceBundleSha256,
  } = {},
) {
  if (!VALID_ENVIRONMENTS.has(expectedEnvironment)) {
    throw new Error("HUGMEID_DATABASE_ENV must be local, staging, or production");
  }
  if (!expectedDatabase) {
    throw new Error("HUGMEID_EXPECTED_DATABASE is required for preservation operations");
  }
  if (expectedEnvironment !== "local") {
    if (!publicLoginRole || !adminLoginRole || !operatorLoginRole) {
      throw new Error(
        "Non-local restore requires HUGMEID_PUBLIC_LOGIN_ROLE, HUGMEID_ADMIN_LOGIN_ROLE, " +
          "and HUGMEID_OPERATOR_LOGIN_ROLE for pre-restore verification",
      );
    }
    if (!expectedSourceDatabase || !expectedSourceEnvironment || !expectedSourceBundleSha256) {
      throw new Error(
        "Non-local restore requires HUGMEID_EXPECTED_SOURCE_DATABASE, HUGMEID_EXPECTED_SOURCE_ENVIRONMENT, and HUGMEID_EXPECTED_SOURCE_BUNDLE_SHA256",
      );
    }
  }
  if (expectedSourceEnvironment && !VALID_ENVIRONMENTS.has(expectedSourceEnvironment)) {
    throw new Error("Expected source environment must be local, staging, or production");
  }
  const expectedManifest = preservationManifest(bundle);
  if (bundle.source.environment !== expectedEnvironment) {
    throw new Error(
      `Cross-environment preservation restore is forbidden: source=${bundle.source.environment}, destination=${expectedEnvironment}`,
    );
  }
  if (expectedSourceDatabase && bundle.source.database !== expectedSourceDatabase) {
    throw new Error(
      `Preservation source database ${bundle.source.database} does not match expected ${expectedSourceDatabase}`,
    );
  }
  if (expectedSourceEnvironment && bundle.source.environment !== expectedSourceEnvironment) {
    throw new Error(
      `Preservation source environment ${bundle.source.environment} does not match expected ${expectedSourceEnvironment}`,
    );
  }
  if (
    expectedSourceBundleSha256 &&
    (!/^[0-9a-f]{64}$/.test(expectedSourceBundleSha256) ||
      bundle.bundleSha256 !== expectedSourceBundleSha256)
  ) {
    throw new Error("Preservation bundle does not match the externally approved source bundle SHA-256");
  }
  const targetIdentity = await assertDatabaseIdentity(client, {
    expectedEnvironment,
    expectedDatabase,
    confirmedEnvironment,
    mutation: true,
  });
  const { verifyDatabase } = await import("./cloudsql-verify.mjs");
  await verifyDatabase({
    client,
    expectedEnvironment,
    expectedDatabase,
    schemaOwnerRole,
    publicLoginRole,
    adminLoginRole,
    operatorLoginRole,
  });
  await client.query("begin");
  try {
    await client.query(`set local role ${quoteIdentifier(schemaOwnerRole)}`);
    await client.query("set local search_path = pg_catalog, public");
    // A v2 preservation bundle retains historical variant rows even after the
    // parent was purged. Only this verified, empty-target restore transaction
    // bypasses the runtime active-parent insert guard.
    await client.query("alter table public.asset_variants disable trigger asset_variants_active_parent");
    for (const table of bundle.tables) {
      if (!PRESERVED_TABLES_BY_VERSION[bundle.formatVersion]?.includes(table.name)) {
        throw new Error(`Bundle contains an unapproved preservation table: ${table.name}`);
      }
      await assertRestoreColumns(client, table);
      const relation = `public.${quoteIdentifier(table.name)}`;
      const countResult = await client.query(`select count(*)::integer as count from ${relation}`);
      if (countResult.rows[0]?.count !== 0) {
        throw new Error(`Restore target ${relation} is not empty`);
      }
      const columnList = table.columns.map(quoteIdentifier).join(", ");
      if (table.rows.length > 0) {
        await client.query(
          `insert into ${relation} (${columnList})
           select ${columnList}
           from pg_catalog.jsonb_populate_recordset(null::${relation}, $1::jsonb)`,
          [JSON.stringify(table.rows.map((rowJson) => JSON.parse(rowJson)))],
        );
      }
    }
    await client.query("alter table public.asset_variants enable trigger asset_variants_active_parent");
    const destinationBundle = {
      formatVersion: bundle.formatVersion,
      capturedAt: bundle.capturedAt,
      source: bundle.source,
      tables: await captureTables(client, PRESERVED_TABLES_BY_VERSION[bundle.formatVersion], bundle.tables),
    };
    destinationBundle.bundleSha256 = bundleChecksum(destinationBundle);
    comparePreservationManifests(expectedManifest, preservationManifest(destinationBundle));
    const ownerResult = await client.query(
      `select count(*)::integer as count
       from public.admin_users
       where role = 'owner'
         and is_active = true
         and deleted_at is null`,
    );
    if ((ownerResult.rows[0]?.count ?? 0) < 1) {
      throw new Error("Restore requires at least one active, non-deleted owner");
    }
    await client.query("commit");
    return {
      ...preservationManifest(destinationBundle),
      restoredAt: new Date().toISOString(),
      destination: {
        database: targetIdentity.database_name,
        environment: expectedEnvironment,
      },
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function writeSensitiveJson(path, value) {
  const outputPath = resolve(path);
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  chmodSync(outputPath, 0o600);
  return outputPath;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

async function main() {
  const command = process.argv[2];
  const expectedEnvironment = process.env.HUGMEID_DATABASE_ENV;
  const expectedDatabase = process.env.HUGMEID_EXPECTED_DATABASE;

  if (command === "compare") {
    const sourcePath = parseFlag("source");
    const destinationPath = parseFlag("destination");
    if (!sourcePath || !destinationPath) {
      throw new Error("compare requires --source=<manifest.json> and --destination=<manifest.json>");
    }
    comparePreservationManifests(readJson(sourcePath), readJson(destinationPath));
    process.stdout.write("Preservation manifests match.\n");
    return;
  }

  if (!VALID_ENVIRONMENTS.has(expectedEnvironment)) {
    throw new Error("HUGMEID_DATABASE_ENV must be local, staging, or production");
  }
  if (!expectedDatabase) {
    throw new Error("HUGMEID_EXPECTED_DATABASE is required for preservation operations");
  }

  const client = new Client({ application_name: `hugmeid-cloudsql-preservation-${command ?? "unknown"}` });
  await client.connect();
  try {
    if (command === "export") {
      const bundlePath = parseFlag("bundle");
      const manifestPath = parseFlag("manifest");
      if (!bundlePath || !manifestPath) {
        throw new Error("export requires --bundle=<sensitive.json> and --manifest=<manifest.json>");
      }
      const bundle = await capturePreservationBundle(client, {
        expectedEnvironment,
        expectedDatabase,
        confirmedSourceEnvironment: parseFlag("confirm-source-environment"),
      });
      const writtenBundle = writeSensitiveJson(bundlePath, bundle);
      const writtenManifest = writeSensitiveJson(manifestPath, preservationManifest(bundle));
      process.stdout.write(`Wrote sensitive bundle ${writtenBundle} (mode 0600)\n`);
      process.stdout.write(`Wrote preservation manifest ${writtenManifest} (mode 0600)\n`);
      process.stdout.write(`Record source bundle SHA-256 externally: ${bundle.bundleSha256}\n`);
      return;
    }
    if (command === "restore") {
      const bundlePath = parseFlag("bundle");
      const sourceManifestPath = parseFlag("source-manifest");
      const manifestPath = parseFlag("manifest");
      if (!bundlePath || !sourceManifestPath || !manifestPath) {
        throw new Error(
          "restore requires --bundle=<sensitive.json>, --source-manifest=<source.json>, and --manifest=<destination.json>",
        );
      }
      const bundle = readJson(bundlePath);
      verifyPreservationBundleManifest(bundle, readJson(sourceManifestPath));
      const manifest = await restorePreservationBundle(client, bundle, {
        expectedEnvironment,
        expectedDatabase,
        confirmedEnvironment: parseFlag("confirm-environment"),
        publicLoginRole: process.env.HUGMEID_PUBLIC_LOGIN_ROLE,
        adminLoginRole: process.env.HUGMEID_ADMIN_LOGIN_ROLE,
        operatorLoginRole: process.env.HUGMEID_OPERATOR_LOGIN_ROLE,
        expectedSourceDatabase: process.env.HUGMEID_EXPECTED_SOURCE_DATABASE,
        expectedSourceEnvironment: process.env.HUGMEID_EXPECTED_SOURCE_ENVIRONMENT,
        expectedSourceBundleSha256: process.env.HUGMEID_EXPECTED_SOURCE_BUNDLE_SHA256,
      });
      const writtenManifest = writeSensitiveJson(manifestPath, manifest);
      process.stdout.write(`Restore verified; wrote ${writtenManifest} (mode 0600)\n`);
      return;
    }
    throw new Error("Usage: cloudsql-preservation.mjs <export|restore|compare> [flags]");
  } finally {
    await client.end();
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `Cloud SQL preservation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
