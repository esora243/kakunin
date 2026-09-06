# Production Deployment Checklist

This checklist is for the current Hugmeid Cloud Run staging and production rollout. It documents the required configuration and verification steps only; it does not authorize an actual deployment by itself.

## Scope and safety boundary

- This checklist is verification-only. It does **not** run or authorize GCP mutations.
- All checklist entries are operator verification checkpoints for someone with GCP, DNS, and Cloud SQL privileges.

## Required Environment

Configure these values in Cloud Run and in local `.env.local` only when needed for verification. Do not commit real values.

| Variable | Scope | Required for production | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | Browser | Yes | Display name. |
| `NEXT_PUBLIC_APP_DESCRIPTION` | Browser | Yes | Metadata description. |
| `NEXT_PUBLIC_SITE_URL` | Browser | Yes | Must be the production HTTPS origin. |
| `IMAGE_ALLOWED_REMOTE_HOSTS` | Build/server | Yes | Comma-separated allowlist of HTTPS image asset hostnames, for example a Google Cloud Storage or Cloud CDN hostname. |
| `GCS_PUBLIC_ASSET_BUCKET` | Server only | Required for admin-uploaded content images | Private bucket read by the public app's `GET /api/assets/public/...` proxy. Grant the public Cloud Run runtime service account `storage.objectViewer`; do not rely on `allUsers` public bucket access. |
| `HUGMEID_DEPLOY_ENV` | Server only | Yes | Must be `staging` on the staging Cloud Run service and `production` on the production service. |
| `HUGMEID_DATABASE_ENV` | Server only | Yes | Must match `HUGMEID_DEPLOY_ENV` and the Cloud SQL `app_environment.database_environment` sentinel; mismatches fail closed before database access. |
| `HUGMEID_EXPECTED_DATABASE` | Migration/verification only | Yes for DB operations | Exact database name independently checked with its DB-owned environment attestation before any non-local migration. Do not set on the Cloud Run runtime. |
| `HUGMEID_OPERATOR_LOGIN_ROLE` | Verification/restore only | Yes for DB operations | Must be the reviewed `postgres` administrative login retaining `CONNECT` after the target database revokes all `PUBLIC` database privileges. Do not set on Cloud Run. |
| `CLOUD_SQL_CONNECTION_NAME` | Server only | Yes | Cloud SQL instance connection name, for example `project:region:instance`. |
| `PGHOST` | Server only | Yes | Cloud Run Unix socket directory, `/cloudsql/<connection-name>`. |
| `PGPORT` | Server only | Yes | PostgreSQL port, normally `5432`. |
| `PGDATABASE` | Server only | Yes | Application database name. |
| `PGUSER` | Server only | Yes | Application database user. |
| `PGPASSWORD` | Server only | Yes | Store in Secret Manager, never commit. |
| `PGPOOL_MAX` | Server only | Optional | Per-instance PostgreSQL pool size. |
| `NEXT_PUBLIC_LIFF_ID` | Browser | Yes | LIFF app ID for the production LINE channel. |
| `NEXT_PUBLIC_LINE_LOGIN_URL` | Browser | Optional | External LINE Login URL for non-LIFF entry points, if used. |
| `LINE_CHANNEL_ID` | Server only | Yes | Used to verify LIFF ID tokens. |
| `LINE_CHANNEL_SECRET` | Server only | Required by LINE operations | Keep server-only even where current routes do not consume it yet. |
| `LINE_CHANNEL_ACCESS_TOKEN` | Server only | Required before push jobs | Future push/batch delivery token. |
| `SESSION_SECRET` | Server only | Yes | Use a high-entropy production-only secret. Rotating it invalidates existing Hugmeid sessions. |
| `GOOGLE_OAUTH_CLIENT_ID` | Server only | Yes | OAuth client ID for admin identity verification. Must be environment-specific and present in staging/production admin service env. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Server only | Yes | OAuth client secret for admin identity verification. Must be environment-specific and present in staging/production admin service env. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Server only | Yes | OAuth callback URL for the admin app (e.g. `https://admin.hugmeid.com/auth/callback` or run.app callback). |
| `ADMIN_SESSION_SECRET` | Server only | Yes | App session signing secret for admin runtime sessions. |
| `ADMIN_LOCAL_AUTH_BYPASS_EMAIL` | Server only | Local only | Must be unset outside local development; staging/production must reject any non-empty value. |
| `NEXT_PUBLIC_SYLLABUS_URL` | Browser | Optional | External syllabus link. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Browser | Yes | Public support contact. |

