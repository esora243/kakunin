# Hugmeid Admin

Back-office admin app for Hugmeid, implementing `../docs/admin-management-app-spec.md`.
Deployed as a separate Cloud Run service from the public app, at `admin.hugmeid.com`
or directly by `run.app` as configured for the target deployment.
Authentication is app-level Google OAuth/OIDC with an active `admin_users` row;
see the spec for the full product and security requirements.

## Local development

```
cp .env.example .env.local
npm install
npm run dev
```

The app listens on port 3100 by default so it can run alongside the public app
(port 3000) during local development.

### Authentication

Production and staging enforce Google OAuth/OIDC sessions. Operators must reach the
admin service through the chosen exposure model:
- `https://<run.app-domain>/auth/callback` for direct Cloud Run URLs, or
- `https://admin.hugmeid.com/auth/callback` for custom-domain deployments.
Configure the matching Google OAuth client values and callback URL in
`admin/.env.example` (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`), and the app session secret in
`ADMIN_SESSION_SECRET`.

The production authorization model is intentionally two-layered:

- Google account OAuth session is the outer perimeter.
- `admin_users` decides the application role, active/deactivated state, and
  audit actor identity.

Both checks are required: a valid admin OAuth session and an active `admin_users`
row. Direct Cloud Run `run.app` entry is supported only if ingress/IAM and OAuth
session enforcement are explicitly configured for that model. Firebase/Auth0/
Cloudflare-style parallel login routes, shared passwords, and the public app's user
session are not supported compatibility paths for admin access.

For local development without OAuth/OIDC identity, set `ADMIN_LOCAL_AUTH_BYPASS_EMAIL` in
`.env.local` to an email address that matches an active row in `admin_users`.
This bypass is refused outside `HUGMEID_DEPLOY_ENV=local` — see
`lib/auth/access.ts`.

## Database

Uses the same Cloud SQL database as the public app through a separate
environment-specific principal that inherits `hugmeid_admin_runtime`. Never
reuse the public runtime principal. See
`../docs/cloudsql-rebaseline.md` for provisioning and verification.

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run test`

## Operational docs

See `../docs/admin-runbooks.md` for owner recovery, cache invalidation
failure handling, deploy rollback, and database restore procedures.
