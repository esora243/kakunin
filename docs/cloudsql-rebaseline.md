# Cloud SQL release baseline

This document is the authoritative SQL lifecycle for the first Hugmeid
production release. It replaces the former instruction to run every SQL file
in filename order.

## Executable surfaces

| Path | Purpose |
| --- | --- |
| `cloudsql/baseline/20260730000000_schema.sql` | Strict empty-database schema |
| `cloudsql/seeds/20260730000001_required_lookups.sql` | Required lookup rows, applied once |
| `cloudsql/migrations/` | Immutable forward migrations created after the baseline |
| `cloudsql/ops/bootstrap_roles.sql` | Cluster-level NOLOGIN capability roles |
| `cloudsql/ops/bootstrap_database.sql` | Per-database extension and schema-owner setup |
| `cloudsql/ops/attest_database_environment.sql` | One-time DB-owned staging/production identity |
| `cloudsql/ops/prelock_database_connect.sql` | Bootstrap/operator-only connection lock before migration |
| `cloudsql/ops/bind_runtime_roles.sql` | psql template that binds safe login/IAM principals |
| `cloudsql/ops/restrict_legacy_database_connect.sql` | Exact connection isolation for retained legacy databases |
| `scripts/cloudsql-migrate.mjs` | Transactional version/checksum runner |
| `scripts/cloudsql-preservation.mjs` | Approved-state export, restore, and hash comparison |
| `scripts/cloudsql-verify.mjs` | Schema, owner, role, membership, and exact-grant verifier |
| `cloudsql/history/pre_release/` | Immutable evidence only; never an executable directory |

The runner refuses:

- a non-empty database without `schema_migrations`;
- duplicate or malformed versions;
- edits to an already-applied artifact;
- a checkout missing a version already recorded by the database;
- an unsafe or missing schema-owner role;
- a missing `pgcrypto` bootstrap;
- a staging/production sentinel mismatch;
- non-local writes without matching database name, database attestation, and
  `--confirm-environment`.

Every artifact is applied in its own transaction while holding one advisory
lock. A failed artifact rolls back both its DDL/DML and registry row.

## Ownership and runtime roles

`hugmeid_schema_owner` is the only owner of application tables and
application-defined functions. It is `NOLOGIN` and receives schema `CREATE`
only so reviewed migrations can run through `SET ROLE`.

`hugmeid_public_runtime` and `hugmeid_admin_runtime` are cluster-global
`NOLOGIN` capability roles. Environment-specific login or IAM database
principals inherit one of them. Because role membership crosses database
boundaries, every application database revokes `CONNECT` and `TEMPORARY` from
`PUBLIC` and grants only `CONNECT` to its exact public/admin principals and the
reviewed `postgres` operator principal. Runtime principals must not:

- own application objects;
- have `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, or `BYPASSRLS`;
- inherit `cloudsqlsuperuser`;
- have `CREATE` on `public`;
- receive privileges outside the exact matrix in
  `20260730000002_runtime_access.sql`.

Do not reuse a live principal that fails `scripts/cloudsql-verify.mjs`.
Provision a new principal and rotate the Cloud Run secret instead.

## Empty database bootstrap

The following commands show the order; connection details remain in
environment variables or Secret Manager and must not be placed in shell
history.

1. Connect with the administrative migration principal.
2. Apply `cloudsql/ops/bootstrap_roles.sql`.
3. Apply `cloudsql/ops/bootstrap_database.sql` to the target database.
4. For staging/production, apply
   `cloudsql/ops/attest_database_environment.sql` with the reviewed target.
5. Provision new environment-specific public/admin login or IAM principals.
6. Confirm both principals have safe role attributes and no
   `cloudsqlsuperuser` membership.
7. Before migration, run `cloudsql/ops/prelock_database_connect.sql` as the
   disposable bootstrap login. It revokes every `PUBLIC` database privilege
   and allows only the bootstrap login and `postgres` while the empty database
   is built.
8. Set `HUGMEID_EXPECTED_DATABASE` to the exact connected database and run the
   migration.
9. Revoke the bootstrap login's direct `CONNECT`, remove all of its
   schema-owner/capability membership and ownership paths, end its sessions,
   and delete it. Confirm a new bootstrap connection is denied.
10. Run `cloudsql/ops/bind_runtime_roles.sql` as `postgres`, with reviewed
    temporary ADMIN/SET edges needed only for this operation. The script
    requires `session_user=operator_login=postgres`, binds the exact
    public/admin principals, and compares all effective LOGIN roles before
    commit. Revoke the temporary ADMIN edges to the public/admin capability
    roles immediately afterward. Retain only the safe direct
    `hugmeid_schema_owner` edge (`ADMIN FALSE, INHERIT TRUE, SET TRUE`) because
    migration verification and preservation restore require it.
11. Run the final verifier:

   ```sh
   HUGMEID_DATABASE_ENV=staging \
   HUGMEID_EXPECTED_DATABASE=<staging-database> \
   npm run db:migrate -- --confirm-environment=staging
   # After bootstrap cleanup and bind_runtime_roles.sql:
   HUGMEID_PUBLIC_LOGIN_ROLE=<staging-public-principal> \
   HUGMEID_ADMIN_LOGIN_ROLE=<staging-admin-principal> \
   HUGMEID_OPERATOR_LOGIN_ROLE=postgres \
   HUGMEID_EXPECTED_DATABASE=<staging-database> \
   HUGMEID_DATABASE_ENV=staging npm run db:verify
   ```

   Production uses the same contract with `production` in both the attestation
   and `--confirm-environment=production`.
12. After the final verify/restore sequence, revoke the remaining
    `hugmeid_schema_owner` edge from `postgres`. In a separate connection,
    assert no temporary membership, ownership, direct ACL, default ACL, or
    active-session path remains.

The runner initializes `app_environment.database_environment`; operators do
not update the sentinel manually.

## Existing staging and production databases

Never apply the empty-database baseline to either existing database. Never
drop or rebuild either database in place.

Use a clone-and-cutover:

1. Record an on-demand backup or point-in-time-recovery checkpoint.
2. Apply `cloudsql/ops/attest_database_environment.sql` to the existing source
   database with its current environment. This metadata-only action makes the
   source identity independently verifiable; do not export from an unattested
   source.
3. Export a mode-0600 preservation bundle and its manifest from one
   repeatable-read, read-only snapshot:

   ```sh
   HUGMEID_DATABASE_ENV=production \
   HUGMEID_EXPECTED_DATABASE=<current-production-database> \
   npm run db:preserve -- export \
     --confirm-source-environment=production \
     --bundle=<secure-private-path>/production-preservation.json \
     --manifest=<secure-private-path>/production-preservation-manifest.json
   ```

   The bundle contains admin emails and audit snapshots. Never commit it,
   upload it to CI artifacts, or place it in a shared temporary directory.
   Store it in the approved encrypted backup location and record its external
   checksum and the printed canonical source bundle SHA-256 in the append-only
   release record.
4. Reconcile all `assets.bucket` / `assets.object_path` rows with Cloud Storage
   before copying them.
5. Create a new database and complete the empty-database bootstrap.
6. Restore only explicitly approved state with the migration/schema-owner
   principal, preserving primary keys and foreign keys:

   ```sh
   HUGMEID_DATABASE_ENV=production \
   HUGMEID_EXPECTED_DATABASE=<new-production-database> \
   HUGMEID_EXPECTED_SOURCE_DATABASE=<current-production-database> \
   HUGMEID_EXPECTED_SOURCE_ENVIRONMENT=production \
   HUGMEID_EXPECTED_SOURCE_BUNDLE_SHA256=<approved-canonical-sha256> \
   HUGMEID_PUBLIC_LOGIN_ROLE=<production-public-principal> \
   HUGMEID_ADMIN_LOGIN_ROLE=<production-admin-principal> \
   HUGMEID_OPERATOR_LOGIN_ROLE=postgres \
   npm run db:preserve -- restore \
     --confirm-environment=production \
     --bundle=<secure-private-path>/production-preservation.json \
     --source-manifest=<secure-private-path>/production-preservation-manifest.json \
     --manifest=<secure-private-path>/restored-production-manifest.json

   npm run db:preserve -- compare \
     --source=<secure-private-path>/production-preservation-manifest.json \
     --destination=<secure-private-path>/restored-production-manifest.json
   ```

   Restore refuses a non-empty preserved table and rolls the transaction back
   if the destination row, ID, or asset-reference hashes differ.
7. Verify at least one active, non-deleted owner exists.
8. Run `db:verify`, then public/admin smoke tests against the new target.
9. Rotate Cloud Run database principals/secrets to the new database.
10. Keep the old database recoverable and write-frozen until authenticated
   E2E, logs, and asset delivery pass. Once no live revision sends traffic to
   it, connect to a maintenance database (for example `postgres`) with the
   reviewed administrative principal, assert the exact old database name and
   zero active application connections, then set:

   ```sql
   ALTER DATABASE <old-database> ALLOW_CONNECTIONS false;
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname = '<old-database>'
     AND pid <> pg_backend_pid();
   ```

   Verify `pg_database.datallowconn = false` and zero remaining connections.
   `default_transaction_read_only = on` is not a write-freeze: a sufficiently
   privileged role or session can override it, and it does not evict existing
   sessions. `REVOKE CONNECT` is also insufficient unless every direct and
   inherited connection path has been audited.

   Rollback order is deliberate: first run
   `ALTER DATABASE <old-database> ALLOW_CONNECTIONS true` from the maintenance
   database, verify the old runtime principal can connect, and only then move
   Cloud Run traffic back to the retained old revision. Never send traffic to
   a revision while its database is still connection-frozen.

The pre-release production preservation set includes `admin_users`,
`admin_audit_logs`, and `assets`. Reference/catalog/content rows require an
explicit source-of-truth decision; a registered seed must not silently
overwrite restored values. Zero user rows do not authorize deleting
user-facing schema or consent/bookmark behavior.

The schema-state checksum intentionally excludes database ACLs because login
names are environment-specific operational state. `db:verify` checks that
state separately: no `PUBLIC` database privileges, exact current-database
`CONNECT` ACLs for the expected public/admin/operator logins, and no
cross-database connection for any other login inheriting either runtime
capability role.

Staging follows the same process. Inventory and approve disposal or
preservation of its admin/content/reference state before replacing it.

### Shared-role connectivity rollout

The runtime capability roles are cluster-global, so connectivity isolation must
be established on every application database before a new environment login is
treated as ready:

1. Record the exact pre-change `pg_database.datacl`, owner, attestation,
   sentinel, active sessions, and Cloud Run revision for each application
   database.
2. Apply `bind_runtime_roles.sql` to staging first in one transaction. Confirm
   staging public/admin and `postgres` can open new connections, while current
   production public/admin logins cannot.
3. Re-run staging `db:verify`, public health/read/authentication E2E, the
   applicable Admin smoke, and a control-plane backup check.
4. Provision production-v2 public/admin logins into undistributed Secrets.
   Immediately revoke any provider-created `cloudsqlsuperuser` edge and, from a
   separate connection, verify safe attributes, zero unexpected membership,
   ownership, and direct ACL. Do not expose either credential to Cloud Run.
5. Apply `restrict_legacy_database_connect.sql` to the live production-v1
   database. Preserve access only for its exact legacy public/admin logins and
   `postgres`. A database owned by Cloud SQL's LOGIN
   `cloudsqlsuperuser` also retains the reviewed provider control-plane
   connectors `cloudsqlsuperuser`, `cloudsqlagent`, and
   `cloudsqlimportexport`; the operation rejects every other application
   login. Prove staging and unpublished production-v2 logins cannot open a new
   production-v1 connection.
6. Only after staging and production-v1 are isolated, create, prelock, migrate,
   clean up the bootstrap, and bind production-v2. Confirm the full connection
   matrix: each database accepts only its own public/admin logins plus
   `postgres`; a retained `cloudsqlsuperuser`-owned legacy database may also
   retain only the provider control-plane exceptions listed above. Every other
   application login is denied.
7. Remove every bootstrap membership before bind. Retain only `postgres`'s safe
   direct schema-owner edge through final verify/restore, then revoke it and
   prove cleanup from a separate connection. A connected session surviving a
   revoke is not evidence that a new connection remains possible.

If the staging ACL change itself causes an outage, rollback is an
incident-only return to the recorded unsafe default: connect as the reviewed
operator through the maintenance database, assert the exact staging database
and recorded ACL/owner, `SET ROLE hugmeid_schema_owner`, revoke the new direct
runtime/operator grants, restore `CONNECT, TEMPORARY` to `PUBLIC`, then verify a
fresh staging runtime connection before moving traffic. Do not use this
rollback to bypass a failed cross-environment isolation gate.

A retained database with `ALLOW_CONNECTIONS=false` is not rollback-ready merely
because it is frozen. Apply its exact legacy ACL from the maintenance database
while it remains frozen, verify the catalog manifest, then enable connections
and test its retained runtime login before moving traffic.

## Destructive data gate

Before any production operation that drops columns/tables or omits data from a
clone, record:

- backup/PITR identifier;
- source and destination database identifiers;
- affected tables/columns and row counts;
- exported artifact location and checksum;
- asset-object reconciliation result;
- approver and timestamp;
- forward recovery procedure.

The removed `contents` attribution columns and legacy `bookmarks` table remain
in the immutable pre-release history. Their values must be exported or their
loss explicitly approved before the old database is retired.

## Future changes

- Add one `YYYYMMDDHHMMSS_description.sql` file per forward change.
- Never edit or renumber an applied baseline, migration, or seed.
- Do not put `BEGIN`/`COMMIT` in artifacts; the runner owns transactions.
- Keep destructive assertions and data preservation in the same migration.
- Update the runtime access policy with a new migration when a new caller
  needs privileges.
- Run `npm run test:cloudsql` against a dedicated `*_test` or `*_ci` database.
- Treat PostgreSQL engine and extension updates as a reviewed schema-state
  rebaseline event. Regenerate the expected manifest only from a disposable
  PostgreSQL 16 target, review the semantic diff (including extension
  versions and canonical definitions), then verify on a disposable Cloud SQL
  clone before updating a live environment.
- Roll back application revisions independently only when the schema remains
  backward-compatible; otherwise ship a reviewed forward repair.