## Cloud Run

- Deploy the public app from the repository root with Cloud Build.
- Use Node.js 22.12.0 or newer for the public app Cloud Run build and runtime.
- Use `develop -> staging` and `main -> production`.
- A push to `main` runs the full Public/Admin CI gates and deploys production only after both jobs succeed.
- Pull requests and pushes to `develop`/`main` run Public/Admin tests with coverage gates. Newer non-production runs cancel stale runs for the same branch or pull request; `main` runs are never cancelled in progress.
- Coverage gates include every `lib/**/*.ts` module and every `app/api/**/route.ts` handler in both applications. Public school workspace logic is also included. Page and presentational component TSX remain outside line coverage until they have a component or browser test harness; lint, typecheck, and production builds still cover those files.
- The workflow can also be started manually with `workflow_dispatch` when a clean rerun is needed.
- GitHub Actions authenticates with Workload Identity Federation; do not store a service-account JSON key in GitHub Secrets.
- Before deployment, the job records the revision currently receiving 100% traffic and verifies that production uses `internal-and-cloud-load-balancing`, keeps its default `run.app` URL disabled, and is healthy through the external load balancer's canonical URL.
- The job creates an untagged candidate with `--no-traffic` and verifies that the exact revision reaches the Cloud Run `Ready` condition. The candidate is not exposed through a direct revision URL.
- The workflow starts the canary only while the recorded previous revision still receives 100% traffic, then routes 10% to the candidate and 90% to the previous revision.
- While the 10/90 allocation is active, the workflow makes at most 100 `/api/health` requests through the canonical production URL and requires the candidate release SHA to be observed successfully at least three times. Any non-200 response or request failure triggers an ownership-gated rollback and fails the deployment job.
- Immediately before promotion, the workflow re-reads traffic and requires the exact candidate=10%, previous=90% allocation. If another operator or deployment changed traffic, the job fails without mutating the external allocation.
- Promotion explicitly routes 100% traffic to the exact candidate revision and runs the canonical production `/api/health` check again.
- Before any rollback, the workflow re-reads traffic and restores the recorded previous revision only when the active allocation is an exact state owned by this rollout. If traffic is ambiguous or changed externally, rollback is suppressed so the external change is not overwritten.
- After a rollback command, the workflow verifies that the recorded previous revision is again the sole 100% traffic target and that the canonical production health check passes.
- Database migrations remain an explicit operator step and are never run by the application deploy workflow.
- Configure a `hugmeid-web-staging` Cloud Run service with `HUGMEID_DEPLOY_ENV=staging` and `HUGMEID_DATABASE_ENV=staging`.
- Configure a `hugmeid-web-production` Cloud Run service with `HUGMEID_DEPLOY_ENV=production` and `HUGMEID_DATABASE_ENV=production`.
- Configure all required environment variables and secrets on each Cloud Run service.
- Attach the Cloud SQL instance with `--add-cloudsql-instances`.
- Staging and production must use separate Cloud SQL database credentials, separate Cloud Run services, and separate LINE Login channels/LIFF apps.
- Staging and production must use separate private asset buckets. The public app serves admin-uploaded images through `/api/assets/public/<object-path>` after the runtime service account reads the object from Cloud Storage.
- Confirm `NEXT_PUBLIC_SITE_URL` matches the deployed origin for the target environment exactly.

