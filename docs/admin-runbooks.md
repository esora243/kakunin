# Admin App Operational Runbooks

This document covers the operational procedures required before launch handoff
per `docs/admin-management-app-spec.md` ("Operational Requirements" and
"Launch Scope And Later Roadmap"): owner recovery, cache invalidation failure handling,
deploy rollback, and database restore. It assumes the admin app (`admin/`) is
deployed as its own Cloud Run service on `run.app` or a custom hostname
such as `admin.hugmeid.com`, separate from the public app, per the spec's
Decision Summary. This checklist is verification-only:
GCP-side provisioning (Cloud Run, Cloud SQL, buckets, DNS, HTTPS Load Balancer,
and run/app networking) must be done by an operator with GCP access; no live
infrastructure mutations are performed here.

## GCP runtime contract

- Build and run `admin/` with Node.js 22.12.0 or newer.
- Deploy `admin/` as its own Cloud Run service; do not reuse the public
  Hugmeid service or its revision history.
- Choose one admin exposure model per environment:
  1. `run.app`-based direct service URL.
  2. custom admin hostname (example: `admin.hugmeid.com`) with explicit ingress/proxy.
- Ensure the chosen model enforces app-level Google OAuth/OIDC session checks and
  `admin_users` authorization.
- Cloud Run IAM is not itself an identity mechanism; for `run.app` direct access,
  `allUsers`/`allAuthenticatedUsers` can be used for reachability if every admin
  request is protected by app session + active `admin_users`.
- DNS is optional and not an auth control; obscured URLs and shared-password paths
  are not supported.
- Configure separate staging and production Cloud Run services and separate service
  IAM/ingress posture per exposure model.
- Attach the target Cloud SQL instance to the admin service, but use a separate
  environment-specific principal that inherits only
  `hugmeid_admin_runtime` and passes `scripts/cloudsql-verify.mjs`.
- Grant the admin Cloud Run runtime service account write access only to the
  environment's matching public asset bucket.
- Keep the public app's Cloud Run service read-oriented. Admin mutations must
  go through the admin app and invalidate public caches through
  `PUBLIC_APP_REVALIDATE_URL`.

## Environment variables

The admin app (`admin/.env.example`) requires its own values, separate from
the public app's (`.env.example`):

| Variable | Notes |
| --- | --- |
| `HUGMEID_DEPLOY_ENV` / `HUGMEID_DATABASE_ENV` | Same convention and same `app_environment` sentinel row as the public app — see `lib/db/environment.ts`. Must match the Cloud Run service's actual environment. |
| `PGUSER` | Must be the environment's verified admin principal (member of `hugmeid_admin_runtime`), never the public runtime principal. |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth client ID for admin sign-in. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret reference (Secret Manager). |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth callback URI used by the admin app; must match the deployed host (`run.app` or custom domain). |
| `ADMIN_SESSION_SECRET` | App-level admin session signing secret. |
| `ADMIN_LOCAL_AUTH_BYPASS_EMAIL` | Local development only. The app throws `AdminAuthError("local_bypass_not_allowed")` if this is set while `HUGMEID_DEPLOY_ENV` is not `local` (staging/production must not set it). |
| `GCS_PUBLIC_ASSET_BUCKET` / `GCS_PUBLIC_ASSET_BASE_URL` | Use a separate private bucket per environment (e.g. `hugmeid-public-assets-staging`, `hugmeid-public-assets-prod`). `GCS_PUBLIC_ASSET_BASE_URL` must point at the matching public app origin plus `/api/assets/public`, not a public `storage.googleapis.com` bucket URL. |
| `PUBLIC_APP_REVALIDATE_URL` / `REVALIDATE_ADMIN_SECRET` | Must point at the corresponding public app environment's `/api/admin/revalidate` endpoint, and the secret must match `REVALIDATE_ADMIN_SECRET` in that public app environment's own `.env`. Never share this secret across staging and production. |

Staging and production must use separate OAuth clients/secrets, separate Cloud SQL credentials, and separate asset buckets,
matching the public app's existing staging/production separation documented in
`docs/production-deployment-checklist.md`.

## Admin identity model

Production and staging admin access is intentionally tied to Google accounts,
with app-level Google OAuth/OIDC session proof:

- The operator authenticates through Google OAuth/OIDC; the app creates an
  admin session.
- Every protected admin request requires an active `admin_users` row for the session
  email.
- `admin_users` owns application role (`owner` / `editor`), active status,
  owner guardrails, and audit actor mapping.
