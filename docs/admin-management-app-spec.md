# Hugmeid Admin Management App Specification

This document defines the target specification for the Hugmeid service
management surface. The goal is to let non-developer operators manage Hugmeid
content and operational data without opening Google Cloud Console, while keeping
the production system maintainable after the launch team changes.

## Decision Summary

- Build the admin surface as a separate application at `admin.hugmeid.com`.
- Deploy the admin app as a separate Cloud Run service from the public Hugmeid
  app.
- Use the same production Cloud SQL database, but with a separate admin database
  user and narrowly scoped write privileges.
- Treat the admin app as the only normal operating surface for Hugmeid-displayed
  data.
- Keep the public app read-oriented and avoid mixing public runtime concerns
  with back-office mutation flows.
- Include image upload in the initial admin scope.
- Use two role levels at launch:
  - `owner`: full administrative control, expected count is 2 users.
  - `editor`: content editing and publishing control, expected count is about
    10 users.

## Product Goal

The admin app should let service operators manage everything visible inside
Hugmeid with a clear operational boundary:

- Operators should not need Google Cloud Console for routine content updates.
- Public-facing data changes should be auditable.
- High-risk domains should have stricter permissions than editorial content.
- The launch release should make all display data observable, with owner-level
  editing for the domains that now have dedicated validation, audit logging, and
  cache invalidation paths.

The key design rule is:

> "Manage everything" does not mean "make every data domain fully editable in
> the same way."

The launch release exposes all Hugmeid display domains in the admin app, while
limiting write depth by operational risk and role.

## Architecture

### Services

| Surface | Host | Cloud Run service | Responsibility |
| --- | --- | --- | --- |
| Public app | `hugmeid.com` | Public Hugmeid service | User-facing LIFF/web experience |
| Admin app | `admin.hugmeid.com` | Admin Hugmeid service | Back-office content and data management |

### Database Boundary

- Public app and admin app use separate database credentials.
- Public database user should not gain broad admin write privileges.
- Admin database user should receive only the write privileges needed by admin
  features.
- Schema migrations should explicitly grant privileges to public and admin users
  separately.

### Cache Boundary

- Admin pages and admin API responses must be `no-store`.
- Public app data caches must be invalidated after admin changes that affect
  public pages.
- Cache invalidation failures must be visible to the admin user instead of being
  silently ignored.

Cache invalidation behavior:

| Mutation | Public impact | Required invalidation | Failure behavior |
| --- | --- | --- | --- |
| Save draft content | None until published | None | Save may proceed |
| Save published content | Existing public detail/list output changes | Contents list and content detail | Commit may proceed, but UI must show warning and enqueue retry |
| Publish content | New public item appears | Contents list and content detail | Commit may proceed, but UI must show warning and enqueue retry |
| Unpublish content | Public item disappears | Contents list and content detail | Commit may proceed, but UI must show warning and enqueue retry |
| Deactivate content | Public item disappears | Contents list, content detail, saved items if affected | Commit may proceed, but UI must show warning and enqueue retry |
| Change published slug | Public URL changes | Old detail, new detail, Contents list | Owner confirmation required; commit may proceed with warning/retry on invalidation failure |
| Replace content hero image | Public visual output changes | Content detail and any listing card using the image | Commit may proceed, but UI must show warning and enqueue retry |
| Asset logical delete | Public image may disappear | Affected content detail/list if asset is referenced | Block delete while referenced unless replacement is selected |
| Master data category update | Public labels/filters change | Contents list and affected detail pages | Commit may proceed, but UI must show warning and enqueue retry |

Retry jobs for failed invalidation should be visible to owners. Editors do not
need a full retry queue UI at launch.

## Authentication

The admin app uses Google account identity as the human identity provider at the
application layer, backed by Google OAuth/OIDC session cookies and `admin_users` as
the authorization and audit boundary. HTTPS is required for production admin
reachability, while DNS is only required for custom-domain reachability (run.app
requires HTTPS but no DNS).
The admin app must not rely on obscured URLs, shared passwords, or compatibility
login routes as the production security boundary.

Required:

- A production/staging identity perimeter that matches the chosen Cloud Run exposure
  model:
  - `run.app` direct URL path with no DNS, or
  - custom hostname (example: `admin.hugmeid.com`) with optional DNS.
- Google OAuth/OIDC session is required on the admin app; Google account
  security, MFA, account recovery, and suspicious-login controls are delegated to
  Google.
- Admin user records inside the application database are the final application
  allowlist, role source, and audit actor mapping.