## Cloud Armor profile mutation allowlist

The public edge policy denies unsupported HTTP methods before they reach Cloud Run. Profile creation and editing use the exact route `PUT /api/me/profile`; allow only that PUT while preserving the existing LINE-session DELETE exception.

Before updating priority 100, capture the current rule in the private release packet:

```sh
export PROJECT_ID="PROJECT_ID"
export EDGE_POLICY="hugmeid-public-edge-policy"

gcloud compute security-policies rules describe 100 \
  --security-policy="$EDGE_POLICY" \
  --project="$PROJECT_ID" \
  --format=yaml
```

Apply the reviewed expression:

```sh
gcloud compute security-policies rules update 100 \
  --security-policy="$EDGE_POLICY" \
  --project="$PROJECT_ID" \
  --action=deny-403 \
  --description="Deny unsupported HTTP methods except exact profile PUT and LINE session logout" \
  --expression="!(request.method == 'GET' || request.method == 'HEAD' || request.method == 'POST' || request.method == 'OPTIONS' || (request.method == 'PUT' && request.path.matches('^/api/me/profile$')) || (request.method == 'DELETE' && request.path == '/api/auth/line/session'))"
```

An unauthenticated same-origin smoke request must pass Cloud Armor and be rejected by the application with `401`, not edge `403`:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' \
  -X PUT 'https://app.hugmeid.com/api/me/profile' \
  -H 'Origin: https://app.hugmeid.com' \
  -H 'Content-Type: application/json' \
  --data '{"universityId":"invalid","graduationYear":2028}'
```

Rollback uses the captured rule or restores the previous expression exactly:

```sh
gcloud compute security-policies rules update 100 \
  --security-policy="$EDGE_POLICY" \
  --project="$PROJECT_ID" \
  --action=deny-403 \
  --description="Deny unsupported HTTP methods except exact LINE session logout" \
  --expression="!(request.method == 'GET' || request.method == 'HEAD' || request.method == 'POST' || request.method == 'OPTIONS' || (request.method == 'DELETE' && request.path == '/api/auth/line/session'))"
```

Evidence:
- [ ] Priority 100 contains the exact profile PUT exception and no broader PUT allowance.
- [ ] Unauthenticated profile PUT returns application `401` through the public hostname.
- [ ] An unrelated PUT still returns edge `403`.

### Admin Cloud Run

- Deploy the admin app from `admin/` as a separate Cloud Run service; do not deploy it into the public app service.
- Use Node.js 22.12.0 or newer for the admin Cloud Run build and runtime.
- Configure separate staging and production admin services, for example `hugmeid-admin-staging` and `hugmeid-admin-production`.
- Configure the admin app's own environment variables from `admin/.env.example`, including `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, `ADMIN_SESSION_SECRET`, `GCS_PUBLIC_ASSET_BUCKET`, `GCS_PUBLIC_ASSET_BASE_URL`, and public-app revalidation settings.
- Select one admin exposure model per environment (`run.app` or custom domain), and confirm the selected model is enforced consistently by DNS/ingress plus app auth session policy.
- Attach the same target Cloud SQL instance with `--add-cloudsql-instances`, but use a separate safe principal that inherits only `hugmeid_admin_runtime`.
- Use a separate private asset bucket per environment. Grant the admin Cloud Run runtime service account write access only to the matching bucket, and set `GCS_PUBLIC_ASSET_BASE_URL` to the matching public app origin plus `/api/assets/public`.
- Confirm `admin.hugmeid.com` or the environment-specific admin hostname points only to the admin Cloud Run service.

## Cloud SQL