- OAuth callback URI requirements:
  - For direct run.app: `<admin-run-url>/auth/callback`
  - For custom domain: `https://admin.hugmeid.com/auth/callback`

There is no compatibility login stack outside this model. Do not add Firebase,
Cloudflare Access, Auth0, public-app LINE sessions, query-token links, or
header-based shims as alternate admin identity sources. Public `run.app` reachability
is compatible only when OAuth/session + `admin_users` remains the sole admin identity gate.

## Owner recovery (total owner lockout)

Recovery from total owner lockout — every `admin_users` row with `role='owner'`
is `is_active=false`, or no owner row exists at all — is a manual
infrastructure operation, not an in-app self-service flow, per the spec. The
app itself cannot be used to fix this because every owner-only screen requires
an active owner identity to reach it, and the database has a deferred
constraint trigger (`admin_users_require_active_owner`, declared by
`cloudsql/baseline/20260730000000_schema.sql`) that refuses to commit any
transaction that would leave zero active owners — this is a backstop against
accidental lockout via the app, not a self-heal mechanism.

To recover:

1. Connect directly to the Cloud SQL instance with an operator/DBA credential
   (not the `hugmeid_admin_runtime` application capability role, which is exactly what's locked
   out) — e.g. `gcloud sql connect <instance> --user=<dba-user>` or via the
   Cloud SQL Auth Proxy.
2. Inspect the current state: `select id, email, role, is_active from admin_users order by created_at;`
3. Reactivate an existing owner, or promote an existing active editor to
   owner:
   ```sql
   update admin_users set role = 'owner', is_active = true where email = '<known-good-email>';
   ```
4. If no admin_users rows exist at all (e.g. fresh environment before the
   first owner was seeded), insert the first owner directly:
   ```sql
   insert into admin_users (email, role, is_active) values ('<owner-email>', 'owner', true);
   ```
5. Record this manual change as an audit trail outside the app (e.g. an
   incident note or ops changelog) — direct DB writes bypass
   `admin_audit_logs` since only the application writes there, so the manual
   recovery step itself will not appear in the in-app Audit Logs screen.
6. Confirm the affected operator can authenticate via the configured Google OAuth
   flow and has a matching active `admin_users` row; either condition missing
   keeps the account from reaching the admin app.

## Cache invalidation failure handling

Per the spec's "Cache Boundary": a publish-impacting mutation (see
`docs/admin-management-app-spec.md`'s cache invalidation table) may commit
successfully even if invalidating the public app's cache fails — the mutation
is not rolled back, but the failure must be visible and retryable.

How this is implemented:

- `admin/lib/cache-invalidate.ts` writes a pending
  `public_cache_invalidation_jobs` row in the same transaction as the public
  mutation. A rolled-back mutation therefore cannot leave a retry job, while
  a committed mutation cannot lose its invalidation request.
- After commit, the app calls the public app's `POST /api/admin/revalidate`.
  Success completes that exact job. Failure retains it as pending with its
  attempt count and last safe error code, and the calling route returns
  `{ ..., cacheWarning: true }`.
- Owners see pending failures on the Dashboard ("Cache invalidation retries"
  section) and can retry that immutable job ID in-app via the Retry button.
  `POST /api/dashboard/retry-cache` accepts only `{jobId}`; resource and tag
  scope are loaded from the database row rather than trusted from the client.
- Editors do not see a retry queue UI at launch, per the spec.

If retries keep failing (e.g. the public app is down, or
`REVALIDATE_ADMIN_SECRET` is misconfigured):

1. Run a valid-secret tag-based revalidation smoke check directly against the public app:
   ```sh
   curl -sS "$PUBLIC_APP_REVALIDATE_URL" \
     -X POST \
     -H "Content-Type: application/json" \
     -H "X-Admin-Revalidate-Secret: <REVALIDATE_ADMIN_SECRET>" \
   --data '{"tags":["contents"]}'
   ```
   Confirm response is `{"ok":true...}` (or an expected structured success payload).
2. Run an invalid-secret tag-based revalidation smoke check against the same endpoint:
   ```sh
   curl -sS "$PUBLIC_APP_REVALIDATE_URL" \
     -X POST \
     -H "Content-Type: application/json" \
     -H "X-Admin-Revalidate-Secret: invalid-secret" \
   --data '{"tags":["contents"]}'
   ```
   Confirm the response is rejected (401/403) and does not revalidate.
3. Retry the pending job from the owner Dashboard after correcting the public
   endpoint or secret. Do not delete, expire, or mark a pending row complete
   without a successful response from the public revalidation endpoint.
