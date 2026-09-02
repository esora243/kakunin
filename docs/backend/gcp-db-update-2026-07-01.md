# GCP DB Update - IA Backend Rebuild

Date: 2026-07-01
Project: `vaulted-art-497110-m6`
Cloud SQL instance: `hugmeid-postgres`
Connection name: `vaulted-art-497110-m6:asia-northeast1:hugmeid-postgres`

## Applied Migration

- `cloudsql/history/pre_release/migrations/20260701000000_ia_backend_rebuild.sql`

## Staging

Database: `hugmeid_staging`
App user: `hugmeid_staging_app`
Environment sentinel: `staging`

Pre-apply extraction:

- IA tables present: none
- Legacy job bookmarks: `0`
- New job bookmarks: not present
- IA grants: `0`

Permission note:

- Existing `jobs`, `users`, and `bookmarks` tables are owned by `hugmeid_staging_app`.
- `hugmeid_staging_app` can reference `jobs` and `users`.
- `hugmeid_staging_app` did not have `CREATE` on schema `public`.
- Temporarily granted `CREATE` on schema `public` to `hugmeid_staging_app`, applied the migration, then revoked it.
- Post-revoke check confirmed `can_create_public: false`.

Post-apply extraction:

- IA tables present:
  - `activities`
  - `activity_bookmarks`
  - `activity_kinds`
  - `content_bookmarks`
  - `content_categories`
  - `contents`
  - `inquiries`
  - `job_bookmarks`
- Legacy job bookmarks: `0`
- New job bookmarks: `0`
- IA grant rows visible to staging check: `72`

Staging DB-backed local smoke:

- `/api/health`: `200`
- `/api/activities`: `200`
- `/api/contents`: `200`
- `/activities`: `200`
- `/contents`: `200`
- `/school`: `200`
- `/jobs`: `200`
- `/profile`: `200`
- `/connect`: `200`
- `/campaign`: `307` to `/activities`
- `/sponsors`: `307` to `/contents`
- `/saved`: `307` to `/profile`

## Production

Database: `hugmeid`
App user: `hugmeid_app`
Environment sentinel: `production`

Pre-apply extraction:

- IA tables present: none
- Legacy job bookmarks: `0`
- New job bookmarks: not present
- IA grants: `0`

Permission note:

- Existing `jobs`, `users`, and `bookmarks` tables are owned by `postgres`.
- Applied the migration with Cloud SQL import `--user=postgres`.

Post-apply extraction:

- IA tables present:
  - `activities`
  - `activity_bookmarks`
  - `activity_kinds`
  - `content_bookmarks`
  - `content_categories`
  - `contents`
  - `inquiries`
  - `job_bookmarks`
- Legacy job bookmarks: `0`
- New job bookmarks: `0`
- IA grant rows visible to production check: `16`

Production DB-backed local smoke:

- `/api/health`: `200`
- `/api/activities`: `200`
- `/api/contents`: `200`
- `/activities`: `200`
- `/contents`: `200`
- `/school`: `200`
- `/jobs`: `200`
- `/profile`: `200`
- `/connect`: `200`
- `/campaign`: `307` to `/activities`
- `/sponsors`: `307` to `/contents`
- `/saved`: `307` to `/profile`

## Local Verification

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed, `109/109`
- `npm run build`: passed

## Notes

- Existing placeholder campaign/content data was not migrated.
- Legacy job bookmark migration copied `0` rows in both staging and production.
- No secrets or connection passwords are stored in this document.