- Follow `docs/cloudsql-rebaseline.md`; never apply the pre-release history or the empty-database baseline to an existing database.
- Apply registered baseline/migrations/seeds only through `scripts/cloudsql-migrate.mjs`.
- Verify versions, checksums, owners, role flags, memberships, and exact grants with `scripts/cloudsql-verify.mjs`.
- Use separate staging and production Cloud SQL databases or instances.
- Use separate least-privilege public/admin database principals and secrets for each environment. They inherit NOLOGIN capability roles and own no schema objects.
- Revoke `CONNECT` and `TEMPORARY` from `PUBLIC` on each application database. Grant only `CONNECT` to that environment's exact public/admin principals and the reviewed operator principal; verify other environment logins cannot establish a new connection.
- Provision production-v2 runtime logins only into undistributed Secrets, immediately remove any provider-created elevated membership and verify safety, then isolate the still-live production-v1 database with `restrict_legacy_database_connect.sql`. Prelock a new database before migration and run final runtime binding only after the disposable bootstrap login is fully removed.
- Let the migration runner initialize `app_environment`; a mismatched existing sentinel aborts.
- Keep the `rate_limit_buckets` table in the target Cloud SQL database so authenticated mutation limits are shared across Cloud Run instances.
- Keep database passwords out of browser code, logs, documentation, and client bundles.
- Keep the Cloud Run runtime service account scoped to the target Cloud SQL instance where possible.

## LINE

- Configure the LIFF app with the target deployed URL.
- Set `NEXT_PUBLIC_LIFF_ID` to the LIFF app ID for the target environment.
- Set `LINE_CHANNEL_ID` to the channel that issues the LIFF ID tokens.
- Keep channel secrets and access tokens server-only.
- Do not share LINE Login channels, LIFF app IDs, channel secrets, or access tokens between staging and production.
- Confirm the Route Handler session flow is `LIFF ID token -> /api/auth/line/session -> Hugmeid session cookie`.
- Do not expose raw `line_uid` in cookies, API responses, logs, or client state.

## Failure Modes

- Missing Cloud SQL config in local development keeps `/api/health` available with `db: "not_configured"` so local app boot can be distinguished from database setup.
- Missing Cloud SQL config in staging or production returns `db: "config_error"`.
- Missing or invalid `HUGMEID_DEPLOY_ENV`, missing or invalid `HUGMEID_DATABASE_ENV`, a staging/production label mismatch, or a Cloud SQL `app_environment` sentinel mismatch returns `db: "config_error"` before application data access.
- Public API routes that require Cloud SQL return generic service-unavailable responses when database config is missing.
- Missing `LINE_CHANNEL_ID` makes LINE ID token verification unavailable and returns a generic auth service error.
- Missing `SESSION_SECRET` prevents session creation and returns a generic session service error.

## App-code readiness (must pass before staging/prod handoff)

Run and record the result of:

```sh
npm run test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=moderate

cd admin
npm run test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev --audit-level=moderate
```

Do not deploy while any of these are failing. Run both root and admin commands with Node.js 22.12.0+.
A failing audit blocks production deployment, and any failing release-gate command must be fixed by a focused remediation PR before production deployment.

### Audit Remediation Status

The deploy-blocking gate is
`npm audit --omit=dev --audit-level=moderate`, matching CI and the dependencies
that ship in the runtime image. Keep a full `npm audit` result in the release
record as a separate development-tooling signal. Do not force an incompatible
transitive major under ESLint or its plugins merely to suppress a dev-only
advisory; remediate it through a compatible toolchain update and re-run lint.

## External launch readiness (verification evidence required)

Collect evidence for the following checks and keep it in the release packet.

### 1) Cloud Run service & revision health

```sh
export REGION="us-west1"
export PROJECT_ID="PROJECT_ID"
export PROD_SERVICE="hugmeid-web-production"
export ADMIN_SERVICE="hugmeid-admin-production"

gcloud run services describe "$PROD_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="table(metadata.name,status.conditions[0].type,status.conditions[0].status,status.traffic[0].percent,status.latestReadyRevisionName)"
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="table(metadata.name,status.conditions[0].type,status.conditions[0].status,status.traffic[0].percent,status.latestReadyRevisionName)"
```