4. Confirm via the public app's `/contents`, `/jobs`, or `/activities` pages
   (whichever domain was mutated) that the change is now visible.

## Asset cleanup failure reconciliation

Storage cleanup is deliberately synchronous and bounded; there is no generic
cleanup worker. A failed delete emits a safe structured log with
`event=stored_object_cleanup_failed` and `resourceId=<bucket>/<object-path>`.
Upload rollback also emits the source object's bucket/path so an operator can
find the affected upload family.

1. Copy the exact `resourceId` from the structured log and confirm that its
   bucket matches the deployment environment. Never infer the bucket from a
   filename or delete across environments.
2. Inspect the database row before touching storage:
   ```sql
   select id, bucket, object_path, public_url, deleted_at, purged_at
   from assets
   where bucket = '<bucket>' and object_path = '<object-path>';
   ```
3. List the exact object and, for an upload-family rollback, only sibling
   objects beneath the same generated UUID prefix:
   ```sh
   gcloud storage ls "gs://<bucket>/<object-path>"
   ```
4. If the asset is still referenced or is not marked for purge, stop and fix
   the application state first. Otherwise delete only the reviewed exact
   object, then verify both the object absence and the corresponding database
   state. Record the command, operator, environment, and identifiers in the
   incident/release log.

## Deploy rollback

The admin app is deployed as its own Cloud Run service, independent from the
public app's rollback process (`docs/production-deployment-checklist.md`).

1. Cloud Run keeps prior revisions by default. To roll back, route 100% of
   traffic on the admin Cloud Run service back to the last known-good
   revision:
   ```sh
   gcloud run services update-traffic <admin-service-name> --to-revisions=<previous-revision>=100 --region=<region>
   ```
2. If the rollback is due to a bad database migration rather than a bad
   application build, do not edit an applied artifact or apply the
   empty-database baseline to the existing database. Follow
   `docs/cloudsql-rebaseline.md`: preserve the old target, restore/clone when
   needed, and ship a checksum-registered forward repair when the existing
   schema can be safely advanced.
3. Confirm the rolled-back revision's `/` (Dashboard) loads and its
   Environment Status panel reports the expected `deploy`/`database`
   environment labels before considering the rollback complete.
4. Record the rollback (what broke, which revision was restored) in the same
   place staging/production incidents are normally tracked for the public
   app, so both apps' operational history stays in one place.

## Database restore

The admin app shares the public app's Cloud SQL instance (per the spec's
Decision Summary: "Use the same production Cloud SQL database... with a
separate admin database user"), so database restore is a single shared
procedure covering both apps, not a separate admin-specific restore path.

1. Confirm automated Cloud SQL backups are enabled for the production
   instance (required per "Operational Requirements").
2. To restore: use Cloud SQL's point-in-time recovery or an on-demand backup
   to create a new instance (or clone), rather than restoring in place,
   unless an outage makes in-place restore unavoidable — this preserves the
   pre-restore state for forensics.
3. After restoring to a new instance, update both apps' `CLOUD_SQL_CONNECTION_NAME`
   (public app and admin app Cloud Run services) to point at the restored
   instance, and re-verify the `app_environment.database_environment`
   sentinel row matches each service's `HUGMEID_DATABASE_ENV` before serving
   traffic — a mismatch fails closed (`assertDatabaseEnvironmentSentinel` in
   `lib/db/postgres.ts` / `admin/lib/db/postgres.ts`) rather than silently
   serving from the wrong environment.
4. Bad-publish recovery for Contents specifically: unpublish the affected
   record from the admin app immediately (stops public visibility without
   needing a DB restore), inspect the content version history and
   `admin_audit_logs` for the `content.update` / `content.publish` rows, then
   restore the prior version in the admin UI. If the version snapshot is
   insufficient, restore the specific row's prior values from a database
   backup.

## Launch handoff checklist

Per the spec's "Launch handoff must include owner recovery, cache
invalidation, deploy rollback, and database restore runbooks" — this document
satisfies that requirement.

## Launch readiness checklist (external verification evidence)

Collect evidence in the release packet. Internal checks belong to the app-code
readiness section in `docs/production-deployment-checklist.md`.

- [ ] At least 2 active `owner` `admin_users` rows exist in the target environment.
- [ ] Cloud Run services are present and healthy (`READY=TRUE`) for both public/admin prod services in the expected project and region.
- [ ] Admin OAuth session model is configured for the selected exposure path
  (`run.app` or custom domain), and Google OAuth callback smoke test returns 302/200.
