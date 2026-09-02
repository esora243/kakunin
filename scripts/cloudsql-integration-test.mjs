import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";
import { migrate } from "./cloudsql-migrate.mjs";
import {
  bundleChecksum,
  capturePreservationBundle,
  comparePreservationManifests,
  preservationManifest,
  restorePreservationBundle,
  verifyPreservationBundleManifest,
} from "./cloudsql-preservation.mjs";
import { captureSchemaState } from "./cloudsql-schema-state.mjs";
import { verifyDatabase, verifyDatabaseConnectIsolation } from "./cloudsql-verify.mjs";

const { Client } = pg;
const TEST_PUBLIC_ROLE = "hugmeid_ci_public";
const TEST_ADMIN_ROLE = "hugmeid_ci_admin";
const TEST_PUBLIC_PASSWORD = "hugmeid-ci-public-only";
const TEST_ADMIN_PASSWORD = "hugmeid-ci-admin-only";
const TEST_UNEXPECTED_CONNECT_ROLE = "hugmeid_ci_unexpected_connect";
const TEST_PRELOCK_BOOTSTRAP_ROLE = "hugmeid_ci_prelock_bootstrap";
const TEST_PRELOCK_BOOTSTRAP_PASSWORD = "hugmeid-ci-prelock-bootstrap-only";
const repositoryRoot = new URL("..", import.meta.url).pathname;

function adminConfig(database = process.env.PGDATABASE) {
  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT ?? 5432),
    database,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    application_name: "hugmeid-cloudsql-integration-test",
  };
}

function runtimeConfig(user, password) {
  return { ...adminConfig(), user, password };
}

function runPsqlScript(fileName, databaseName, variables, connectionEnv = {}) {
  const psqlBinary = process.env.PSQL_BIN ?? "psql";
  const variableArguments = Object.entries(variables).flatMap(([name, value]) => [
    "-v",
    `${name}=${value}`,
  ]);
  const result = spawnSync(
    psqlBinary,
    [
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      ...variableArguments,
      "-f",
      join(repositoryRoot, "cloudsql/ops", fileName),
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: { ...process.env, PGDATABASE: databaseName, ...connectionEnv },
    },
  );
  return result;
}

function runRuntimeBindingScript(databaseName, overrides = {}) {
  return runPsqlScript("bind_runtime_roles.sql", databaseName, {
    target_database: databaseName,
    public_login: TEST_PUBLIC_ROLE,
    admin_login: TEST_ADMIN_ROLE,
    operator_login: process.env.PGUSER,
    ...overrides,
  });
}

async function expectFailure(action, expectedMessage) {
  let failure;
  try {
    await action();
  } catch (error) {
    failure = error;
  }
  assert(failure, `Expected failure containing: ${expectedMessage}`);
  assert.match(failure instanceof Error ? failure.message : String(failure), expectedMessage);
}

async function verifyDatabaseConnectIsolationGuards(client) {
  const databaseResult = await client.query(
    "select current_database() as database_name, current_user as operator_login",
  );
  const databaseName = databaseResult.rows[0]?.database_name;
  const operatorLogin = databaseResult.rows[0]?.operator_login;
  assert.match(databaseName, /(?:_test|_ci)$/);
  assert(operatorLogin);
  const crossEnvironmentRole = "hugmeid_ci_other_environment";

  await client.query(`
    begin;
    set local role hugmeid_schema_owner;
    revoke connect, temporary on database ${databaseName} from public;
    grant connect on database ${databaseName}
      to ${TEST_PUBLIC_ROLE}, ${TEST_ADMIN_ROLE}, ${operatorLogin};
    reset role;
    create role ${crossEnvironmentRole} login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
    grant hugmeid_public_runtime to ${crossEnvironmentRole};
    commit;
  `);
  try {
    await verifyDatabaseConnectIsolation(client, {
      expectedDatabase: databaseName,
      publicLoginRole: TEST_PUBLIC_ROLE,
      adminLoginRole: TEST_ADMIN_ROLE,
      operatorLoginRole: operatorLogin,
    });
    const deniedResult = await client.query(
      "select has_database_privilege($1, $2, 'CONNECT') as can_connect",
      [crossEnvironmentRole, databaseName],
    );
    assert.equal(deniedResult.rows[0]?.can_connect, false);

    await client.query(`
      grant ${TEST_PUBLIC_ROLE} to ${crossEnvironmentRole};
    `);
    await expectFailure(
      () =>
        verifyDatabaseConnectIsolation(client, {
          expectedDatabase: databaseName,
          publicLoginRole: TEST_PUBLIC_ROLE,
          adminLoginRole: TEST_ADMIN_ROLE,
          operatorLoginRole: operatorLogin,
        }),
      /cross-database login access/,
    );
    await client.query(`
      revoke ${TEST_PUBLIC_ROLE} from ${crossEnvironmentRole};
      set role hugmeid_schema_owner;
      grant temporary on database ${databaseName} to public;
      reset role;
    `);
    await expectFailure(
      () =>
        verifyDatabaseConnectIsolation(client, {
          expectedDatabase: databaseName,
          publicLoginRole: TEST_PUBLIC_ROLE,
          adminLoginRole: TEST_ADMIN_ROLE,
          operatorLoginRole: operatorLogin,
        }),
      /PUBLIC retains database privileges/,
    );
  } finally {
    await client.query(`
      set role hugmeid_schema_owner;
      revoke connect on database ${databaseName}
        from ${crossEnvironmentRole}, ${TEST_PUBLIC_ROLE}, ${TEST_ADMIN_ROLE}, ${operatorLogin};
      grant connect, temporary on database ${databaseName} to public;
      reset role;
      revoke ${TEST_PUBLIC_ROLE} from ${crossEnvironmentRole};
      revoke hugmeid_public_runtime from ${crossEnvironmentRole};
      drop role ${crossEnvironmentRole};
    `);
  }
}