Evidence:
- [ ] Production app service shows READY=TRUE with 100% traffic on one revision.
- [ ] Admin service shows READY=TRUE with expected revision names.
- [ ] Hostname resolution is checked separately in DNS readiness and does not rely on Cloud Run `status.url`.

### 2) OAuth/OIDC admin auth posture and routing

```sh
gcloud run services get-iam-policy "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="value(bindings[].role,bindings[].members[])" # runtime/service invoker IAM only
gcloud run services get-iam-policy "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" | jq '.bindings[] | {role, members}'
echo "Capture ADMIN_EXPOSURE=run.app|custom-domain from GOOGLE_OAUTH_REDIRECT_URI and validate posture in release notes."
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_REDIRECT_URI") | .value'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_CLIENT_ID") | .valueFrom.secretKeyRef.name'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_CLIENT_SECRET") | .valueFrom.secretKeyRef.name'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="ADMIN_SESSION_SECRET") | .valueFrom.secretKeyRef.name'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="ADMIN_LOCAL_AUTH_BYPASS_EMAIL") | .value'
export GOOGLE_OAUTH_REDIRECT_URI="$(gcloud run services describe "$ADMIN_SERVICE" --project="$PROJECT_ID" --region="$REGION" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="GOOGLE_OAUTH_REDIRECT_URI") | .value' | sed -n '1,1p')"
[[ "$GOOGLE_OAUTH_REDIRECT_URI" == *"/auth/callback" ]] || { echo "GOOGLE_OAUTH_REDIRECT_URI must point to admin OAuth callback."; exit 1; }

if [[ "$GOOGLE_OAUTH_REDIRECT_URI" == *".run.app"* ]]; then
  echo "Admin exposure model: run.app direct URL."
  echo "Allowed posture: IAM may be public (allUsers/allAuthenticatedUsers) while OAuth/session + admin_users is sole identity gate."
else
  echo "Admin exposure model: restricted/proxy model (custom host). Validate ingress/proxy controls and keep invoker private."
fi
```

Evidence:
- [ ] `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, and `ADMIN_SESSION_SECRET` are set in the admin service env.
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` points at the selected exposure model (run.app callback or `admin.hugmeid.com` callback).
- [ ] `ADMIN_LOCAL_AUTH_BYPASS_EMAIL` is not set in production/staging.
- [ ] Admin Cloud Run exposure matches one of the accepted postures:
  - `run.app` direct: IAM may include `allUsers`/`allAuthenticatedUsers` because admin app sessions + `admin_users` are the production identity gate.
  - restricted/proxy: IAM does not include `allUsers`/`allAuthenticatedUsers`; transport protection is via ingress/proxy controls.
- [ ] `admin.hugmeid.com` or alternative custom domain only if explicitly selected and DNS/ingress are documented.
- [ ] Admin access uses app-level Google OAuth/OIDC session + `admin_users` checks; no alternate production admin login route.
- [ ] Direct Cloud Run `run.app` URLs, IP-only URLs, obscured URLs, Firebase /
  Cloudflare Access / Auth0 / LINE public-app sessions, and shared-password paths are
  not documented or enabled as compatibility access paths.

### 3) Cloud SQL connection, credentials, and owner guardrail inputs

