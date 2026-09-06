# Cloud SQL staging rebaseline rehearsal — 2026-07-30

## Scope and decision

- Project: `vaulted-art-497110-m6`
- Instance: `hugmeid-postgres` (PostgreSQL 16.13)
- Source database: `hugmeid_staging`
- Destination database: `hugmeid_staging_v2`
- Production database and production Cloud Run services were read-only
  inspected and not changed.
- The approved option was to discard rows explicitly identified as
  `staging_dummy`. The old database and its backup remain recoverable.
- The only live service cut over was the staging public service
  `hugmeid-web`. `hugmeid-admin` was found to be the production admin service,
  so it was not changed or repurposed.

## Recovery and preservation evidence

- On-demand backup ID: `1785419135696`
- Backup operation:
  `fbbbf2c0-632b-4b7d-82ce-22ac0000002b`
- Backup description:
  `hugmeid-staging-rebaseline-pre-cutover-20260730`
- Source preservation bundle:
  `/private/tmp/hugmeid-staging-rebaseline.QAj5hL/source-preservation.json`
- Source manifest:
  `/private/tmp/hugmeid-staging-rebaseline.QAj5hL/source-preservation-manifest.json`
- Restored manifest:
  `/private/tmp/hugmeid-staging-rebaseline.QAj5hL/restored-preservation-manifest.json`
- Canonical source bundle SHA-256:
  `fe3f5a59467c6605760f7dd4c425b79895d0c0096d0162f2d55d07201911c266`
- Source/restored manifest comparison: match
- Preserved rows: `admin_users=1`, `admin_audit_logs=0`, `assets=0`
- Asset references: 0

The preservation directory was mode 0700 and its files were mode 0600. It was
not committed to the repository. A tar archive was stored as fixed version 1
of the dedicated Secret Manager secret
`hugmeid-staging-rebaseline-preservation-20260730`:

- archive SHA-256:
  `de34a3dbbeefd2883753a422b082939d6da4dc2d58fcde7748128872d72c3b5a`;
- re-downloaded archive SHA-256: exact match;
- extracted source, source-manifest, restored-manifest, and canonical bundle
  hashes: exact match;
- Secret IAM policy: no bindings;
- staging runtime service account: no access.

The durable encrypted recovery copy is the fixed Secret Manager version. The
mode-restricted local source directory and archive were convenience copies,
were never repository artifacts, and were deleted after explicit operator
approval on 2026-07-31.

## Explicitly omitted staging dummy state

The following source rows were tagged `staging_dummy` and were not migrated:

| Table or logical record set | Rows |
| --- | ---: |
| `jobs` | 4 |
| syllabus pages | 2 |
| syllabus entries | 8 |
| syllabus resources | 3 |
| syllabus tasks | 3 |

## Destination construction

The destination was built in this order:

1. Cluster capability roles.
2. Durable database/schema owner bootstrap.
3. Staging environment attestation.
4. Dedicated public/admin login principals and exact capability-role binding.
5. Baseline `20260730000000_schema.sql`.
6. Required lookup seed `20260730000001_required_lookups.sql`.
7. Runtime access migration `20260730000002_runtime_access.sql`.
8. Approved-state restoration and source/restored manifest comparison.

Database and `pgcrypto` ownership are held by the durable NOLOGIN
`hugmeid_schema_owner`. The temporary bootstrap principal owned zero databases,
schemas, relations, types, routines, or extensions and had zero direct object
ACL entries before it was deleted.

Post-restore destination counts were:

| Table | Rows |
| --- | ---: |
| `activity_kinds` | 6 |
| `content_categories` | 6 |
| `universities` | 1 |
| `clubs` | 5 |
| `specialties` | 11 |
| `job_categories` | 3 |
| `employment_types` | 3 |
| `schema_migrations` | 3 |
| `app_environment` | 1 |
| `admin_users` | 1 |
| all other application tables | 0 |

Final `db:verify` passed with schema-state checksum
`84e96cb792fe4ef4075300587df89e471605783208dbab328851231909ef4a42`.
Direct principal tests also confirmed:

- the public principal can read required lookup state and an empty jobs table;
- the public principal cannot read `admin_users` or create schema objects;
- the admin principal can read the one preserved admin and cannot create
  schema objects.

## Adversarial SQL review and local verification

Repeated independent adversarial reviews ended with no P0/P1 SQL finding.
Review-driven fixes included:

- removal of a Cloud SQL-forbidden role-attribute mutation;
- durable database/extension ownership and disposable-bootstrap assertions;
- exact PostgreSQL 16 membership-edge checks for `ADMIN`, `INHERIT`, and `SET`;
- fail-closed `psql` exit behavior;
- exact ownership, role-attribute, default-ACL, column-ACL, extension, and
  runtime-grant verification;
- narrow normalization of only Cloud SQL provider-managed `public` schema ACL
  rows, with a regression proving relation ACLs remain visible.

Verification results:

- clean PostgreSQL 16 Cloud SQL integration suite: pass;
- runtime-bind abnormal-role cases: rejected with exit 3;
- final repository test suite after the LIFF bridge: 169/169 passed;
- typecheck, lint, production build, and `git diff --check`: pass.

## Cloud Run cutover

The existing staging service was first deployed as a zero-traffic tagged
revision:

- service: `hugmeid-web`
- prior revision: `hugmeid-web-f752238`
- new revision: `hugmeid-web-dbv2-0730`
- destination DB: `hugmeid_staging_v2`
- runtime principal: `hugmeid_staging_public_v2`
- password Secret: `hugmeid-staging-public-v2-db-password`, pinned to version 1
- service account:
  `hugmeid-web-runtime@vaulted-art-497110-m6.iam.gserviceaccount.com`

Only that service account was granted Secret Accessor on the new public
password Secret. Before traffic moved, the new revision was Ready and returned:

- `/api/health`: 200
- `/api/jobs`: 200 with no rows
- `/api/profile/options`: 200 with the required lookup seed
- `/api/me` without a session: 401

Cloud SQL reported `max_connections=25`, 10 total connections, and zero
connections to either staging database at the cutover gate. Traffic was then
moved to `hugmeid-web-dbv2-0730` at 100%. The canonical staging URL repeated
the health/public/private-boundary smoke tests successfully. The public
`/jobs` page rendered with HTTP 200, and the new revision had no
severity-ERROR log entry in the post-cutover 30-minute window.

The `hugmeid-admin` service was read-only inspected and found to use production
sentinels, production DB `hugmeid`, production assets, production callbacks,
and production OAuth/session settings. It was left unchanged. The new staging
admin DB principal remains direct-DB verified but has no live Cloud Run
consumer; its Secret received no production service IAM binding.

## Real LINE authentication E2E and LIFF hotfix — 2026-07-31

A real LINE login exposed a staging-root LIFF callback defect: the external
secondary redirect returned without the callback query, so the existing
query-based condition did not initialize the LIFF SDK. The first candidate
revision was rolled back immediately after it produced no
`POST /api/auth/line/session` request.

The final minimal fix:

- makes the root bridge await the LIFF callback-initialization gate before
  navigating to `/school`;
- records only the constant `1` in transient `sessionStorage` before
  `liff.login()` so the secondary redirect initializes even when the query is
  removed;
- clears that marker after successful initialization and on initialization or
  synchronous login failure;
- stores no LINE identifier, token, OAuth state, or other personal data.

Repeated adversarial review found no release blocker. The final live-source
typecheck, lint, 132-test suite, and production build passed. The LIFF-specific
tests enforce source invariants, while the real E2E below proves the success
path; focused mocked behavior tests for initialization rejection, synchronous
login failure, and blocked storage remain recommended before the next
authentication change. The deployed revision is:

- revision: `hugmeid-web-liffbridge2-0731`;
- image digest:
  `sha256:15c0f88e2d37f0f06ee215fdf9e22664bc5005f62e23e41cf17f5c21bd87ffe0`;
- build ID: `9200e7d0-b674-4f37-affe-958280d39aef`;
- release marker: `f752238-liffbridge2-20260731`;
- traffic: 100%;
- database: `hugmeid_staging_v2`;
- service account:
  `hugmeid-web-runtime@vaulted-art-497110-m6.iam.gserviceaccount.com`.