- Disabled admin users must lose access without code changes.
- The application must establish an app-level session as the admin identity proof for
  every protected request and verify it against `admin_users`.
- The verified Google account email in the admin session must match an active
  `admin_users` row and is used as the audit actor identity.
- Staging and production must use separate OAuth client IDs and secrets plus separate
  `admin_users` data.
- Supported OAuth redirect URIs must include:
  - `https://<admin-host-or-run.app>/auth/callback`
  - `https://admin.hugmeid.com/auth/callback` when using a custom domain.
- DNS is optional under this architecture; `admin.hugmeid.com` is acceptable when a
  custom domain is in use, but not required for production identity security.

Ingress rules:

- Production and staging admin Cloud Run services must be reached through the
  exposure model documented for that environment.
- Direct Cloud Run `run.app` URLs are permitted only when that model explicitly
  accepts them and the app-level OAuth session + active `admin_users` enforcement is
  verified as the only production admin identity check.
- Missing or invalid OAuth session must return 403 before any admin data access.
- Spoofable request headers must never grant access by themselves.

Authorization model:

- `admin_users` answers "what may this operator do inside the product?"
- An admin session must map to an active `admin_users` row before every protected
  request.
- Owner/editor role, active/deactivated state, self-demotion guards, last-owner
  guards, and audit actor identity live in `admin_users`.

Session and deactivation rules:

- The app must re-check `admin_users.is_active` on every request or on a short
  server-side cache no longer than 5 minutes.
- Deactivated admin users must lose app access even if their OAuth session is
  still valid.

Not acceptable for production:

- Environment-variable password as the only admin authentication.
- Sharing the public app user session with the admin app.
- Granting all authenticated users admin access.
- Any parallel admin login route outside the Google OAuth/OIDC model.
- Firebase Auth, Cloudflare Access, public-app LINE auth, Auth0,
  service-specific shared secrets, or direct Cloud Run IAM as compatibility login
  paths.
- Keeping legacy headers, query params, or alternate route handlers that can admit
  an admin identity without a valid app session and an active `admin_users` row.

Local development may use a clearly marked local-only admin bypass, but that
bypass must be disabled in staging and production. Local bypass is not a
production compatibility mode.

## Roles And Permissions

### Owner

Owners have full control of the launch editable admin surfaces.

Allowed:

- Manage all launch editable domains.
- View all display domains.
- Create, update, publish, unpublish, and deactivate Contents records.
- Create, update, publish, unpublish, and deactivate Jobs records.
- Create, update, publish, unpublish, and deactivate Activities records.
- Update the safe School data controls exposed by the admin app: syllabus page
  effective dates / active flag and non-official class display overrides.
- Upload and delete images.
- Manage admin users.
- Edit master data.
- View audit logs.
- Update inquiry statuses.
- View operational status.

Not allowed:

- Bulk mutate or import School records outside the dedicated safe edit controls.
- Edit official School source rows that are locked by source policy.
- Bypass app-layer validation, audit logging, or public-cache invalidation for
  display-data changes.

Expected users:

- 2 people.

Owner guardrails:

- The system must prevent removing or deactivating the last active owner.
- Owners cannot demote or deactivate their own account.
- Admin-user changes require an explicit confirmation step.
- Destructive actions such as asset deletion and record deactivation require
  explicit confirmation.
- Owner actions must be audit logged the same way as editor actions.
- Recovery from total owner lockout is a manual infrastructure operation, not
  an in-app self-service flow.

### Editor

Editors manage editorial content and its publishing lifecycle.

Allowed:

- Create, update, publish, and unpublish Contents records.
- Upload images for Contents.
- View Jobs, Activities, School data, Assets, and public status.
- View Inquiry list metadata only.
- View their own recent activity where useful.

Not allowed:

- Manage admin users.
- Edit master data.
- Delete images.
- Edit Jobs, Activities, or School records.
- View Inquiry message bodies or personal contact fields.
- Update Inquiry statuses.
- View full audit logs unless explicitly approved later.

Expected users:

- About 10 people.

## Admin Domains

The admin app owns the operational view for all Hugmeid-displayed data.