```sh
export INSTANCE_NAME="INSTANCE_NAME"
export CLOUDSQL_DB="hugmeid"
export CLOUDSQL_DBA_USER="DBA_USER" # operator credentials, not app runtime

gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(region,databaseVersion,settings.ipConfiguration.ipv4Enabled,state)"
gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format="table(name,type,host)" --filter="name~'hugmeid_(app|admin)'"
gcloud sql connect "$INSTANCE_NAME" --user="$CLOUDSQL_DBA_USER" --database="$CLOUDSQL_DB" --project="$PROJECT_ID" --quiet <<'SQL'
SELECT key, value FROM app_environment WHERE key IN ('database_environment','release_gate');
\q
SQL
gcloud sql connect "$INSTANCE_NAME" --user="$CLOUDSQL_DBA_USER" --database="$CLOUDSQL_DB" --project="$PROJECT_ID" --quiet <<'SQL'
SELECT COUNT(*) AS active_owner_count
FROM admin_users
WHERE role = 'owner' AND is_active = true;

SELECT COUNT(*) AS total_owner_rows
FROM admin_users
WHERE role = 'owner';
\q
SQL
```

Evidence:
- [ ] Instance is healthy (running/online).
- [ ] Separate public/admin runtime principals exist, pass `scripts/cloudsql-verify.mjs`, and inherit only their intended capability role.
- [ ] `app_environment` sentinel matches service environment.
- [ ] Active owner checks captured: active_owner_count = 2 for launch resilience target; total_owner_rows captured separately.
- [ ] Every operator who can complete OAuth sign-in to the admin service also has an active
  `admin_users` row with the intended role, and every active owner is represented
  in `admin_users` as active.

### 4) Private GCS IAM and asset access path

```sh
export APP_BUCKET="hugmeid-public-assets-prod"
export APP_RUN_SA="serviceAccount:hugmeid-web-runtime@${PROJECT_ID}.iam.gserviceaccount.com"
export ADMIN_RUN_SA="serviceAccount:hugmeid-admin-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud storage buckets describe "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="value(location,uniformBucketLevelAccess.enabled)"
gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="json"
gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="json" | jq -e '.bindings | all(.[]; (.members | any(. == "allUsers" or . == "allAuthenticatedUsers") | not))'
gcloud storage buckets get-iam-policy "gs://$APP_BUCKET" --project="$PROJECT_ID" --format="json" | jq -r '.bindings[] | select(.role=="roles/storage.objectViewer" or .role=="roles/storage.objectCreator" or .role=="roles/storage.objectAdmin") | "ROLE=\(.role)", .members[]'
```

Evidence:
- [ ] Public runtime has `storage.objectViewer` on `$APP_BUCKET` (matching `GCS_PUBLIC_ASSET_BUCKET`).
- [ ] Admin runtime has bucket write access on `$APP_BUCKET` (matching `GCS_PUBLIC_ASSET_BUCKET` used by `admin/lib/gcs.ts`).
- [ ] `allUsers` and `allAuthenticatedUsers` are absent from IAM bindings.
- [ ] `GCS_PUBLIC_ASSET_BASE_URL`/`GCS_PUBLIC_ASSET_BUCKET` are environment-consistent.

### 5) Revalidation endpoint and secret parity

```sh
gcloud run services describe "$PROD_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="REVALIDATE_ADMIN_SECRET") | "\(.name)\t\(.valueFrom.secretKeyRef.name)\t\(.valueFrom.secretKeyRef.version)\t\(.valueFrom.secretKeyRef.key)"'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="REVALIDATE_ADMIN_SECRET") | "\(.name)\t\(.valueFrom.secretKeyRef.name)\t\(.valueFrom.secretKeyRef.version)\t\(.valueFrom.secretKeyRef.key)"'
gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="PUBLIC_APP_REVALIDATE_URL") | .value'

export PUBLIC_APP_HOST="hugmeid.com"
export PUBLIC_REVALIDATE_URL="https://$PUBLIC_APP_HOST/api/admin/revalidate"
export ADMIN_PUBLIC_APP_REVALIDATE_URL="$(gcloud run services describe "$ADMIN_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="json" \
  | jq -r '(.spec.template.spec.containers[0].env // [])[] | select(.name=="PUBLIC_APP_REVALIDATE_URL") | .value' | sed -n '1,1p')"
[ "$ADMIN_PUBLIC_APP_REVALIDATE_URL" = "$PUBLIC_REVALIDATE_URL" ] || { echo "PUBLIC_APP_REVALIDATE_URL mismatch: expected=$PUBLIC_REVALIDATE_URL actual=$ADMIN_PUBLIC_APP_REVALIDATE_URL"; exit 1; }
export ADMIN_REVALIDATE_SECRET="(from admin .env secret value source)"
curl -sS "$PUBLIC_REVALIDATE_URL" -X POST -H "Content-Type: application/json" -H "X-Admin-Revalidate-Secret: $ADMIN_REVALIDATE_SECRET" --data '{"tags":["contents"]}'
curl -sS "$PUBLIC_REVALIDATE_URL" -X POST -H "Content-Type: application/json" -H "X-Admin-Revalidate-Secret: invalid-secret" --data '{"tags":["contents"]}'
```

