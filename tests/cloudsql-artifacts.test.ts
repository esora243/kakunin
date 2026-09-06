import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const sqlNames = (directory: string) =>
  readdirSync(join(process.cwd(), directory))
    .filter((name) => name.endsWith(".sql"))
    .sort();

const BASELINE = "cloudsql/baseline/20260730000000_schema.sql";
const REQUIRED_LOOKUPS = "cloudsql/seeds/20260730000001_required_lookups.sql";
const RUNTIME_ACCESS = "cloudsql/migrations/20260730000002_runtime_access.sql";
const ASSET_VARIANTS = "cloudsql/migrations/20260801000000_asset_variants.sql";
const NATIONAL_PUBLIC_MEDICAL_UNIVERSITIES =
  "cloudsql/seeds/20260813000000_national_public_medical_universities.sql";
const ADMIN_RATE_LIMIT_ACCESS = "cloudsql/migrations/20260821000000_admin_rate_limit_access.sql";
const INQUIRY_IDEMPOTENCY = "cloudsql/migrations/20260821000100_inquiry_idempotency.sql";
const JOB_APPLY_READINESS = "cloudsql/migrations/20260825000100_job_apply_readiness.sql";
const TIMETABLE_SCHEDULE_INTEGRITY = "cloudsql/migrations/20260825000200_timetable_schedule_integrity.sql";
const CACHE_INVALIDATION_OUTBOX = "cloudsql/migrations/20260825000300_public_cache_invalidation_outbox.sql";

test("Cloud SQL has one collision-free baseline-first artifact sequence", () => {
  const artifacts = [
    ...sqlNames("cloudsql/baseline"),
    ...sqlNames("cloudsql/migrations"),
    ...sqlNames("cloudsql/seeds"),
  ].sort();
  assert.deepEqual(artifacts, [
    "20260730000000_schema.sql",
    "20260730000001_required_lookups.sql",
    "20260730000002_runtime_access.sql",
    "20260801000000_asset_variants.sql",
    "20260813000000_national_public_medical_universities.sql",
    "20260821000000_admin_rate_limit_access.sql",
    "20260821000100_inquiry_idempotency.sql",
    "20260825000100_job_apply_readiness.sql",
    "20260825000200_timetable_schedule_integrity.sql",
    "20260825000300_public_cache_invalidation_outbox.sql",
  ]);

  const versions = artifacts.map((name) => name.slice(0, 14));
  assert.equal(new Set(versions).size, versions.length, "active Cloud SQL artifact versions must be unique");
  for (const name of artifacts) assert.match(name, /^[0-9]{14}_[a-z0-9_]+\.sql$/);
});