async function resetTestDatabase(client) {
  const databaseResult = await client.query("select current_database() as name");
  const databaseName = databaseResult.rows[0]?.name;
  assert.match(databaseName, /(?:_test|_ci)$/, "Destructive DB integration test requires a *_test or *_ci database");
  assert.equal(
    process.env.HUGMEID_DB_TEST_ALLOW_DESTRUCTIVE,
    "1",
    "Set HUGMEID_DB_TEST_ALLOW_DESTRUCTIVE=1 for the dedicated test database",
  );

  await client.query("drop schema if exists public cascade");
  await client.query("create schema public authorization pg_database_owner");
  await client.query("grant usage, create on schema public to public");

  await client.query(readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_roles.sql"), "utf8"));
  await client.query(readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"));
  await client.query(`
    set role hugmeid_schema_owner;
    do $$
    begin
      if exists (select 1 from pg_catalog.pg_roles where rolname = '${TEST_PUBLIC_ROLE}') then
        execute 'revoke connect on database ${databaseName} from ${TEST_PUBLIC_ROLE}';
      end if;
      if exists (select 1 from pg_catalog.pg_roles where rolname = '${TEST_ADMIN_ROLE}') then
        execute 'revoke connect on database ${databaseName} from ${TEST_ADMIN_ROLE}';
      end if;
      if exists (
        select 1 from pg_catalog.pg_roles where rolname = '${TEST_PRELOCK_BOOTSTRAP_ROLE}'
      ) then
        execute 'revoke connect on database ${databaseName} from ${TEST_PRELOCK_BOOTSTRAP_ROLE}';
      end if;
    end;
    $$;
    reset role;
    drop role if exists ${TEST_PRELOCK_BOOTSTRAP_ROLE};
    create role ${TEST_PRELOCK_BOOTSTRAP_ROLE} login
      password '${TEST_PRELOCK_BOOTSTRAP_PASSWORD}'
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
    grant hugmeid_schema_owner to ${TEST_PRELOCK_BOOTSTRAP_ROLE}
      with admin false, inherit true, set true;
  `);
  const prelockVariables = {
    target_database: databaseName,
    bootstrap_login: TEST_PRELOCK_BOOTSTRAP_ROLE,
    operator_login: process.env.PGUSER,
  };
  const prelockConnection = {
    PGUSER: TEST_PRELOCK_BOOTSTRAP_ROLE,
    PGPASSWORD: TEST_PRELOCK_BOOTSTRAP_PASSWORD,
  };
  const firstPrelock = runPsqlScript(
    "prelock_database_connect.sql",
    databaseName,
    prelockVariables,
    prelockConnection,
  );
  assert.equal(firstPrelock.status, 0, firstPrelock.stderr);
  const secondPrelock = runPsqlScript(
    "prelock_database_connect.sql",
    databaseName,
    prelockVariables,
    prelockConnection,
  );
  assert.equal(secondPrelock.status, 0, secondPrelock.stderr);
  const rejectedPrelock = runPsqlScript(
    "prelock_database_connect.sql",
    databaseName,
    { ...prelockVariables, target_database: `${databaseName}_wrong` },
    prelockConnection,
  );
  assert.notEqual(rejectedPrelock.status, 0, "Prelock target mismatch must fail");
  await client.query(`
    set role hugmeid_schema_owner;
    revoke connect on database ${databaseName} from ${TEST_PRELOCK_BOOTSTRAP_ROLE};
    reset role;
    revoke hugmeid_schema_owner from ${TEST_PRELOCK_BOOTSTRAP_ROLE};
    drop role ${TEST_PRELOCK_BOOTSTRAP_ROLE};
  `);

  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_catalog.pg_roles where rolname = '${TEST_PUBLIC_ROLE}') then
        create role ${TEST_PUBLIC_ROLE} login password '${TEST_PUBLIC_PASSWORD}';
      end if;
      if not exists (select 1 from pg_catalog.pg_roles where rolname = '${TEST_ADMIN_ROLE}') then
        create role ${TEST_ADMIN_ROLE} login password '${TEST_ADMIN_PASSWORD}';
      end if;
    end;
    $$;
    alter role ${TEST_PUBLIC_ROLE}
      login password '${TEST_PUBLIC_PASSWORD}'
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
    alter role ${TEST_ADMIN_ROLE}
      login password '${TEST_ADMIN_PASSWORD}'
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
  `);

  const legacyVariables = {
    target_database: databaseName,
    database_owner_role: "hugmeid_schema_owner",
    public_login: TEST_PUBLIC_ROLE,
    admin_login: TEST_ADMIN_ROLE,
    operator_login: process.env.PGUSER,
  };
  const firstLegacyRestriction = runPsqlScript(
    "restrict_legacy_database_connect.sql",
    databaseName,
    legacyVariables,
  );
  assert.equal(firstLegacyRestriction.status, 0, firstLegacyRestriction.stderr);
  const secondLegacyRestriction = runPsqlScript(
    "restrict_legacy_database_connect.sql",
    databaseName,
    legacyVariables,
  );
  assert.equal(secondLegacyRestriction.status, 0, secondLegacyRestriction.stderr);
  const rejectedLegacyRestriction = runPsqlScript(
    "restrict_legacy_database_connect.sql",
    databaseName,
    { ...legacyVariables, database_owner_role: "postgres" },
  );
  assert.notEqual(rejectedLegacyRestriction.status, 0, "Legacy owner mismatch must fail");

  const cloudSqlProviderRoles = [
    "cloudsqlsuperuser",
    "cloudsqlagent",
    "cloudsqlimportexport",
  ];
  const providerRoleState = await client.query(
    `select rolname
     from pg_catalog.pg_roles
     where rolname = any($1::text[])
     order by rolname`,
    [cloudSqlProviderRoles],
  );
  assert(
    providerRoleState.rows.length === 0 ||
      providerRoleState.rows.length === cloudSqlProviderRoles.length,
    "Cloud SQL provider-role simulation requires either zero or all reviewed roles",
  );
  const createdProviderRoles = providerRoleState.rows.length === 0;
  if (createdProviderRoles) {
    await client.query(`
      create role cloudsqlsuperuser login
        nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
      create role cloudsqlagent login
        nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
      create role cloudsqlimportexport login
        nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
      grant cloudsqlsuperuser to cloudsqlagent, cloudsqlimportexport
        with admin false, inherit true, set true;
    `);
    try {
      await client.query(`alter database ${databaseName} owner to cloudsqlsuperuser`);
      const providerOwnedLegacyRestriction = runPsqlScript(
        "restrict_legacy_database_connect.sql",
        databaseName,
        {
          ...legacyVariables,
          database_owner_role: "cloudsqlsuperuser",
        },
      );
      assert.equal(
        providerOwnedLegacyRestriction.status,
        0,
        providerOwnedLegacyRestriction.stderr,
      );
    } finally {
      await client.query(`
        set role cloudsqlsuperuser;
        revoke connect on database ${databaseName}
          from ${TEST_PUBLIC_ROLE}, ${TEST_ADMIN_ROLE}, ${process.env.PGUSER};
        grant connect, temporary on database ${databaseName} to public;
        reset role;
        alter database ${databaseName} owner to hugmeid_schema_owner;
        revoke cloudsqlsuperuser from cloudsqlagent, cloudsqlimportexport;
        drop role cloudsqlagent;
        drop role cloudsqlimportexport;
        drop role cloudsqlsuperuser;
      `);
    }
  }

  const firstBind = runRuntimeBindingScript(databaseName);
  assert.equal(firstBind.status, 0, firstBind.stderr);
  const secondBind = runRuntimeBindingScript(databaseName);
  assert.equal(secondBind.status, 0, secondBind.stderr);

  const stateBeforeRejectedBind = await client.query(
    `select
       database.datacl::text as database_acl,
       (
         select count(*)::integer
         from pg_catalog.pg_auth_members membership
         join pg_catalog.pg_roles member on member.oid = membership.member
         where member.rolname in ($1, $2)
       ) as membership_count
     from pg_catalog.pg_database database
     where database.datname = current_database()`,
    [TEST_PUBLIC_ROLE, TEST_ADMIN_ROLE],
  );
  const mismatchBind = runRuntimeBindingScript(databaseName, {
    target_database: `${databaseName}_wrong`,
  });
  assert.notEqual(mismatchBind.status, 0, "Target mismatch must fail");
  const invalidOperatorBind = runRuntimeBindingScript(databaseName, {
    operator_login: TEST_PUBLIC_ROLE,
  });
  assert.notEqual(invalidOperatorBind.status, 0, "Unapproved operator must fail");
  const stateAfterRejectedBind = await client.query(
    `select
       database.datacl::text as database_acl,
       (
         select count(*)::integer
         from pg_catalog.pg_auth_members membership
         join pg_catalog.pg_roles member on member.oid = membership.member
         where member.rolname in ($1, $2)
       ) as membership_count
     from pg_catalog.pg_database database
     where database.datname = current_database()`,
    [TEST_PUBLIC_ROLE, TEST_ADMIN_ROLE],
  );
  assert.deepEqual(
    stateAfterRejectedBind.rows,
    stateBeforeRejectedBind.rows,
    "Rejected binding attempts must not mutate database ACLs or memberships",
  );

  await client.query(`
    create role ${TEST_UNEXPECTED_CONNECT_ROLE} login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
    set role hugmeid_schema_owner;
    grant connect on database ${databaseName} to ${TEST_UNEXPECTED_CONNECT_ROLE};
    reset role;
  `);
  try {
    const stateBeforeLateFailure = await client.query(
      `select database.datacl::text as database_acl
       from pg_catalog.pg_database database
       where database.datname = current_database()`,
    );
    const lateFailureBind = runRuntimeBindingScript(databaseName);
    assert.notEqual(lateFailureBind.status, 0, "Unexpected effective CONNECT must fail before commit");
    const stateAfterLateFailure = await client.query(
      `select database.datacl::text as database_acl
       from pg_catalog.pg_database database
       where database.datname = current_database()`,
    );
    assert.deepEqual(
      stateAfterLateFailure.rows,
      stateBeforeLateFailure.rows,
      "Late binding failure must roll back all database ACL changes",
    );
  } finally {
    await client.query(`
      set role hugmeid_schema_owner;
      revoke connect on database ${databaseName} from ${TEST_UNEXPECTED_CONNECT_ROLE};
      reset role;
      drop role ${TEST_UNEXPECTED_CONNECT_ROLE};
    `);
  }
}

async function createPublicSmokeFixtures(client) {
  await client.query("begin");
  try {
    await client.query('set local role "hugmeid_schema_owner"');
    const job = await client.query(`
      insert into public.jobs (
        external_source, external_id, title, job_category_id, employment_type_id, slug
      )
      values (
        'integration', 'job-1', 'Integration job',
        '44444444-4444-4444-8444-444444444441',
        '55555555-5555-4555-8555-555555555551',
        'integration-job'
      )
      returning id
    `);
    const activity = await client.query(`
      insert into public.activities (slug, kind, title, host_name, action_type)
      values ('integration-activity', 'event', 'Integration activity', 'Hugmeid', 'attend')
      returning id
    `);
    const content = await client.query(`
      insert into public.contents (slug, content_type, category, title)
      values ('integration-content', 'guide', 'guide', 'Integration content')
      returning id
    `);
    const syllabusPage = await client.query(`
      insert into public.syllabus_pages (university_id, academic_year, term_number)
      values ('11111111-1111-4111-8111-111111111111', 2099, 1)
      returning id
    `);
    const syllabusEntry = await client.query(
      `insert into public.syllabus_class_entries (syllabus_page_id, class_key, title, schedule)
       values ($1, 'integration-class', 'Integration class', '{"day":"月","period":1}'::jsonb)
       returning id`,
      [syllabusPage.rows[0].id],
    );
    const task = await client.query(
      `insert into public.syllabus_class_tasks (syllabus_class_entry_id, title)
       values ($1, 'Integration task')
       returning id`,
      [syllabusEntry.rows[0].id],
    );
    await client.query("commit");
    return {
      jobId: job.rows[0].id,
      activityId: activity.rows[0].id,
      contentId: content.rows[0].id,
      syllabusPageId: syllabusPage.rows[0].id,
      syllabusEntryId: syllabusEntry.rows[0].id,
      taskId: task.rows[0].id,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function removePublicSmokeFixtures(client, fixtures) {
  await client.query("begin");
  try {
    await client.query('set local role "hugmeid_schema_owner"');
    await client.query("delete from public.contents where id = $1", [fixtures.contentId]);
    await client.query("delete from public.activities where id = $1", [fixtures.activityId]);
    await client.query("delete from public.jobs where id = $1", [fixtures.jobId]);
    await client.query("delete from public.syllabus_pages where id = $1", [fixtures.syllabusPageId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyJobApplyConstraintNegativePath(client, fixtures) {
  for (const applyUrl of [
    null,
    "https://",
    "https://%zz",
    "https://example.com:99999",
    "https://999.999.999.999/apply",
    "https://1.2.3.999/apply",
  ]) {
    await expectFailure(
      () => client.query(
        "update public.jobs set published_at = now(), apply_url = $2 where id = $1",
        [fixtures.jobId, applyUrl],
      ),
      /jobs_active_published_apply_url_required/,
    );
  }
  const result = await client.query("select published_at from public.jobs where id = $1", [fixtures.jobId]);
  assert.equal(result.rows[0]?.published_at, null, "Rejected job publish must leave the row unpublished");
}

async function verifyTimetableConstraintNegativePath(client, fixtures) {
  for (const schedule of [
    { day: "月", period: 7 },
    { day: null, period: 1 },
    { weekday: 1 },
  ]) {
    await expectFailure(
      () => client.query(
        `insert into public.syllabus_class_entries (syllabus_page_id, class_key, title, schedule)
         values ($1, 'invalid-schedule-constraint', 'Invalid schedule', $2::jsonb)`,
        [fixtures.syllabusPageId, JSON.stringify(schedule)],
      ),
      /syllabus_class_entries_schedule_shape_check/,
    );
  }
  const result = await client.query(
    "select count(*)::integer as count from public.syllabus_class_entries where class_key = 'invalid-schedule-constraint'",
  );
  assert.equal(result.rows[0]?.count, 0, "Rejected timetable rows must not be inserted");

  const inactive = await client.query(
    `insert into public.syllabus_class_entries
       (syllabus_page_id, class_key, title, schedule, is_active)
     values ($1, 'inactive-invalid-schedule', 'Inactive invalid schedule', '{"day":"月","period":7}'::jsonb, false)
     returning id`,
    [fixtures.syllabusPageId],
  );
  await expectFailure(
    () => client.query(
      `update public.syllabus_class_entries
       set is_active = true, revision_no = revision_no + 1
       where id = $1`,
      [inactive.rows[0].id],
    ),
    /syllabus_class_entries_schedule_shape_check/,
  );
  await client.query("delete from public.syllabus_class_entries where id = $1", [inactive.rows[0].id]);
}

async function verifyCacheOutboxConstraintNegativePaths(client) {
  await client.query("begin");
  try {
    await client.query('set local role "hugmeid_schema_owner"');
    const owner = await client.query(
      "insert into public.admin_users (email, role) values ('outbox-constraint@test.invalid', 'owner') returning id",
    );
    for (const invalidValues of [
      { tags: [], attemptCount: 0 },
      { tags: ["contents"], attemptCount: -1 },
    ]) {
      await client.query("savepoint invalid_outbox");
      let failure;
      try {
        await client.query(
          `insert into public.public_cache_invalidation_jobs
             (actor_admin_id, resource_type, resource_id, tags, attempt_count)
           values ($1, 'contents', 'integration', $2::text[], $3)`,
          [owner.rows[0].id, invalidValues.tags, invalidValues.attemptCount],
        );
      } catch (error) {
        failure = error;
      }
      assert(failure, `Expected invalid outbox row to fail: ${JSON.stringify(invalidValues)}`);
      await client.query("rollback to savepoint invalid_outbox");
    }
    const jobs = await client.query("select count(*)::integer as count from public.public_cache_invalidation_jobs");
    assert.equal(jobs.rows[0]?.count, 0, "Rejected outbox writes must not leave retry jobs");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyPublicRuntime(client, fixtures) {
  await client.query("begin");
  try {
    const user = await client.query(
      "insert into public.users (line_uid) values ('integration-public-user') returning id",
    );
    const userId = user.rows[0].id;
    await client.query(
      "insert into public.user_legal_consents (user_id, version) values ($1, '2026-07-30')",
      [userId],
    );
    await client.query(
      `update public.users
       set university_id = '11111111-1111-4111-8111-111111111111',
           is_profile_complete = true
       where id = $1`,
      [userId],
    );
    await client.query(
      `insert into public.user_club_memberships (user_id, club_id)
       values ($1, '22222222-2222-4222-8222-222222222221')`,
      [userId],
    );
    await client.query(
      `insert into public.user_desired_specialties (user_id, specialty_id)
       values ($1, '33333333-3333-4333-8333-333333333331')`,
      [userId],
    );
    await client.query("insert into public.job_bookmarks (user_id, job_id) values ($1, $2)", [
      userId,
      fixtures.jobId,
    ]);
    await client.query("insert into public.activity_bookmarks (user_id, activity_id) values ($1, $2)", [
      userId,
      fixtures.activityId,
    ]);
    await client.query("insert into public.content_bookmarks (user_id, content_id) values ($1, $2)", [
      userId,
      fixtures.contentId,
    ]);
    await client.query(
      "insert into public.user_timetable_entries (user_id, syllabus_class_entry_id) values ($1, $2)",
      [userId, fixtures.syllabusEntryId],
    );
    await client.query(
      "insert into public.user_class_memos (user_id, syllabus_class_entry_id, body) values ($1, $2, 'memo')",
      [userId, fixtures.syllabusEntryId],
    );
    await client.query(
      "insert into public.user_class_tags (user_id, syllabus_class_entry_id, label) values ($1, $2, 'tag')",
      [userId, fixtures.syllabusEntryId],
    );
    await client.query(
      `insert into public.user_class_task_statuses (user_id, syllabus_class_task_id, status)
       values ($1, $2, 'todo')`,
      [userId, fixtures.taskId],
    );
    await client.query("insert into public.user_notification_settings (user_id) values ($1)", [userId]);
    await client.query(
      `insert into public.inquiries (user_id, intent, message)
       values ($1, 'other', 'Integration inquiry')`,
      [userId],
    );
    await client.query(
      `insert into public.syllabus_class_resources
         (syllabus_class_entry_id, resource_type, url, created_by_user_id)
       values ($1, 'material_url', 'https://example.test/material', $2)`,
      [fixtures.syllabusEntryId, userId],
    );
    await client.query(
      `insert into public.syllabus_class_tasks
         (syllabus_class_entry_id, title, created_by_user_id)
       values ($1, 'User-created integration task', $2)`,
      [fixtures.syllabusEntryId, userId],
    );
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await expectFailure(
    () => client.query("update public.user_legal_consents set version = 'forbidden'"),
    /permission denied/,
  );
  await expectFailure(() => client.query("create table public.forbidden_public_runtime(id int)"), /permission denied/);
}

async function verifyAdminRuntime(client) {
  await client.query("begin");
  try {
    const owner = await client.query(
      "insert into public.admin_users (email, role) values ('owner@test.invalid', 'owner') returning id",
    );
    const ownerId = owner.rows[0].id;
    await client.query(
      `insert into public.admin_audit_logs (actor_admin_id, action, resource_type)
       values ($1, 'integration.test', 'schema')`,
      [ownerId],
    );
    await client.query(
      `insert into public.assets
         (bucket, object_path, public_url, content_type, byte_size, checksum, uploaded_by_admin_id)
       values
         (
           'integration',
           'contents/source/11111111-1111-4111-8111-111111111111/original.webp',
           'https://example.test/api/assets/public/contents/source/11111111-1111-4111-8111-111111111111/original.webp',
           'image/webp', 1, 'checksum', $1
         )`,
      [ownerId],
    );
    const content = await client.query(
      `insert into public.contents
         (slug, content_type, category, title, created_by_admin_id, updated_by_admin_id)
       values ('admin-integration-content', 'guide', 'guide', 'Admin integration content', $1, $1)
       returning id`,
      [ownerId],
    );
    await client.query(
      `insert into public.content_versions (content_id, version_no, snapshot, created_by_admin_id)
       values ($1, 1, '{}'::jsonb, $2)`,
      [content.rows[0].id, ownerId],
    );
    await client.query("update public.contents set approval_status = 'in_review' where id = $1", [
      content.rows[0].id,
    ]);
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }

  await expectFailure(() => client.query("delete from public.admin_audit_logs"), /permission denied/);
  await expectFailure(() => client.query("create table public.forbidden_admin_runtime(id int)"), /permission denied/);

  await client.query("begin");
  try {
    const owner = await client.query(
      "insert into public.admin_users (email, role) values ('variant-owner@test.invalid', 'owner') returning id",
    );
    const activeAsset = await client.query(
      `insert into public.assets
         (id, bucket, object_path, public_url, content_type, byte_size, checksum, uploaded_by_admin_id)
       values (
         '11111111-1111-4111-8111-111111111111',
         'integration',
         'contents/source/11111111-1111-4111-8111-111111111111/original.webp',
         'https://example.test/api/assets/public/contents/source/11111111-1111-4111-8111-111111111111/original.webp',
         'image/webp', 1, 'checksum', $1
       ) returning id`,
      [owner.rows[0].id],
    );
    await client.query(
      `insert into public.asset_variants
         (asset_id, bucket, object_path, public_url, content_type, width, height, byte_size, checksum)
       values (
         $1, 'integration',
         'contents/variants/11111111-1111-4111-8111-111111111111/w320.webp',
         'https://example.test/api/assets/public/contents/variants/11111111-1111-4111-8111-111111111111/w320.webp',
         'image/webp', 320, 180, 1, '${"a".repeat(64)}'
       )`,
      [activeAsset.rows[0].id],
    );
    await client.query("update public.assets set deleted_at = now() where id = $1", [activeAsset.rows[0].id]);
    await client.query("savepoint deleted_parent_guard");
    await expectFailure(
      () => client.query(
        `insert into public.asset_variants
           (asset_id, bucket, object_path, public_url, content_type, width, height, byte_size, checksum)
         values (
           $1, 'integration',
           'contents/variants/11111111-1111-4111-8111-111111111111/w640.webp',
           'https://example.test/api/assets/public/contents/variants/11111111-1111-4111-8111-111111111111/w640.webp',
           'image/webp', 640, 360, 1, '${"b".repeat(64)}'
         )`,
        [activeAsset.rows[0].id],
      ),
      /cannot be added to deleted or purged assets/,
    );
    await client.query("rollback to savepoint deleted_parent_guard");
    await client.query("rollback");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyPrincipalPrivilegeGuards(client) {
  await client.query(`
    create role hugmeid_ci_unsafe_direct login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant hugmeid_public_runtime to hugmeid_ci_unsafe_direct;
    grant create on schema public to hugmeid_ci_unsafe_direct;
    grant select on public.schema_migrations to hugmeid_ci_unsafe_direct;
  `);
  try {
    await expectFailure(
      () =>
        verifyDatabase({
          client,
          expectedEnvironment: "local",
          publicLoginRole: "hugmeid_ci_unsafe_direct",
          adminLoginRole: TEST_ADMIN_ROLE,
        }),
      /direct ACLs|can CREATE/,
    );
  } finally {
    await client.query(`
      revoke all privileges on public.schema_migrations from hugmeid_ci_unsafe_direct;
      revoke create on schema public from hugmeid_ci_unsafe_direct;
      revoke hugmeid_public_runtime from hugmeid_ci_unsafe_direct;
      drop role hugmeid_ci_unsafe_direct;
    `);
  }

  await client.query(`
    create role hugmeid_ci_nested_power nologin;
    create role hugmeid_ci_unsafe_nested login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant pg_read_all_data to hugmeid_ci_nested_power;
    grant hugmeid_public_runtime to hugmeid_ci_unsafe_nested;
    grant hugmeid_ci_nested_power to hugmeid_ci_unsafe_nested;
  `);
  try {
    await expectFailure(
      () =>
        verifyDatabase({
          client,
          expectedEnvironment: "local",
          publicLoginRole: "hugmeid_ci_unsafe_nested",
          adminLoginRole: TEST_ADMIN_ROLE,
        }),
      /unexpected direct\/transitive memberships/,
    );
  } finally {
    await client.query(`
      revoke hugmeid_ci_nested_power from hugmeid_ci_unsafe_nested;
      revoke hugmeid_public_runtime from hugmeid_ci_unsafe_nested;
      revoke pg_read_all_data from hugmeid_ci_nested_power;
      drop role hugmeid_ci_unsafe_nested;
      drop role hugmeid_ci_nested_power;
    `);
  }

  for (const membershipCase of [
    { role: "hugmeid_ci_unsafe_noinherit", option: "inherit", value: "false" },
    { role: "hugmeid_ci_unsafe_noset", option: "set", value: "false" },
    { role: "hugmeid_ci_unsafe_admin_edge", option: "admin", value: "true" },
  ]) {
    await client.query(`
      create role ${membershipCase.role} login
        nosuperuser nocreatedb nocreaterole noreplication nobypassrls inherit;
      grant hugmeid_public_runtime to ${membershipCase.role}
        with ${membershipCase.option} ${membershipCase.value};
    `);
    try {
      await expectFailure(
        () =>
          verifyDatabase({
            client,
            expectedEnvironment: "local",
            publicLoginRole: membershipCase.role,
            adminLoginRole: TEST_ADMIN_ROLE,
          }),
        /safe direct membership edge/,
      );
    } finally {
      await client.query(`
        revoke hugmeid_public_runtime from ${membershipCase.role};
        drop role ${membershipCase.role};
      `);
    }
  }

  await client.query(`
    create role hugmeid_ci_unsafe_default_acl login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant hugmeid_public_runtime to hugmeid_ci_unsafe_default_acl;
    alter default privileges for role current_user in schema public
      grant select on tables to hugmeid_ci_unsafe_default_acl;
  `);
  try {
    await expectFailure(
      () =>
        verifyDatabase({
          client,
          expectedEnvironment: "local",
          publicLoginRole: "hugmeid_ci_unsafe_default_acl",
          adminLoginRole: TEST_ADMIN_ROLE,
        }),
      /direct ACLs/,
    );
  } finally {
    await client.query(`
      alter default privileges for role current_user in schema public
        revoke select on tables from hugmeid_ci_unsafe_default_acl;
      revoke hugmeid_public_runtime from hugmeid_ci_unsafe_default_acl;
      drop role hugmeid_ci_unsafe_default_acl;
    `);
  }

  const databaseResult = await client.query("select current_database() as name");
  const databaseName = databaseResult.rows[0]?.name;
  assert.match(databaseName, /(?:_test|_ci)$/);
  await client.query(`
    create role hugmeid_ci_unsafe_extension login
      nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
    grant hugmeid_public_runtime to hugmeid_ci_unsafe_extension;
    grant create on database ${databaseName} to hugmeid_ci_unsafe_extension;
    grant usage, create on schema public to hugmeid_ci_unsafe_extension;
  `);
  try {
    await client.query("set role hugmeid_ci_unsafe_extension");
    try {
      await client.query("create extension hstore with schema public");
    } finally {
      await client.query("reset role");
    }
    await client.query(`revoke create on database ${databaseName} from hugmeid_ci_unsafe_extension`);
    await client.query("revoke usage, create on schema public from hugmeid_ci_unsafe_extension");
    await expectFailure(
      () =>
        verifyDatabase({
          client,
          expectedEnvironment: "local",
          publicLoginRole: "hugmeid_ci_unsafe_extension",
          adminLoginRole: TEST_ADMIN_ROLE,
        }),
      /owns database objects/,
    );
  } finally {
    await client.query(`
      reset role;
      drop extension if exists hstore;
      revoke create on database ${databaseName} from hugmeid_ci_unsafe_extension;
      revoke usage, create on schema public from hugmeid_ci_unsafe_extension;
      revoke hugmeid_public_runtime from hugmeid_ci_unsafe_extension;
      drop role hugmeid_ci_unsafe_extension;
    `);
  }
}

async function verifyMigrationMembershipEdgeGuards(client) {
  for (const membershipCase of [
    { option: "inherit", unsafeValue: "false", safeValue: "true" },
    { option: "set", unsafeValue: "false", safeValue: "true" },
  ]) {
    await client.query(
      `grant hugmeid_schema_owner to current_user with ${membershipCase.option} ${membershipCase.unsafeValue}`,
    );
    try {
      await expectFailure(
        () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
        /safe direct membership edge/,
      );
    } finally {
      await client.query(
        `grant hugmeid_schema_owner to current_user with ${membershipCase.option} ${membershipCase.safeValue}`,
      );
    }
  }
}

async function verifyCloudSqlManagedAclNormalization(client) {
  const roleResult = await client.query(
    "select exists(select 1 from pg_catalog.pg_roles where rolname = 'cloudsqlsuperuser') as exists",
  );
  if (roleResult.rows[0]?.exists) return;

  await client.query("create role cloudsqlsuperuser nologin");
  try {
    await client.query("begin");
    try {
      await client.query('set local role "hugmeid_schema_owner"');
      await client.query("grant usage, create on schema public to cloudsqlsuperuser");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    let state = await captureSchemaState(client);
    assert.equal(
      state.objectPrivileges.some(
        (privilege) =>
          privilege.object_kind === "schema" &&
          privilege.schema === "public" &&
          privilege.grantee === "cloudsqlsuperuser",
      ),
      false,
      "Only provider-managed cloudsqlsuperuser public-schema ACLs should be normalized",
    );

    await client.query("begin");
    try {
      await client.query('set local role "hugmeid_schema_owner"');
      await client.query("grant select on public.schema_migrations to cloudsqlsuperuser");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    state = await captureSchemaState(client);
    assert(
      state.objectPrivileges.some(
        (privilege) =>
          privilege.object_kind === "relation" &&
          privilege.schema === "public" &&
          privilege.object_name === "schema_migrations" &&
          privilege.grantee === "cloudsqlsuperuser" &&
          privilege.privilege_type === "SELECT",
      ),
      "Application-object ACLs granted to cloudsqlsuperuser must remain visible",
    );
  } finally {
    await client.query("begin");
    try {
      await client.query('set local role "hugmeid_schema_owner"');
      await client.query("revoke select on public.schema_migrations from cloudsqlsuperuser");
      await client.query("revoke usage, create on schema public from cloudsqlsuperuser");
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
    await client.query("drop role cloudsqlsuperuser");
  }
}

async function verifyDisposableBootstrapLifecycle(adminClient) {
  const database = "hugmeid_disposable_bootstrap_ci";
  const bootstrapRole = "hugmeid_ci_disposable_bootstrap";
  let targetClient;

  await adminClient.query(`drop database if exists ${database} with (force)`);
  await adminClient.query(`drop role if exists ${bootstrapRole}`);
  try {
    await adminClient.query(`
      create role ${bootstrapRole} login createdb password 'hugmeid-ci-disposable-bootstrap-only';
      grant hugmeid_schema_owner to ${bootstrapRole} with admin true;
    `);
    await adminClient.query(`create database ${database} owner ${bootstrapRole}`);

    targetClient = new Client({
      ...adminConfig(database),
      user: bootstrapRole,
      password: "hugmeid-ci-disposable-bootstrap-only",
    });
    await targetClient.connect();
    await targetClient.query(readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"));

    await adminClient.query(`
      grant hugmeid_schema_owner to ${bootstrapRole} with inherit true;
      grant hugmeid_schema_owner to ${bootstrapRole} with set false;
      grant hugmeid_schema_owner to ${bootstrapRole} with admin true;
    `);
    await targetClient.query(`
      grant hugmeid_schema_owner to session_user with inherit false;
      grant hugmeid_schema_owner to session_user with set true;
      grant hugmeid_schema_owner to session_user with admin false;
    `);
    try {
      await expectFailure(
        () => migrate({ client: targetClient, expectedEnvironment: "local", verifyOnly: true }),
        /safe direct membership edge/,
      );
    } finally {
      await targetClient.query("grant hugmeid_schema_owner to session_user with inherit true");
      await adminClient.query(`grant hugmeid_schema_owner to ${bootstrapRole} with set true`);
    }

    const extensionOwner = await targetClient.query(
      `select
         (
           select owner.rolname
           from pg_catalog.pg_database database
           join pg_catalog.pg_roles owner on owner.oid = database.datdba
           where database.datname = current_database()
         ) as database_owner,
         (
           select owner.rolname
           from pg_catalog.pg_extension extension
           join pg_catalog.pg_roles owner on owner.oid = extension.extowner
           where extension.extname = 'pgcrypto'
         ) as extension_owner`,
    );
    assert.deepEqual(extensionOwner.rows, [
      {
        database_owner: "hugmeid_schema_owner",
        extension_owner: "hugmeid_schema_owner",
      },
    ]);

    const edge = await targetClient.query(
      `select membership.admin_option, membership.inherit_option, membership.set_option
       from pg_catalog.pg_auth_members membership
       join pg_catalog.pg_roles member on member.oid = membership.member
       join pg_catalog.pg_roles parent on parent.oid = membership.roleid
       where member.rolname = $1
         and parent.rolname = 'hugmeid_schema_owner'`,
      [bootstrapRole],
    );
    assert(
      edge.rows.some(
        (membership) =>
          membership.admin_option === false &&
          membership.inherit_option === true &&
          membership.set_option === true,
      ),
      "Database bootstrap must add a direct INHERIT/SET edge without ADMIN OPTION",
    );

    const owned = await targetClient.query(
      `with target as (
         select oid from pg_catalog.pg_roles where rolname = $1
       )
       select count(*)::integer as count
       from (
         select d.datdba as owner from pg_catalog.pg_database d
         union all select n.nspowner from pg_catalog.pg_namespace n
         union all select c.relowner from pg_catalog.pg_class c
         union all select p.proowner from pg_catalog.pg_proc p
         union all select t.typowner from pg_catalog.pg_type t
         union all select e.extowner from pg_catalog.pg_extension e
         union all select d.defaclrole from pg_catalog.pg_default_acl d
       ) owned
       where owner = (select oid from target)`,
      [bootstrapRole],
    );
    assert.equal(owned.rows[0]?.count, 0, "Disposable bootstrap principal must own no target objects");

    await targetClient.end();
    targetClient = undefined;
    await adminClient.query(`drop role ${bootstrapRole}`);
  } finally {
    if (targetClient) await targetClient.end();
    await adminClient.query(`drop database if exists ${database} with (force)`);
    await adminClient.query(`revoke hugmeid_schema_owner from ${bootstrapRole}`).catch(() => {});
    await adminClient.query(`drop role if exists ${bootstrapRole}`);
  }
}

async function verifyCapabilityRolePrivilegeGuards(client) {
  await client.query("grant pg_read_all_data to hugmeid_public_runtime");
  try {
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
      /Capability role hugmeid_public_runtime is unsafe or inherits unexpected roles/,
    );
    await expectFailure(
      () =>
        verifyDatabase({
          client,
          expectedEnvironment: "local",
          publicLoginRole: TEST_PUBLIC_ROLE,
          adminLoginRole: TEST_ADMIN_ROLE,
        }),
      /Capability role hugmeid_public_runtime is unsafe or inherits unexpected roles/,
    );
  } finally {
    await client.query("revoke pg_read_all_data from hugmeid_public_runtime");
  }

  await client.query("grant select on public.schema_migrations to hugmeid_public_runtime");
  try {
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
      /unexpected direct ACLs|grant policy drift/,
    );
  } finally {
    await client.query("revoke select on public.schema_migrations from hugmeid_public_runtime");
  }

  await client.query(
    "grant update (version) on public.user_legal_consents to hugmeid_public_runtime",
  );
  try {
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
      /unexpected direct ACLs/,
    );
  } finally {
    await client.query(
      "revoke update (version) on public.user_legal_consents from hugmeid_public_runtime",
    );
  }

  await client.query("create schema hugmeid_rogue_capability authorization hugmeid_admin_runtime");
  try {
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
      /owns unexpected database objects/,
    );
  } finally {
    await client.query("drop schema hugmeid_rogue_capability");
  }

  await client.query(
    "alter default privileges for role hugmeid_public_runtime in schema public grant select on tables to public",
  );
  try {
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", verifyOnly: true }),
      /unexpected default ACLs|owns unexpected database objects/,
    );
  } finally {
    await client.query(
      "alter default privileges for role hugmeid_public_runtime in schema public revoke select on tables from public",
    );
  }
}

function copyCurrentArtifacts(targetRoot) {
  mkdirSync(join(targetRoot, "cloudsql"), { recursive: true });
  for (const directory of ["baseline", "migrations", "seeds"]) {
    cpSync(join(repositoryRoot, "cloudsql", directory), join(targetRoot, "cloudsql", directory), {
      recursive: true,
    });
  }
}

async function verifyChecksumGuard(client) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "hugmeid-checksum-test-"));
  try {
    copyCurrentArtifacts(temporaryRoot);
    appendFileSync(
      join(temporaryRoot, "cloudsql/baseline/20260730000000_schema.sql"),
      "\n-- forbidden post-apply edit\n",
    );
    await expectFailure(
      () =>
        migrate({
          client,
          expectedEnvironment: "local",
          repositoryRoot: temporaryRoot,
          verifyOnly: true,
        }),
      /Checksum or identity mismatch/,
    );
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function verifyFailedMigrationRollback(client) {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "hugmeid-rollback-test-"));
  try {
    copyCurrentArtifacts(temporaryRoot);
    writeFileSync(
      join(temporaryRoot, "cloudsql/migrations/20260730000003_forced_failure.sql"),
      "create table public.must_rollback(id int); select 1 / 0;\n",
    );
    await expectFailure(
      () => migrate({ client, expectedEnvironment: "local", repositoryRoot: temporaryRoot }),
      /division by zero/,
    );
    const rollbackResult = await client.query(`
      select
        to_regclass('public.must_rollback') is null as table_absent,
        not exists (
          select 1 from public.schema_migrations where version = '20260730000003'
        ) as registry_absent
    `);
    assert.equal(rollbackResult.rows[0]?.table_absent, true);
    assert.equal(rollbackResult.rows[0]?.registry_absent, true);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function verifyUnmanagedDatabaseGuard(adminClient) {
  const cases = [
    {
      database: "hugmeid_unmanaged_function_test",
      setup: "create function public.unmanaged_function() returns int language sql as 'select 1'",
    },
    {
      database: "hugmeid_unmanaged_domain_test",
      setup: "create domain public.unmanaged_domain as text check (length(value) > 0)",
    },
    {
      database: "hugmeid_unmanaged_schema_test",
      setup: "create schema another_app; create table another_app.unmanaged_table(id int)",
    },
  ];

  for (const testCase of cases) {
    await adminClient.query(`drop database if exists ${testCase.database} with (force)`);
    await adminClient.query(`create database ${testCase.database}`);
    const unmanagedClient = new Client(adminConfig(testCase.database));
    await unmanagedClient.connect();
    try {
      await unmanagedClient.query(
        readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"),
      );
      await unmanagedClient.query(testCase.setup);
      await expectFailure(
        () => migrate({ client: unmanagedClient, expectedEnvironment: "local" }),
        /non-empty unmanaged database/,
      );
    } finally {
      await unmanagedClient.end();
      await adminClient.query(`drop database if exists ${testCase.database} with (force)`);
    }
  }
}

async function verifyTargetAttestationGuard(adminClient) {
  const database = "hugmeid_attestation_test";
  await adminClient.query(`drop database if exists ${database} with (force)`);
  await adminClient.query(`create database ${database}`);
  const targetClient = new Client(adminConfig(database));
  await targetClient.connect();
  try {
    await targetClient.query(readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"));
    await targetClient.query(`comment on database ${database} is 'hugmeid-environment:production'`);

    await expectFailure(
      () =>
        migrate({
          client: targetClient,
          expectedEnvironment: "staging",
          expectedDatabase: database,
          confirmedEnvironment: "staging",
        }),
      /Database environment attestation/,
    );
    let registryResult = await targetClient.query(
      "select to_regclass('public.schema_migrations') is null as absent",
    );
    assert.equal(registryResult.rows[0]?.absent, true, "attestation mismatch must fail before baseline mutation");

    await targetClient.query(`comment on database ${database} is 'hugmeid-environment:staging'`);
    await expectFailure(
      () =>
        migrate({
          client: targetClient,
          expectedEnvironment: "staging",
          expectedDatabase: database,
        }),
      /--confirm-environment=staging/,
    );
    registryResult = await targetClient.query(
      "select to_regclass('public.schema_migrations') is null as absent",
    );
    assert.equal(registryResult.rows[0]?.absent, true, "missing confirmation must fail before baseline mutation");

    await expectFailure(
      () =>
        migrate({
          client: targetClient,
          expectedEnvironment: "staging",
          expectedDatabase: "wrong_database",
          confirmedEnvironment: "staging",
        }),
      /does not match HUGMEID_EXPECTED_DATABASE/,
    );
    registryResult = await targetClient.query(
      "select to_regclass('public.schema_migrations') is null as absent",
    );
    assert.equal(registryResult.rows[0]?.absent, true, "database-name mismatch must fail before baseline mutation");

    const successfulApply = await migrate({
      client: targetClient,
      expectedEnvironment: "staging",
      expectedDatabase: database,
      confirmedEnvironment: "staging",
    });
    assert.deepEqual(successfulApply.applied, [
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
    const sentinelResult = await targetClient.query(
      "select value from public.app_environment where key = 'database_environment'",
    );
    assert.equal(sentinelResult.rows[0]?.value, "staging");

    const attestedExport = await capturePreservationBundle(targetClient, {
      expectedEnvironment: "staging",
      expectedDatabase: database,
      confirmedSourceEnvironment: "staging",
    });
    assert.equal(attestedExport.source.attestation, "hugmeid-environment:staging");
    await targetClient.query(`comment on database ${database} is null`);
    await expectFailure(
      () =>
        capturePreservationBundle(targetClient, {
          expectedEnvironment: "staging",
          expectedDatabase: database,
          confirmedSourceEnvironment: "staging",
        }),
      /Database environment attestation is missing/,
    );
    await targetClient.query(`comment on database ${database} is 'hugmeid-environment:staging'`);
  } finally {
    await targetClient.end();
    await adminClient.query(`drop database if exists ${database} with (force)`);
  }
}

async function seedPreservationFixtures(client) {
  await client.query("begin");
  try {
    await client.query('set local role "hugmeid_schema_owner"');
    await client.query(`
      insert into public.admin_users
        (id, email, role, is_active, created_at, updated_at, created_by_admin_id)
      values
        (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          'owner-preservation@example.test',
          'owner',
          true,
          '2026-07-30T00:00:00Z',
          '2026-07-30T00:00:00Z',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
        ),
        (
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
          'editor-preservation@example.test',
          'editor',
          false,
          '2026-07-30T00:01:00Z',
          '2026-07-30T00:02:00Z',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
        )
    `);
    await client.query(`
      insert into public.admin_audit_logs
        (id, actor_admin_id, action, resource_type, resource_id, before_snapshot, after_snapshot, metadata, created_at)
      values (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        'preservation.test',
        'asset',
        'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
        '{"state":"before","nested":{"b":2,"a":1}}'::jsonb,
        '{"state":"after"}'::jsonb,
        '{"request_id":"preservation-rehearsal"}'::jsonb,
        '2026-07-30T00:03:00Z'
      )
    `);
    await client.query(`
      insert into public.assets
        (id, bucket, object_path, public_url, content_type, byte_size, checksum,
         uploaded_by_admin_id, created_at, deleted_at, purged_at)
      values
        (
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
          'hugmeid-preservation-test',
          'assets/rehearsal.webp',
          'https://example.test/api/assets/public/assets/rehearsal.webp',
          'image/webp', 2048, 'sha256:preservation-rehearsal',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          '2026-07-30T00:04:00Z', null, null
        ),
        (
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
          'hugmeid-preservation-test',
          'assets/purged-rehearsal.webp',
          'https://example.test/api/assets/public/assets/purged-rehearsal.webp',
          'image/webp', 1024, 'sha256:purged-preservation-rehearsal',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          '2026-07-30T00:04:03Z', null, null
        )
    `);
    await client.query(`
      insert into public.asset_variants
        (id, asset_id, bucket, object_path, public_url, content_type, width, height, byte_size, checksum, created_at)
      values
        (
          'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
          'hugmeid-preservation-test',
          'contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc1/w320.webp',
          'https://example.test/api/assets/public/contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc1/w320.webp',
          'image/webp', 320, 180, 512, '${"a".repeat(64)}', '2026-07-30T00:04:01Z'
        ),
        (
          'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
          'hugmeid-preservation-test',
          'contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc1/w320.avif',
          'https://example.test/api/assets/public/contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc1/w320.avif',
          'image/avif', 320, 180, 384, '${"b".repeat(64)}', '2026-07-30T00:04:02Z'
        ),
        (
          'dddddddd-dddd-4ddd-8ddd-ddddddddddd3',
          'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
          'hugmeid-preservation-test',
          'contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc2/w320.webp',
          'https://example.test/api/assets/public/contents/variants/cccccccc-cccc-4ccc-8ccc-ccccccccccc2/w320.webp',
          'image/webp', 320, 180, 256, '${"c".repeat(64)}', '2026-07-30T00:04:04Z'
        )
    `);
    await client.query(`
      update public.assets
      set deleted_at = '2026-07-30T00:05:00Z', purged_at = '2026-07-30T00:06:00Z'
      where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
    `);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function verifyPreservationRehearsal(adminClient) {
  const sourceDatabase = "hugmeid_preservation_legacy_ci";
  const destinationDatabase = "hugmeid_preservation_ci";
  const legacyDestinationDatabase = "hugmeid_preservation_v1_ci";
  const unattestedDatabase = "hugmeid_preservation_unattested_ci";
  let sourceClient;
  let destinationClient;
  let legacyDestinationClient;
  let unattestedClient;
  await adminClient.query(`drop database if exists ${sourceDatabase} with (force)`);
  await adminClient.query(`drop database if exists ${destinationDatabase} with (force)`);
  await adminClient.query(`drop database if exists ${legacyDestinationDatabase} with (force)`);
  await adminClient.query(`drop database if exists ${unattestedDatabase} with (force)`);
  try {
    await adminClient.query(`create database ${unattestedDatabase}`);
    unattestedClient = new Client(adminConfig(unattestedDatabase));
    await unattestedClient.connect();
    await expectFailure(
      () => capturePreservationBundle(unattestedClient, {
        expectedEnvironment: "local",
        expectedDatabase: unattestedDatabase,
        confirmedSourceEnvironment: "local",
      }),
      /Database environment sentinel is missing, expected local/,
    );

    await adminClient.query(`create database ${sourceDatabase}`);
    await adminClient.query(`comment on database ${sourceDatabase} is 'hugmeid-environment:local'`);
    sourceClient = new Client(adminConfig(sourceDatabase));
    await sourceClient.connect();
    await sourceClient.query(
      readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"),
    );
    await migrate({ client: sourceClient, expectedEnvironment: "local" });
    await sourceClient.query("begin");
    try {
      await sourceClient.query('set local role "hugmeid_schema_owner"');
      await sourceClient.query(
        "alter table public.admin_users drop constraint admin_users_deleted_must_be_inactive",
      );
      await sourceClient.query("alter table public.admin_users drop column deleted_at");
      await sourceClient.query("commit");
    } catch (error) {
      await sourceClient.query("rollback");
      throw error;
    }
    await seedPreservationFixtures(sourceClient);
    const sourceBundle = await capturePreservationBundle(sourceClient, {
      expectedEnvironment: "local",
      expectedDatabase: sourceDatabase,
      confirmedSourceEnvironment: "local",
    });
    const sourceManifest = preservationManifest(sourceBundle);
    assert.equal(sourceBundle.source.environment, "local");
    assert.equal(sourceBundle.source.attestation, "hugmeid-environment:local");
    assert.equal(
      sourceManifest.preservedTables.find((table) => table.name === "admin_users")?.rowCount,
      2,
    );
    assert.equal(sourceManifest.assetObjects.rowCount, 3);
    const legacyBundle = {
      ...sourceBundle,
      formatVersion: 1,
      tables: sourceBundle.tables.slice(0, 3),
    };
    legacyBundle.bundleSha256 = bundleChecksum(legacyBundle);
    const legacyManifest = preservationManifest(legacyBundle);
    assert.equal(legacyManifest.assetObjects.rowCount, 2, "v1 keeps the historical parent-only object manifest behavior");
    assert.equal(verifyPreservationBundleManifest(legacyBundle, legacyManifest), true);
    assert.equal(
      sourceManifest.preservedTables
        .find((table) => table.name === "admin_users")
        ?.columns.includes("deleted_at"),
      false,
      "Legacy-source rehearsal must omit staging's missing deleted_at column",
    );
    assert.equal(verifyPreservationBundleManifest(sourceBundle, sourceManifest), true);
    const truncatedBundle = {
      ...sourceBundle,
      tables: sourceBundle.tables.slice(0, 2),
    };
    await expectFailure(
      async () => preservationManifest(truncatedBundle),
      /must contain exactly these tables/,
    );
    const tamperedBundle = structuredClone(sourceBundle);
    tamperedBundle.tables[0].rows[0] = tamperedBundle.tables[0].rows[0].replace(
      "owner-preservation@example.test",
      "tampered@example.test",
    );
    await expectFailure(
      async () => preservationManifest(tamperedBundle),
      /bundle checksum mismatch/,
    );
    const wrongSourceManifest = structuredClone(sourceManifest);
    wrongSourceManifest.source.database = "wrong_source_database";
    await expectFailure(
      async () => verifyPreservationBundleManifest(sourceBundle, wrongSourceManifest),
      /does not match its source manifest/,
    );

    await adminClient.query(`create database ${destinationDatabase}`);
    await adminClient.query(`comment on database ${destinationDatabase} is 'hugmeid-environment:local'`);
    destinationClient = new Client(adminConfig(destinationDatabase));
    await destinationClient.connect();
    await destinationClient.query(
      readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"),
    );
    await migrate({ client: destinationClient, expectedEnvironment: "local" });

    await adminClient.query(`create database ${legacyDestinationDatabase}`);
    await adminClient.query(`comment on database ${legacyDestinationDatabase} is 'hugmeid-environment:local'`);
    legacyDestinationClient = new Client(adminConfig(legacyDestinationDatabase));
    await legacyDestinationClient.connect();
    await legacyDestinationClient.query(
      readFileSync(join(repositoryRoot, "cloudsql/ops/bootstrap_database.sql"), "utf8"),
    );
    await migrate({ client: legacyDestinationClient, expectedEnvironment: "local" });
    await expectFailure(
      () => restorePreservationBundle(unattestedClient, sourceBundle, {
        expectedEnvironment: "local",
        expectedDatabase: unattestedDatabase,
        confirmedEnvironment: "local",
      }),
      /Database environment sentinel is missing, expected local/,
    );
    const restoredLegacyManifest = await restorePreservationBundle(legacyDestinationClient, legacyBundle, {
      expectedEnvironment: "local",
      expectedDatabase: legacyDestinationDatabase,
      confirmedEnvironment: "local",
    });
    comparePreservationManifests(legacyManifest, restoredLegacyManifest);

    await expectFailure(
      () =>
        restorePreservationBundle(destinationClient, sourceBundle, {
          expectedEnvironment: "local",
          expectedDatabase: destinationDatabase,
          confirmedEnvironment: "local",
          expectedSourceDatabase: "wrong_source_database",
          expectedSourceEnvironment: "local",
        }),
      /source database .* does not match expected/,
    );
    const preRestoreCount = await destinationClient.query(
      "select count(*)::integer as count from public.admin_users",
    );
    assert.equal(preRestoreCount.rows[0]?.count, 0, "wrong-source rejection must happen before inserts");

    await expectFailure(
      () =>
        restorePreservationBundle(destinationClient, sourceBundle, {
          expectedEnvironment: "local",
          expectedDatabase: destinationDatabase,
          confirmedEnvironment: "local",
          expectedSourceDatabase: sourceBundle.source.database,
          expectedSourceEnvironment: sourceBundle.source.environment,
          expectedSourceBundleSha256: "0".repeat(64),
        }),
      /externally approved source bundle SHA-256/,
    );

    await expectFailure(
      () =>
        restorePreservationBundle(destinationClient, sourceBundle, {
          expectedEnvironment: "staging",
          expectedDatabase: destinationDatabase,
          publicLoginRole: TEST_PUBLIC_ROLE,
          adminLoginRole: TEST_ADMIN_ROLE,
          operatorLoginRole: process.env.PGUSER,
          expectedSourceDatabase: sourceBundle.source.database,
          expectedSourceEnvironment: sourceBundle.source.environment,
          expectedSourceBundleSha256: sourceBundle.bundleSha256,
        }),
      /Cross-environment preservation restore is forbidden/,
    );

    const destinationManifest = await restorePreservationBundle(destinationClient, sourceBundle, {
      expectedEnvironment: "local",
      expectedDatabase: destinationDatabase,
      confirmedEnvironment: "local",
      expectedSourceDatabase: sourceBundle.source.database,
      expectedSourceEnvironment: sourceBundle.source.environment,
    });
    comparePreservationManifests(sourceManifest, destinationManifest);

    const creatorReferenceResult = await destinationClient.query(
      `select created_by_admin_id::text as created_by_admin_id
       from public.admin_users
       where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'`,
    );
    assert.equal(
      creatorReferenceResult.rows[0]?.created_by_admin_id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      "Restore must preserve an admin_users creator reference to a later-sorted row",
    );
    const reverseCreatorReferenceResult = await destinationClient.query(
      `select created_by_admin_id::text as created_by_admin_id
       from public.admin_users
       where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'`,
    );
    assert.equal(
      reverseCreatorReferenceResult.rows[0]?.created_by_admin_id,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      "Restore must preserve cyclic admin_users creator references",
    );

    const ownerResult = await destinationClient.query(
      `select count(*)::integer as count
       from public.admin_users
       where role = 'owner'
         and is_active = true
         and deleted_at is null`,
    );
    assert.equal(ownerResult.rows[0]?.count, 1, "Restored state must retain an active owner");
    await expectFailure(
      () =>
        restorePreservationBundle(destinationClient, sourceBundle, {
          expectedEnvironment: "local",
          expectedDatabase: destinationDatabase,
          confirmedEnvironment: "local",
        }),
      /is not empty/,
    );
  } finally {
    if (sourceClient) await sourceClient.end();
    if (destinationClient) await destinationClient.end();
    if (legacyDestinationClient) await legacyDestinationClient.end();
    if (unattestedClient) await unattestedClient.end();
    await adminClient.query(`drop database if exists ${sourceDatabase} with (force)`);
    await adminClient.query(`drop database if exists ${destinationDatabase} with (force)`);
    await adminClient.query(`drop database if exists ${legacyDestinationDatabase} with (force)`);
    await adminClient.query(`drop database if exists ${unattestedDatabase} with (force)`);
  }
}

