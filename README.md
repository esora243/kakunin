# Hugmeid Web

Hugmeid Web is a Next.js App Router application for the Phase 1 LIFF-based medical-student platform.

開発・リリース時のブランチ運用は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## Current Backend Contract

- LINE authentication uses a LIFF ID token posted to a Next.js Route Handler.
- The server verifies the token, resolves the Hugmeid user, and issues a signed httpOnly Hugmeid session cookie.
- Browser code must not receive raw `line_uid`, LINE tokens, or database credentials.
- Personal data APIs are scoped by the Hugmeid session `userId`.
- Private Cloud SQL tables are accessed from Route Handlers after session checks.
- Public Jobs, Activities, and Contents use canonical slug URLs.
- Saved Jobs, Activities, and Contents are account-backed in Cloud SQL.

## Local Development

1. Use Node.js 22.12.0 or newer.
2. Copy `.env.example` to `.env.local`.
3. Fill Cloud SQL, LINE, and session values for the environment you are testing.
4. Install dependencies and run the app:

```sh
npm install
npm run dev
```

## Verification Commands

Run these before opening a production-readiness PR:

```sh
npm run test
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=moderate
```

The runtime-only audit is intentionally listed as a release gate. A failure
blocks production deployment until a focused remediation PR lands and the
command passes. Record a full audit separately so development-tool advisories
remain visible, but do not force incompatible transitive versions underneath
the lint toolchain to make that report appear clean.

## Deployment

Use [docs/production-deployment-checklist.md](docs/production-deployment-checklist.md) for the Cloud Run, Cloud SQL, LINE, and cutover checklist.

Use the checksum-registered Cloud SQL workflow in
[`docs/cloudsql-rebaseline.md`](docs/cloudsql-rebaseline.md). New databases are
created with `npm run db:migrate` and checked with `npm run db:verify`; never
run the pre-release SQL history as a directory.