The real authenticated E2E then confirmed:

- `POST /api/auth/line/session`: 200;
- authenticated profile rendering: pass;
- `/api/me`: 200;
- `/api/me/bookmarks`: 200 with an empty result;
- `/api/me/timetable`: 200 with an empty result;
- `DELETE /api/auth/line/session`: 200;
- following unauthenticated `/api/me`: 401.

After the browser session was closed, the exact newly-created user was deleted
inside the reviewed transaction using the API-returned UUID and a fresh
creation-time gate. The transaction locked the user and rate-limit tables,
checked all 19 currently-defined user foreign-key paths as cross-checked
against the release baseline, and deleted exactly one user. A separate
post-transaction check proved zero rows in the enumerated user-owned tables,
zero non-cascading user references, zero rows for the target rate-limit
identity, and zero direct, schema-usage, or role-set temporary owner paths.
Deleting the short-lived SQL user then closed any administrative re-grant
path. No token, cookie, OAuth state, LINE identifier, or other
credential/PII-bearing browser-storage content was captured; the only stored
datum introduced by the fix was the fixed sentinel `1`.

The canonical service then returned 200 for `/api/health`, `/api/jobs`, and
`/api/profile/options`, returned 401 for unauthenticated `/api/me`, and had no
severity-ERROR entries on the final revision in the checked one-hour window.

## Controlled asset-delivery fixture — 2026-07-31

A generated 95-byte PNG fixture was uploaded directly to the staging public
asset bucket under a unique key. Verification confirmed:

- anonymous direct Cloud Storage access: 403;
- staging asset proxy: 200 with `image/png`, the exact 95-byte body, expected
  cache control, and SHA-256
  `cbaab27a60f29c8511a4638cec06cce21d78c0efb688c268a2acb66822b4f899`;
- exact-generation deletion: pass;
- object and prefix lookup after deletion: 404;
- cache-busted staging proxy lookup after deletion: 404;
- `assets` table before and after the fixture: 0 rows.

The bucket's 604800-second soft-delete policy implies that the deleted
generation is recoverable for seven days; restoration of that soft-deleted
generation was not exercised. This fixture verified public proxy IAM, content
type, body integrity, the returned Cache-Control header, cache-busted
post-delete 404 behavior, and normal object cleanup. It deliberately did not
exercise the production `hugmeid-admin` upload, re-encoding, metadata, or
audit path.

## Local Admin integration E2E — 2026-07-31

The separate staging Admin deployment and staging Google OAuth client were not
retained. The uncreated OAuth client form was discarded, and the temporary
`hugmeid-admin-staging` Cloud Run service, its dedicated service account, and
that account's IAM bindings were deleted.

The Admin integration path was instead exercised from a loopback-only local
development server against the real staging-v2 database, staging asset bucket,
and canonical staging public revalidation endpoint. Before startup, an
independent runtime-principal connection verified:

- database `hugmeid_staging_v2`;
- database attestation `hugmeid-environment:staging`;
- `app_environment.database_environment=staging`;
- login `hugmeid_staging_admin_v2` with the sole direct membership
  `hugmeid_admin_runtime`;
- staging-only bucket, public asset proxy, and revalidation URLs.

The local bypass resolved the preserved active owner row. A generated 118-byte,
24-by-18 PNG then passed through the real Admin upload route. Verification
confirmed:

- Sharp re-encoded the body to 110 bytes;
- the DB byte size and SHA-256 matched the fetched proxy body;
- the proxy returned 200 and decoded as the expected 24-by-18 PNG;
- the Admin UI listed the exact owner, content type, size, and unused state;
- the owner-only cache retry returned `{ "ok": true }` and wrote
  `cache_invalidation_retry_succeeded`;
- a same-length invalid revalidation secret returned 401;
- owner soft-delete and purge wrote the expected ordered audit actions;
- the live GCS object was absent and a cache-busted proxy request returned 404
  after purge.