Evidence:
- [ ] Public/admin `REVALIDATE_ADMIN_SECRET` env bindings reference the same Secret Manager name/version/key.
- [ ] Admin `PUBLIC_APP_REVALIDATE_URL` equals the expected public revalidation endpoint (`https://<public-host>/api/admin/revalidate`).
- [ ] `/api/admin/revalidate` smoke check succeeds with the correct secret and fails with an invalid secret.
- [ ] Optionally: `gcloud secrets versions list <secret-name> --project="$PROJECT_ID"` verifies active secret lifecycle and controlled rollout.

### 6) DNS and certificate readiness

```sh
export APP_HOST="hugmeid.com"
export ADMIN_HOST="admin.hugmeid.com"

dig +short "$APP_HOST"
dig +short "$ADMIN_HOST"
curl -sI "https://$APP_HOST" | head -n 1
curl -sI "https://$ADMIN_HOST" | head -n 1
echo | openssl s_client -connect "$ADMIN_HOST:443" -servername "$ADMIN_HOST" 2>/dev/null | openssl x509 -noout -dates -issuer -subject
```

Evidence:
- [ ] Public and admin hostnames resolve to expected LB IPs.
- [ ] HTTPS returns 200/30x with valid certificate chain and expected issuer/expiry.

## Cutover Steps

1. Confirm the latest `develop` commit is the intended staging release candidate.
2. Confirm all production-readiness PRs for the current rollout are merged and CI is green.
3. Complete the reviewed staging clone-and-cutover rehearsal from `docs/cloudsql-rebaseline.md`.
4. Run `npm run db:verify` against the new staging database and capture its evidence.
5. Deploy `develop` to `hugmeid-web-staging` with staging database credentials and staging LINE/LIFF credentials.
6. Confirm staging `/api/health` returns `db: "ok"` and `environment.deploy: "staging"`.
7. Smoke test staging LIFF login, `/api/me`, bookmarks, timetable, and class detail personal APIs.
8. Promote the verified commit to `main`.
9. Complete the reviewed production clone-and-cutover, preserving approved admin/audit/asset state and the old recoverable database.
10. Run `npm run db:verify` against the new production database and capture its evidence.
11. Push the reviewed release commit to `main`. GitHub Actions must pass Public/Admin verification, deploy an untagged `hugmeid-web-production` candidate at 0% traffic, verify its Cloud Run `Ready` condition, route candidate=10% and previous=90%, observe the candidate release SHA successfully at least three times within 100 canonical production `/api/health` requests, promote the candidate to 100%, and pass the canonical health check again. A canary or post-promotion health failure must roll traffic back only while the workflow still owns the expected allocation.
12. Smoke test production `/api/health`, LIFF login, `/api/me`, bookmarks, timetable, and class detail personal APIs.
13. Confirm no raw LINE identifiers, service keys, LINE tokens, or internal error details are visible in API responses.
14. Monitor Cloud Run and Cloud SQL logs for authentication, SQL, and server-only secret boundary errors.