- [ ] Cloud SQL `app_environment.database_environment` matches production deploy/database labels before opening traffic.
- [ ] `REVALIDATE_ADMIN_SECRET` is identical in public and admin Cloud Run environments and is present for both services.
- [ ] `PUBLIC_APP_REVALIDATE_URL` is configured on the admin service and equals the expected public endpoint for the target environment.
- [ ] Admin Cloud Run invoker/ingress posture is documented and matches selected exposure:
  - `run.app` model: `allUsers`/`allAuthenticatedUsers` may be present to support browser access; OAuth session + `admin_users` remains the only admin identity gate.
  - restricted model: `allUsers`/`allAuthenticatedUsers` are absent from service invoker IAM because access is via explicit ingress/proxy.
- [ ] Public and admin Cloud Storage buckets are private; runtime service accounts use least-privilege IAM bindings only.
- [ ] `ADMIN_LOCAL_AUTH_BYPASS_EMAIL` is empty in staging/production admin service env.
- [ ] `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `ADMIN_SESSION_SECRET` are present in the admin service env.
- [ ] DNS, if configured, resolves the expected admin host and HTTPS certificate checks pass.
- [ ] Required rollback/restore/runbooks are documented and executable from this doc only.

### Evidence commands (copy into the runbook packet)

```sh
export PROJECT_ID="PROJECT_ID"
export REGION="us-west1"
export PUBLIC_SERVICE="hugmeid-web-production"
export ADMIN_SERVICE="hugmeid-admin-production"
export INSTANCE_NAME="INSTANCE_NAME"
export APP_DB="hugmeid"
export DBA_USER="dba-user"
export APP_BUCKET="hugmeid-public-assets-prod"

gcloud run services describe "$PUBLIC_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="table(status.url,status.traffic[0].percent,status.latestReadyRevisionName,status.conditions[0].status)"
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="table(status.url,status.traffic[0].percent,status.latestReadyRevisionName,status.conditions[0].status)"
gcloud run services get-iam-policy "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID"

export GOOGLE_OAUTH_REDIRECT_URI="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_REDIRECT_URI") | .value' | sed -n '1,1p')"
if [ -z "$GOOGLE_OAUTH_REDIRECT_URI" ]; then
  echo "GOOGLE_OAUTH_REDIRECT_URI is missing from staging/production admin service env."
  exit 1
fi
export GOOGLE_OAUTH_CLIENT_ID="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_CLIENT_ID") | .valueFrom.secretKeyRef.name // .value' | sed -n '1,1p')"
export GOOGLE_OAUTH_CLIENT_SECRET="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_CLIENT_SECRET") | .valueFrom.secretKeyRef.name // .value' | sed -n '1,1p')"
export ADMIN_SESSION_SECRET="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="ADMIN_SESSION_SECRET") | .valueFrom.secretKeyRef.name // .value' | sed -n '1,1p')"
[ -n "$GOOGLE_OAUTH_CLIENT_ID" ] || { echo "GOOGLE_OAUTH_CLIENT_ID is missing from staging/production admin service env."; exit 1; }
[ -n "$GOOGLE_OAUTH_CLIENT_SECRET" ] || { echo "GOOGLE_OAUTH_CLIENT_SECRET is missing from staging/production admin service env."; exit 1; }
[ -n "$ADMIN_SESSION_SECRET" ] || { echo "ADMIN_SESSION_SECRET is missing from staging/production admin service env."; exit 1; }

if [ -z "$GOOGLE_OAUTH_REDIRECT_URI" ]; then
  echo "GOOGLE_OAUTH_REDIRECT_URI is missing from staging/production admin service env."
  exit 1
fi

[[ "$GOOGLE_OAUTH_REDIRECT_URI" == *"/auth/callback" ]] || {
  echo "GOOGLE_OAUTH_REDIRECT_URI is not an OAuth callback URI: $GOOGLE_OAUTH_REDIRECT_URI"
  exit 1
}

if [[ "$GOOGLE_OAUTH_REDIRECT_URI" == *".run.app"* ]]; then
  echo "Exposure model check: run.app direct URL in use; service invoker IAM may include allUsers/allAuthenticatedUsers."
elif [[ "$GOOGLE_OAUTH_REDIRECT_URI" == "https://admin.hugmeid.com"* ]]; then
  echo "Exposure model check: custom hostname in use; confirm ingress/proxy restrictions and Cloud Run invoker restrictions."
  dig +short admin.hugmeid.com
  curl -sI "https://admin.hugmeid.com" | head -n 1