The application intentionally leaves a purged asset tombstone and immutable
audit rows. With explicit operator approval, a short-lived cleanup principal
received only a non-admin, non-inherited, SET-only membership edge to
`hugmeid_schema_owner`. A locked transaction rechecked the exact fixture UUID,
owner, bucket, object path, checksum, timestamps, zero references, and five-row
audit delta before deleting one asset row and five audit rows. The
operator-captured transient evidence SHA-256 was
`14742d431bf0141c55de9208cf00616c117c79cf79e2658ea4c1fc0cccef9f8b`;
the transient payload was deleted after post-checks and is not independently
re-hashable from the repository.
Post-cleanup checks confirmed `assets=0`, `admin_audit_logs=0`, no live object,
no cleanup membership or ownership, and no cleanup SQL user or role.

This proves local owner authorization and the real staging DB/GCS/public
revalidation integration. It does not prove Google OAuth, Admin session-cookie
behavior, Cloud Run Admin ingress/IAM, or a production-mode Admin deployment.
The deleted GCS generation remains recoverable for seven days under the bucket
soft-delete policy.

## Old target freeze and rollback

After the staging service was healthy on the destination:

- `hugmeid_staging` was set to `ALLOW_CONNECTIONS=false`;
- active connections to it were 0;
- the retained old runtime credential received
  `database "hugmeid_staging" is not currently accepting connections`;
- `hugmeid_staging_v2` remained connectable;
- the canonical staging `/api/health` remained 200.

Rollback order:

1. Provision a short-lived administrative Cloud SQL principal and Secret using
   the same reviewed bootstrap controls.
2. Connect to maintenance DB `postgres`, assert that the literal target is
   `hugmeid_staging`, and run:

   ```sql
   ALTER DATABASE hugmeid_staging ALLOW_CONNECTIONS true;
   ```

3. Verify `hugmeid_staging_app` can connect.
4. Move `hugmeid-web` traffic to retained revision
   `hugmeid-web-f752238`.
5. Re-run health, public-read, authentication, and log checks.

Do not move traffic before re-enabling old-database connections.

## Temporary credential cleanup

- SQL user `hugmeid_staging_bootstrap_20260730`: deleted
- Secret `hugmeid-staging-bootstrap-20260730-db-password`, version 1:
  disabled and destroyed
- SQL user `hugmeid_staging_auth_cleanup_20260731`: deleted
- Secret `hugmeid-staging-auth-cleanup-20260731-db-password`, version 1:
  disabled, destroyed, and the Secret resource deleted
- SQL user `hugmeid_staging_verify_20260731`: deleted
- Secret `hugmeid-staging-verify-20260731-db-password`, version 1:
  disabled, destroyed, and the Secret resource deleted
- SQL user and database role
  `hugmeid_staging_e2e_cleanup_20260731`: deleted
- temporary cleanup/verification role-membership edges after revocation: 0
- checked ownership and direct-object-ACL categories before deletion: 0
- temporary cleanup/verification roles after user deletion: 0
- temporary password files, executed cleanup/verification SQL, and Admin E2E
  fixture/evidence captures: deleted
- full post-E2E `db:verify`: pass with checksum
  `84e96cb792fe4ef4075300587df89e471605783208dbab328851231909ef4a42`
- Post-cleanup canonical staging `/api/health`: 200

The source database, old runtime user/Secret, old Cloud Run revision, backup,
and dedicated Secret Manager preservation version were not deleted. The local
private preservation directory and archive were deleted after their hashes
and the durable Secret version had been verified.

## Residual release gates

The staging database rebaseline, public Cloud Run cutover, real authenticated
LINE E2E with exact cleanup, controlled asset-proxy fixture, preservation
storage, and final schema verification are complete with no known release
blocker in those gates.

Remaining boundaries are explicit:

- production cutover remains a separate operator decision and was not
  performed;
- production `hugmeid-admin` remained untouched; local Admin covered its
  upload, re-encoding, metadata, audit, purge, and revalidation integration,
  but Google OAuth, session-cookie behavior, Cloud Run Admin ingress/IAM, and
  production-mode deployment remain unverified;
- the bucket's soft-delete policy implies seven-day recoverability for the
  deleted fixture generation, but restoration was not exercised;
- the old frozen staging database, rollback revision, old runtime credential,
  backup, and dedicated preservation Secret remain intentionally retained.