test("published jobs require a job-specific application URL without validating legacy rows", () => {
  const sql = read(JOB_APPLY_READINESS);
  const runbook = read("docs/fallback-hardening-release.md");
  assert.match(sql, /not is_active[\s\S]*published_at is null[\s\S]*apply_url is not null[\s\S]*apply_url ~\*/i);
  assert.match(sql, /\[a-z0-9-\]\{0,61\}/i);
  assert.match(sql, /6553\[0-5\]/i);
  assert.match(sql, /not valid/i);
  assert.doesNotMatch(sql, /validate constraint/i);
  assert.match(runbook, /Do not assign a shared fallback URL/);
  assert.match(runbook, /published_at is not null[\s\S]*and not \([\s\S]*apply_url is not null[\s\S]*apply_url ~\*/i);
});

test("timetable schedule shape blocks new malformed and seventh-period rows", () => {
  const sql = read(TIMETABLE_SCHEDULE_INTEGRITY);
  assert.match(sql, /not is_active\s+or \(/);
  assert.match(sql, /jsonb_typeof\(schedule -> 'day'\) = 'string'/);
  assert.match(sql, /schedule ->> 'day' in \('月', '火', '水', '木', '金'\)/);
  assert.match(sql, /schedule ->> 'period' ~ '\^\[1-6\]\$'/);
  assert.match(sql, /not valid/i);
  assert.doesNotMatch(sql, /validate constraint/i);
  const runbook = read("docs/fallback-hardening-release.md");
  assert.match(runbook, /from public\.syllabus_class_entries\s+where is_active\s+and not \(/);
});

test("cache invalidation outbox durably retains unresolved jobs", () => {
  const sql = read(CACHE_INVALIDATION_OUTBOX);
  assert.match(sql, /public_cache_invalidation_jobs/);
  assert.match(sql, /status in \('pending', 'complete'\)/);
  assert.match(sql, /attempt_count integer not null default 0/);
  assert.match(sql, /last_error text/);
  assert.doesNotMatch(sql, /expires_at|delete from/i);
  assert.match(read("docs/fallback-hardening-release.md"), /existing maximum five-minute TTL/);
});

test("inquiry idempotency migration is additive and scoped per user", () => {
  const sql = read(INQUIRY_IDEMPOTENCY);
  assert.match(sql, /add column idempotency_key uuid/i);
  assert.match(sql, /add column request_fingerprint text/i);
  assert.match(sql, /unique index inquiries_user_idempotency_key_uidx/i);
  assert.match(sql, /\(user_id, idempotency_key\)/i);
  assert.doesNotMatch(sql, /add column (?:idempotency_key|request_fingerprint)[^,;]*not null/i);
});

test("admin runtime can use the shared rate-limit table", () => {
  const sql = read(ADMIN_RATE_LIMIT_ACCESS);
  assert.match(sql, /grant select, insert, update, delete on public\.rate_limit_buckets to hugmeid_admin_runtime/i);
});

test("national/public medical university seed is additive and preserves the existing Hamamatsu row", () => {
  const sql = read(NATIONAL_PUBLIC_MEDICAL_UNIVERSITIES);
  assert.match(sql, /insert into universities/);
  assert.doesNotMatch(sql, /浜松医科大学/);
  assert.doesNotMatch(sql, /delete from universities|update universities|on conflict/i);
});

test("release baseline is a strict final schema with a checksum registry", () => {
  const sql = read(BASELINE);
  for (const table of [
    "schema_migrations",
    "users",
    "app_environment",
    "rate_limit_buckets",
    "jobs",
    "activity_kinds",
    "activities",
    "content_categories",
    "contents",
    "job_bookmarks",
    "activity_bookmarks",
    "content_bookmarks",
    "inquiries",
    "syllabus_pages",
    "syllabus_class_entries",
    "user_timetable_entries",
    "user_class_memos",
    "user_class_tags",
    "user_notification_settings",
    "admin_users",
    "admin_audit_logs",
    "assets",
    "content_versions",
    "user_legal_consents",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE public\\.${table}`));
  }

  assert.match(sql, /checksum_sha256 text NOT NULL/);
  assert.match(sql, /applied_at timestamp with time zone DEFAULT clock_timestamp\(\) NOT NULL/);
  assert.match(sql, /applied_by text DEFAULT CURRENT_USER NOT NULL/);
  assert.match(sql, /admin_users_deleted_must_be_inactive/);
  assert.match(sql, /purged_at timestamp with time zone/);
  assert.match(sql, /first_published_at timestamp with time zone/);
  assert.match(sql, /user_legal_consents_user_id_version_key UNIQUE \(user_id, version\)/);

  assert.doesNotMatch(sql, /CREATE TABLE public\.bookmarks\b/);
  for (const removedColumn of ["author_or_source", "source_name", "source_url", "source_last_modified_at", "synced_at"]) {
    const contentsDefinition = sql.slice(
      sql.indexOf("CREATE TABLE public.contents"),
      sql.indexOf("CREATE TABLE public.employment_types"),
    );
    assert.doesNotMatch(contentsDefinition, new RegExp(`\\b${removedColumn}\\b`));
  }
  assert.doesNotMatch(sql, /create role|alter role|grant .* to hugmeid_/i);
  assert.doesNotMatch(sql, /^\\/m);
});

test("cluster bootstrap creates NOLOGIN capability roles with no elevated attributes", () => {
  const sql = read("cloudsql/ops/bootstrap_roles.sql");
  const executableSql = sql.replace(/^\s*--.*$/gm, "");
  for (const role of ["hugmeid_schema_owner", "hugmeid_public_runtime", "hugmeid_admin_runtime"]) {
    assert.match(sql, new RegExp(`create role ${role}`));
  }
  for (const attribute of [
    "rolcanlogin",
    "rolsuper",
    "rolcreatedb",
    "rolcreaterole",
    "rolreplication",
    "rolbypassrls",
    "rolinherit",
  ]) {
    assert.match(sql, new RegExp(attribute));
  }
  assert.match(sql, /refusing to repair privileged flags automatically/);
  assert.match(sql, /pg_auth_members/);
  assert.match(sql, /aclexplode/);
  assert.match(sql, /owned_objects/);
  assert.match(sql, /pg_default_acl/);
  assert.doesNotMatch(executableSql, /\balter role\b[\s\S]*\bnosuperuser\b/i);
  assert.doesNotMatch(sql, /password/i);
  assert.doesNotMatch(executableSql, /cloudsqlsuperuser/i);
});

test("database bootstrap gives pgcrypto a durable owner and explicit safe migration edge", () => {
  const sql = read("cloudsql/ops/bootstrap_database.sql");
  assert.match(sql, /alter database %I owner to hugmeid_schema_owner/);
  assert.match(sql, /set local role hugmeid_schema_owner/);
  assert.match(sql, /create extension if not exists pgcrypto with schema public/);
  assert.match(sql, /database\.datdba/);
  assert.match(sql, /extension\.extowner/);
  assert.match(sql, /actual_database_owner is distinct from 'hugmeid_schema_owner'/);
  assert.match(sql, /actual_extension_owner is distinct from 'hugmeid_schema_owner'/);
  assert.match(sql, /to session_user with inherit true/);
  assert.match(sql, /to session_user with set true/);
  assert.match(sql, /to session_user with admin false/);
});

test("database environment attestation fails nonzero for missing or invalid labels", () => {
  const sql = read("cloudsql/ops/attest_database_environment.sql");
  const executableSql = sql.replace(/^\s*--.*$/gm, "");
  assert.match(sql, /\\set ON_ERROR_STOP on/);
  assert.match(sql, /raise exception 'target_environment is required'/);
  assert.match(sql, /raise exception 'target_environment must be staging or production'/);
  assert.doesNotMatch(executableSql, /\\quit/);
});

test("runtime binding validates safe inherited principals without forbidden Cloud SQL role toggles", () => {
  const sql = read("cloudsql/ops/bind_runtime_roles.sql");
  const executableSql = sql.replace(/^\s*--.*$/gm, "");
  assert.match(sql, /rolcanlogin\s+and rolinherit/);
  assert.match(sql, /and not rolsuper/);
  assert.match(sql, /and not rolreplication/);
  assert.match(sql, /and not rolbypassrls/);
  assert.match(sql, /membership\.admin_option/);
  assert.match(sql, /membership\.inherit_option/);
  assert.match(sql, /membership\.set_option/);
  assert.match(sql, /assert_runtime_binding/);
  assert.match(sql, /\\set ON_ERROR_STOP on/);
  assert.doesNotMatch(executableSql, /\\quit/);
  assert.doesNotMatch(executableSql, /\balter role\b[\s\S]*\bnosuperuser\b/i);
  assert.match(sql, /grant hugmeid_public_runtime to :"public_login" with inherit true/);
  assert.match(sql, /grant hugmeid_public_runtime to :"public_login" with set true/);
  assert.match(sql, /grant hugmeid_public_runtime to :"public_login" with admin false/);
  assert.match(sql, /grant hugmeid_admin_runtime to :"admin_login" with inherit true/);
  assert.match(sql, /grant hugmeid_admin_runtime to :"admin_login" with set true/);
  assert.match(sql, /grant hugmeid_admin_runtime to :"admin_login" with admin false/);
});

test("runtime access is role-based, exact, append-only for consent, and excludes DDL", () => {
  const sql = read(RUNTIME_ACCESS);
  assert.match(sql, /revoke create on schema public from public/);
  assert.match(sql, /grant usage on schema public to hugmeid_public_runtime, hugmeid_admin_runtime/);
  assert.match(sql, /grant select, insert on public\.user_legal_consents to hugmeid_public_runtime/);
  assert.match(sql, /grant select, insert on\s+public\.admin_audit_logs,\s+public\.content_versions/);
  assert.doesNotMatch(sql, /grant[^;]*(?:update|delete)[^;]*user_legal_consents/i);
  assert.doesNotMatch(sql, /grant create/i);
  assert.doesNotMatch(sql, /grant .* on all tables/i);
});

test("asset variants are immutable, namespace-isolated, and narrowly granted", () => {
  const sql = read(ASSET_VARIANTS);
  assert.match(sql, /create table public\.asset_variants/);
  assert.match(sql, /references public\.assets\(id, bucket\) on delete restrict/);
  assert.match(sql, /unique \(asset_id, content_type, width\)/);
  assert.match(sql, /content_type in \('image\/webp', 'image\/avif'\)/);
  assert.match(sql, /assets_object_path_not_variant/);
  assert.match(sql, /assets_public_url_matches_object_path/);
  assert.match(sql, /asset_variants_active_parent/);
  assert.match(sql, /grant select, insert on public\.asset_variants to hugmeid_admin_runtime/);
  assert.doesNotMatch(sql, /grant[^;]*(?:update|delete)[^;]*asset_variants/i);
});

test("required lookup seed is one-time input for every app lookup domain", () => {
  const sql = read(REQUIRED_LOOKUPS);
  for (const table of [
    "activity_kinds",
    "content_categories",
    "universities",
    "clubs",
    "specialties",
    "job_categories",
    "employment_types",
  ]) {
    assert.match(sql, new RegExp(`insert into ${table}`));
  }
  assert.doesNotMatch(sql, /on conflict/i, "registered baseline seed must not silently mutate existing rows");
  assert.doesNotMatch(sql, /\bbegin\b|\bcommit\b/i, "the migration runner owns transaction boundaries");
});

test("pre-release SQL history is retained but excluded from the executable path", () => {
  const historyRoot = "cloudsql/history/pre_release";
  assert.ok(existsSync(join(process.cwd(), historyRoot, "README.md")));
  assert.ok(existsSync(join(process.cwd(), historyRoot, "checksums.sha256")));
  assert.ok(
    existsSync(
      join(process.cwd(), historyRoot, "migrations/20260719000000_remove_legacy_bookmarks.sql"),
    ),
  );
  assert.match(read(`${historyRoot}/README.md`), /executable bootstrap path/);
  assert.match(read(`${historyRoot}/checksums.sha256`), /^[0-9a-f]{64}\s{2}cloudsql\/history\/pre_release\//m);
});

test("migration runner and CI enforce replay, checksum, rollback, and unmanaged-DB guards", () => {
  const runner = read("scripts/cloudsql-migrate.mjs");
  const integration = read("scripts/cloudsql-integration-test.mjs");
  const verifier = read("scripts/cloudsql-verify.mjs");
  const schemaState = read("scripts/cloudsql-schema-state.mjs");
  const prelock = read("cloudsql/ops/prelock_database_connect.sql");
  const legacyConnect = read("cloudsql/ops/restrict_legacy_database_connect.sql");
  const expectedSchema = JSON.parse(read("cloudsql/expected-schema-state.json")) as {
    formatVersion: number;
    checksumSha256: string;
  };
  const workflow = read(".github/workflows/ci.yml");

  assert.match(runner, /Duplicate Cloud SQL artifact version/);
  assert.match(runner, /Checksum or identity mismatch/);
  assert.match(runner, /non-empty unmanaged database/);
  assert.match(runner, /pg_advisory_lock/);
  assert.match(runner, /--confirm-environment/);
  assert.match(runner, /HUGMEID_EXPECTED_DATABASE/);
  assert.match(runner, /membership\.inherit_option/);
  assert.match(runner, /membership\.set_option/);
  assert.match(runner, /pgcrypto must be owned by/);
  assert.match(verifier, /intended_direct_membership/);
  assert.match(verifier, /membership_options_safe/);
  assert.match(verifier, /verifyDatabaseConnectIsolation/);
  assert.match(verifier, /HUGMEID_OPERATOR_LOGIN_ROLE/);
  assert.match(verifier, /cross-database login access/);
  assert.match(read("cloudsql/ops/bind_runtime_roles.sql"), /revoke connect, temporary on database/);
  assert.match(read("cloudsql/ops/bind_runtime_roles.sql"), /target_database/);
  assert.match(read("cloudsql/ops/bind_runtime_roles.sql"), /operator_login/);
  assert.match(read("cloudsql/ops/bind_runtime_roles.sql"), /effective_connect_set_is_exact/);
  assert.match(prelock, /effective_connect_set_is_exact/);
  assert.match(prelock, /session_is_bootstrap/);
  assert.match(legacyConnect, /database_owner_role/);
  assert.match(legacyConnect, /effective_connect_set_is_exact/);
  assert.match(legacyConnect, /:'database_owner_role' = 'cloudsqlsuperuser'/);
  for (const providerRole of [
    "cloudsqlsuperuser",
    "cloudsqlagent",
    "cloudsqlimportexport",
  ]) {
    assert.match(legacyConnect, new RegExp(`'${providerRole}'`));
  }
  assert.doesNotMatch(legacyConnect, /rolname\\s+like\\s+'cloudsql%'/i);
  assert.match(integration, /providerOwnedLegacyRestriction/);
  assert.match(schemaState, /grantee_role\.rolname = 'cloudsqlsuperuser'/);
  assert.match(schemaState, /object_acl\.grantee <> 0/);
  assert.match(schemaState, /grantor_role\.rolname = 'pg_database_owner'/);
  assert.match(schemaState, /object_acl\.object_kind = 'schema'/);
  assert.match(schemaState, /object_acl\.privilege_type in \('USAGE', 'CREATE'\)/);
  assert.match(integration, /verifyChecksumGuard/);
  assert.match(integration, /verifyFailedMigrationRollback/);
  assert.match(integration, /verifyUnmanagedDatabaseGuard/);
  assert.match(integration, /verifyTargetAttestationGuard/);
  assert.match(integration, /verifyPrincipalPrivilegeGuards/);
  assert.match(integration, /verifyCapabilityRolePrivilegeGuards/);
  assert.match(integration, /verifyPreservationRehearsal/);
  assert.match(verifier, /captureSchemaState/);
  assert.match(verifier, /Full schema-state mismatch/);
  assert.equal(expectedSchema.formatVersion, 1);
  assert.match(expectedSchema.checksumSha256, /^[0-9a-f]{64}$/);
  assert.match(workflow, /Verify Cloud SQL baseline/);
  assert.match(workflow, /npm run test:cloudsql/);
});

test("forward migrations may update runtime grants but enforce the new policy after apply", () => {
  const runner = read("scripts/cloudsql-migrate.mjs");
  assert.match(runner, /const hasPendingArtifacts = artifacts\.some/);
  assert.match(runner, /verifyOnly \|\| !hasPendingArtifacts/);
  assert.match(runner, /if \(result\.applied\.length > 0\)[\s\S]*inspectSchemaOwner\(client, schemaOwnerRole, true, true\)/);
});

test("preservation tooling is fail-closed and rehearsed against a separate database", () => {
  const preservation = read("scripts/cloudsql-preservation.mjs");
  const runbook = read("docs/cloudsql-rebaseline.md");
  const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

  assert.deepEqual(packageJson.scripts["db:preserve"], "node scripts/cloudsql-preservation.mjs");
  assert.match(
    preservation,
    /source\.attestation !== `hugmeid-environment:\$\{bundle\.source\.environment\}`/,
  );
  for (const table of ["admin_users", "admin_audit_logs", "assets", "asset_variants"]) {
    assert.match(preservation, new RegExp(`"${table}"`));
  }
  assert.match(preservation, /begin isolation level repeatable read read only/);
  assert.match(preservation, /Restore target .* is not empty/);
  assert.match(preservation, /Preservation manifest mismatch/);
  assert.match(preservation, /mode: 0o600/);
  assert.match(preservation, /--confirm-environment/);
  assert.match(preservation, /HUGMEID_EXPECTED_SOURCE_DATABASE/);
  assert.match(preservation, /HUGMEID_EXPECTED_SOURCE_ENVIRONMENT/);
  assert.match(preservation, /HUGMEID_EXPECTED_SOURCE_BUNDLE_SHA256/);
  assert.match(preservation, /HUGMEID_OPERATOR_LOGIN_ROLE/);
  assert.match(preservation, /Cross-environment preservation restore is forbidden/);
  assert.match(preservation, /HUGMEID_EXPECTED_DATABASE is required for preservation operations/);
  assert.match(preservation, /identity\.sentinel \?\? "missing"/);
  assert.match(preservation, /identity\.attestation \?\? "missing"/);
  assert.doesNotMatch(preservation, /identity\.sentinel \?\? "local"/);
  assert.doesNotMatch(preservation, /HUGMEID_DATABASE_ENV \?\? "local"/);
  assert.match(runbook, /Never commit it/);
  assert.match(runbook, /npm run db:preserve -- compare/);
});