async function main() {
  const adminClient = new Client(adminConfig());
  await adminClient.connect();
  let fixtures;
  try {
    await resetTestDatabase(adminClient);
    const firstApply = await migrate({ client: adminClient, expectedEnvironment: "local" });
    assert.deepEqual(firstApply.applied, [
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

    const secondApply = await migrate({ client: adminClient, expectedEnvironment: "local" });
    assert.equal(secondApply.applied.length, 0, "Second migration apply must be a no-op");

    await verifyDatabase({
      client: adminClient,
      expectedEnvironment: "local",
      expectedDatabase: process.env.PGDATABASE,
      publicLoginRole: TEST_PUBLIC_ROLE,
      adminLoginRole: TEST_ADMIN_ROLE,
      operatorLoginRole: process.env.PGUSER,
    });
    await verifyCloudSqlManagedAclNormalization(adminClient);
    await verifyMigrationMembershipEdgeGuards(adminClient);
    await verifyPrincipalPrivilegeGuards(adminClient);
    await verifyCapabilityRolePrivilegeGuards(adminClient);

    fixtures = await createPublicSmokeFixtures(adminClient);
    await verifyJobApplyConstraintNegativePath(adminClient, fixtures);
    await verifyTimetableConstraintNegativePath(adminClient, fixtures);
    await verifyCacheOutboxConstraintNegativePaths(adminClient);
    const publicClient = new Client(runtimeConfig(TEST_PUBLIC_ROLE, TEST_PUBLIC_PASSWORD));
    const adminRuntimeClient = new Client(runtimeConfig(TEST_ADMIN_ROLE, TEST_ADMIN_PASSWORD));
    await publicClient.connect();
    await adminRuntimeClient.connect();
    try {
      await verifyPublicRuntime(publicClient, fixtures);
      await verifyAdminRuntime(adminRuntimeClient);
    } finally {
      await publicClient.end();
      await adminRuntimeClient.end();
    }
    await removePublicSmokeFixtures(adminClient, fixtures);
    fixtures = undefined;

    await verifyChecksumGuard(adminClient);
    await verifyFailedMigrationRollback(adminClient);
    await verifyUnmanagedDatabaseGuard(adminClient);
    await verifyTargetAttestationGuard(adminClient);
    await verifyDisposableBootstrapLifecycle(adminClient);
    await verifyPreservationRehearsal(adminClient);
    await verifyDatabaseConnectIsolationGuards(adminClient);

    process.stdout.write("Cloud SQL baseline integration checks passed.\n");
  } finally {
    if (fixtures) await removePublicSmokeFixtures(adminClient, fixtures);
    await adminClient.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Cloud SQL integration checks failed: ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