| Domain | Examples | Launch depth |
| --- | --- | --- |
| Dashboard | Counts, alerts, recent changes, read-only environment status | Full |
| Contents | Articles, guides, FAQ, stories, sponsor stories | Full edit, approval, schedule, restore, and publish |
| Assets | Uploaded images | Upload, inspect, owner delete |
| Jobs | Job listings and recruiting opportunities | Owner full edit and publish; editor view-only |
| Activities | Events, campaigns, groups, programs | Owner full edit and publish; editor view-only |
| School | Syllabus, class data, materials, timetable display data | Owner safe edit controls; editor view-only |
| Inquiries | Contact, consultation, reports | Owner detail and status update; editor metadata only |
| Master Data | Universities, categories, clubs, specialties, employment types | Owner-only edit |
| Admin Users | Owner/editor management | Owner-only |
| Audit Logs | Admin change history | Owner-only |

## Launch Scope

### Included

The launch release includes:

- Admin authentication and role enforcement.
- Dashboard with publish-state and operational counts.
- Contents list.
- Contents create/edit screen.
- Contents review request and owner approval.
- Contents publish/unpublish/deactivate actions.
- Contents scheduled publishing through future `published_at`.
- Contents preview before publication.
- Contents version history and owner restore.
- Image upload for Contents hero images.
- Assets list with usage information when available.
- Jobs list, detail, create/edit, publish/unpublish, and deactivate.
- Activities list, detail, create/edit, publish/unpublish, and deactivate.
- School list, detail, syllabus page safe edit controls, and non-official class
  inline edit controls.
- Inquiries list for editors and owners.
- Inquiry detail and status update for owners only.
- Master data screens for owners.
- Admin user management for owners.
- Audit logging for all mutations.
- Public cache invalidation after publish-impacting changes.
- Read-only operational status display on the Dashboard.

### Deferred From Launch

Do not include these in the launch release:

- WYSIWYG editor.
- Advanced image library features.
- Complex multi-role permission matrix beyond owner/editor.
- Bulk import/export.
- Editor write access to Jobs, Activities, or School data.
- Bulk School import/editing and official-source mutation outside the safe edit
  controls.
- Mutable operational settings.

These can be added after the core operational boundary is proven.

## Contents Management

Contents is the primary editorial domain.

Supported content types:

- `article`
- `guide`
- `faq`
- `story`
- `sponsor_story`

Required fields:

- Title.
- Slug.
- Content type.
- Category.
- Body.
- Publish state.

Optional fields:

- Dek / summary.
- Hero image.
- Author or source.
- Source name.
- Source URL.
- Related Activity.
- Related Job.

Body format:

- Launch body storage is Markdown in `body_md`.
- Raw HTML input is not allowed.
- Rendered Markdown must be sanitized before display.
- Supported Markdown features should be limited to headings, paragraphs, lists,
  links, bold, italic, blockquotes, and images.
- Script, iframe, style, event-handler attributes, and arbitrary embedded HTML
  are not allowed.

Categories:

- Categories come from the `content_categories` table.
- Editors can select existing categories.
- Owners can manage categories through Master Data.
- Category creation from the content edit form is not allowed; owners manage
  categories through Master Data.

Slug rules:

- Slugs must be unique and URL-safe.
- Draft slugs can be edited freely until first publish.
- After first publish, slug changes are owner-only and require an explicit
  confirmation because they can break public links.
- Automatic redirects for changed slugs are not part of the launch release; the
  admin UI must warn about that limitation.

Published edit semantics:

- Editing a published Content record updates the live record when saved.
- The UI must clearly show when an edit will affect a currently published page.
- Save, Publish, and Unpublish are distinct actions.
- Version history is recorded on edit, and owners can restore a prior version
  into a draft workflow state with no `published_at` value.

Actions:

- Create draft content.
- Edit draft content.
- Edit published content.
- Preview.
- Request review.
- Approve.
- Publish.
- Schedule publish.
- Unpublish.
- Deactivate.
- Restore prior version.

Rules:

- Slugs must be unique.
- Physical deletion is not a normal content operation.
- Deactivation should use `is_active=false`.
- Public visibility should use a consistent combination of `is_active` and
  `published_at`.
- Publishing must invalidate public Contents caches.
- Source and attribution fields should not be invented by the admin UI.

## Image Upload

Image upload is included in the launch release.

Storage:

- Use Google Cloud Storage.
- Use a dedicated private asset bucket per environment.
- Example production bucket name: `hugmeid-public-assets-prod`.
- Public delivery goes through the public app's `/api/assets/public/<object-path>`
  proxy. The bucket itself must not be made public.
- Signed URLs are not used for normal public Hugmeid display images.
- Cloud CDN may be placed in front of the public app later, but launch URL
  generation must not depend on CDN availability.

Allowed use at launch:

- Contents hero images.

Upload rules:

- Allowed file types: JPEG, PNG, WebP.
- Maximum file size: 5 MB.
- Recommended image width: 1600 px or larger.
- Server generates storage object names.
- User-provided filenames must not become trusted storage paths.
- Object paths must be non-guessable and must not overwrite existing objects.
- File extensions must be normalized from validated content type.
- Uploaded image metadata should be recorded in an `assets` table.
- Uploaded image public URL can be saved to the target content record.
- Bucket IAM must allow read access only to the public app runtime service
  account and write access only to the admin app runtime service account.
- Admin write access to the bucket is limited to the admin service account.
- Uploaded objects must use `Cache-Control` suitable for immutable public image
  delivery because object paths are never overwritten.
- CORS is not required for normal image rendering, but if direct browser upload
  is used, CORS must allow only `admin.hugmeid.com`.

Permissions:

- Owners can upload and delete assets.
- Editors can upload assets for Contents.
- Editors cannot delete assets.

Validation:

- Validate MIME type and file size.
- Validate by content sniffing or image decoding, not by browser-provided MIME
  type alone.
- Strip metadata or re-encode images before public delivery where practical.
- Reject files that cannot be decoded as the claimed image type.
- Malware scanning is not required at launch if the server decodes/re-encodes
  images, but the storage design should leave room to add scanning later.
- Validate object path ownership.
- Validate that the final public URL is readable before publishing content that
  depends on it.

Cleanup:

- Automated unused-asset cleanup is not required at launch.
- Owners should be able to inspect assets and delete only when safe.
- Logical deletion must not remove a referenced object from public delivery.

## Data Model Requirements

Add or confirm these database concepts before implementation:

### `admin_users`

Tracks admin identities and role.

Minimum fields:

- `id`
- `email`
- `role`
- `is_active`
- `created_at`
- `updated_at`
- `created_by_admin_id`

Constraints:

- `email` must be unique.
- `role` must be one of `owner` or `editor`.
- At least one active owner must remain.

### `admin_audit_logs`

Tracks all admin mutations.

Minimum fields:

- `id`
- `actor_admin_id`
- `action`
- `resource_type`
- `resource_id`
- `before_snapshot`
- `after_snapshot`
- `metadata`
- `created_at`

### `assets`

Tracks uploaded files.

Minimum fields:

- `id`
- `bucket`
- `object_path`
- `public_url`
- `content_type`
- `byte_size`
- `checksum`
- `uploaded_by_admin_id`
- `created_at`
- `deleted_at`

Asset deletion is logical by default. Physical deletion from Cloud Storage is an
owner-only maintenance operation and must be audit logged.

### Existing Display Tables

Where practical, display tables should gain:

- `created_by_admin_id`
- `updated_by_admin_id`

If adding these to every table is too invasive for the launch schema, audit
logs still must record actor and resource changes.

## Publishing Semantics

Use one consistent publishing model across domains wherever possible:

- `is_active=false`: hidden/deactivated.
- `published_at is null`: draft.
- `published_at <= now()` and `is_active=true`: visible.
- `published_at > now()` and `is_active=true`: scheduled for future visibility.

Avoid adding a separate status enum unless a domain genuinely needs more
states. Contents uses approval state separately from public visibility.

## Audit Logging

Audit logging is mandatory for every admin mutation.

Log these events at minimum:

- First verified admin session per rolling dedupe window, recorded as an
  app-level admin access event.
- Admin user create/update/deactivate.
- Content create/update/publish/unpublish/deactivate.
- Asset upload/delete.
- Inquiry status update.
- Master data update.
- Jobs/Activities/School reads are not normally logged, but owner mutations in
  those domains must be logged.

Audit logs should capture enough before/after state to answer:

- Who changed it?
- What changed?
- When did it change?
- Which public resource could be affected?

Audit log requirements:

- Audit logs are append-only from the application perspective.
- Admin UI must not provide audit-log deletion.
- Retention target is at least 1 year.
- Mutation and audit-log write should happen in the same database transaction
  where practical.
- If a required audit write fails, the mutation should fail rather than proceed
  silently.
- Audit snapshots must redact sensitive Inquiry message bodies and personal
  contact fields unless those fields are strictly necessary for the event.
- Viewing full audit logs is owner-only.

## Inquiries

Inquiries may include sensitive personal or consultation content and need a
stricter rule than editorial content.

Launch status model:

| Status | Meaning | Terminal? |
| --- | --- | --- |
| `open` | Newly received or not yet handled | No |
| `in_progress` | Owner is reviewing or handling it | No |
| `closed` | Completed or no further admin action needed | Yes |

Allowed transitions:

- `open` -> `in_progress`
- `open` -> `closed`
- `in_progress` -> `closed`
- `closed` -> `in_progress` only when reopening is explicitly confirmed

Notifications:

- Launch status changes do not send user notifications.
- If notifications are added later, they need a separate user-facing copy and
  delivery policy.

Launch permissions:

- Owners can view inquiry list metadata, detail body, related resource IDs, and
  status.
- Owners can update inquiry status.
- Editors can view inquiry list metadata only: created time, intent, current
  status, and related public resource title when available.
- Editors cannot view message body, contact fields, raw user identifiers, or
  attachments.
- Editors cannot update inquiry status.

Audit rules:

- Owner inquiry detail reads should be audit logged.
- Inquiry status changes must be audit logged.
- Audit logs must avoid storing full inquiry message bodies unless required for
  a specific incident review.

Display rules:

- Mask raw user identifiers by default.
- Do not expose direct personal contact fields to editors.
- If attachments are added later, they are owner-only until a separate policy is
  defined.

## Master Data

Master Data is owner-editable at launch only for low-risk labels and display
ordering. It is not a general database editor.

| Table/domain | Launch operations | Editable fields | Guardrails |
| --- | --- | --- | --- |
| `content_categories` | Create, rename, reorder, deactivate if unreferenced | `code`, `name`, `display_order`, active flag if added | `code` unique and URL-safe; cannot deactivate while referenced by active Contents |
| `activity_kinds` | Rename, reorder only | `name`, `display_order` | No create/deactivate at launch |
| `job_categories` | Rename only | `name` | No create/deactivate at launch |
| `employment_types` | Rename only | `name` | No create/deactivate at launch |
| `universities` | View only | None | Public/profile data dependency is too broad for launch edits |
| `clubs` | View only | None | Profile data dependency is too broad for launch edits |
| `specialties` | View only | None | Profile data dependency is too broad for launch edits |

General rules:

- Physical deletion is not allowed from Master Data screens.
- Deactivation is allowed only when the table explicitly supports it and no
  active public or user records reference the row.
- Renames must preserve foreign-key identity.
- All changes require audit logs.
- Master Data screens should show reference counts before allowing changes.

## Preview

Contents must support preview before publish.

Preferred launch approach:

- Render preview inside the admin app using the same DTO and rendering rules as
  the public Contents detail page where practical.

Rules:

- Draft preview must not require the record to be public.
- Preview URLs must not be indexable.
- Preview must not leak draft content to unauthenticated public users.

## Navigation

Admin app top-level navigation:

- Dashboard
- Contents
- Jobs
- Activities
- School
- Inquiries
- Assets
- Master Data
- Admin Users
- Audit Logs

Visibility by role:

- Editors see Dashboard, Contents, Jobs, Activities, School, Inquiries, and
  Assets.
- Owners see all sections.
- Sections with read-only editor access should clearly communicate read-only
  status rather than showing disabled mutation controls everywhere.

## Operational Requirements

Required:

- Separate production and staging admin deployments.
- Separate production and staging asset buckets.
- Environment sentinels matching the existing public app database safety model.
- No public caching for admin app responses.
- Structured error states for failed saves, failed uploads, and failed cache
  invalidation.
- Admin app health check.
- Basic monitoring for failed mutations and upload errors.
- Automated Cloud SQL backups must be enabled for production.
- Restore procedure must be documented before launch.
- Bad publish recovery should be documented as "unpublish, inspect version
  history and audit logs, then restore the prior version or restore manually
  from database backup if needed."
- Admin deployment rollback path must be documented.
- Asset deletion recovery should rely on logical delete at launch; physical
  deletion is owner-only maintenance.
- Migration rollout must preserve public app compatibility.
- Launch handoff must include owner recovery, cache invalidation, deploy
  rollback, and database restore runbooks.

## Launch Scope And Later Roadmap

### Launch Release: Durable Operating Surface

- Separate admin app and domain.
- Owner/editor roles.
- Contents full editing, approval, scheduling, version history, and publishing.
- Image upload for Contents.
- Read/status surfaces for all major display domains.
- Owner Jobs and Activities editing.
- Owner safe School editing controls.
- Inquiry status management.
- Master data owner edit.
- Audit logs.
- Read-only operational status display on the Dashboard.

### Later Enhancements

- More detailed asset usage tracking.
- Richer preview and diffing.
- Optional WYSIWYG or structured block editor.
- Bulk import/export.
- Broader School data operations after a separate source-of-truth policy exists.

## Open Questions

- What exact email addresses should be initial owners?