else
  echo "Exposure model check: verify custom hostname/URL and ingress model against documented strategy."
fi


export ADMIN_LOCAL_AUTH_BYPASS_EMAIL="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="ADMIN_LOCAL_AUTH_BYPASS_EMAIL") | .value' | sed -n '1,1p')"
[ -z "$ADMIN_LOCAL_AUTH_BYPASS_EMAIL" ] || { echo "ADMIN_LOCAL_AUTH_BYPASS_EMAIL must be empty in staging/production"; exit 1; }

gcloud sql connect "$INSTANCE_NAME" --user="$DBA_USER" --database="$APP_DB" --project="$PROJECT_ID" --quiet <<'SQL'
SELECT key, value FROM app_environment WHERE key IN ('database_environment');
\q
SQL
gcloud sql connect "$INSTANCE_NAME" --user="$DBA_USER" --database="$APP_DB" --project="$PROJECT_ID" --quiet <<'SQL'
SELECT COUNT(*) AS active_owner_count FROM admin_users WHERE role = 'owner' AND is_active = true;
SELECT COUNT(*) AS total_owner_rows FROM admin_users WHERE role = 'owner';
\q
SQL

gcloud run services describe "$PUBLIC_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="REVALIDATE_ADMIN_SECRET") | .valueFrom.secretKeyRef | [.name,.version,.key] | @tsv'
gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="REVALIDATE_ADMIN_SECRET") | .valueFrom.secretKeyRef | [.name,.version,.key] | @tsv'
gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="PUBLIC_APP_REVALIDATE_URL") | .value' | sed -n '1,1p'
export PUBLIC_APP_HOST="hugmeid.com"
export EXPECTED_PUBLIC_REVALIDATE_URL="https://$PUBLIC_APP_HOST/api/admin/revalidate"
export ADMIN_PUBLIC_APP_REVALIDATE_URL="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="PUBLIC_APP_REVALIDATE_URL") | .value' | sed -n '1,1p')"
[ "$ADMIN_PUBLIC_APP_REVALIDATE_URL" = "$EXPECTED_PUBLIC_REVALIDATE_URL" ] || { echo "PUBLIC_APP_REVALIDATE_URL mismatch: expected=$EXPECTED_PUBLIC_REVALIDATE_URL actual=$ADMIN_PUBLIC_APP_REVALIDATE_URL"; exit 1; }
export PUBLIC_APP_REVALIDATE_URL="$ADMIN_PUBLIC_APP_REVALIDATE_URL"
export ADMIN_REVALIDATE_SECRET="<staging/production-secret-value>"
curl -sS "$PUBLIC_APP_REVALIDATE_URL" -X POST -H "Content-Type: application/json" -H "X-Admin-Revalidate-Secret: $ADMIN_REVALIDATE_SECRET" --data '{"tags":["contents"]}'
curl -sS "$PUBLIC_APP_REVALIDATE_URL" -X POST -H "Content-Type: application/json" -H "X-Admin-Revalidate-Secret: invalid-secret" --data '{"tags":["contents"]}'

gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID"
gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="json" | jq -e '.bindings | all(.[]; (.members | any(. == "allUsers" or . == "allAuthenticatedUsers") | not))'
gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="json" | jq -r '.bindings[] | select(.role=="roles/storage.objectViewer" or .role=="roles/storage.objectCreator" or .role=="roles/storage.objectAdmin") | "ROLE=\(.role)", .members[]'

dig +short hugmeid.com
dig +short admin.hugmeid.com
curl -sI https://admin.hugmeid.com | head -n 1
```

### Verification output expectations

- [ ] Owner count matches the approved launch threshold for the environment.
- [ ] Active-owner count equals approved launch threshold, and total_owner_rows is recorded separately.
- [ ] `REVALIDATE_ADMIN_SECRET` secret refs match in Secret Manager name/version/key across public/admin services.
- [ ] Service invoker/buffer IAM bindings match the selected admin exposure posture; `run.app` can keep public invoker for reachability while OAuth/session + `admin_users` stays the identity boundary, restricted posture must keep IAM private.
- [ ] `PUBLIC_APP_REVALIDATE_URL` on admin service is compared to `EXPECTED_PUBLIC_REVALIDATE_URL`.
- [ ] Valid and invalid `/api/admin/revalidate` smoke checks are executed as part of release packet.
- [ ] No stale Firebase or Cloudflare Access references are used as an auth control in this procedure.
