# UI/UX review ledger

This ledger records the task, placement rationale, stronger alternatives, and verification status for every user-facing route. A route is not complete merely because it renders; it must let its intended user finish the route's primary task without implementation knowledge.

## Evaluation rules

1. The primary action must match the user's purpose, not a database entity or API operation.
2. Navigation must expose exactly School, Jobs, Activities, Contents, and Profile.
3. Technical identifiers, cache behavior, environment values, and integration metadata stay out of normal workflows.
4. Empty, loading, error, and incomplete-data states explain what the user can do next.
5. Destructive and publishing actions show consequences; publication is blocked when required readiness checks fail.
6. Mobile placement prioritizes thumb reach and persistent orientation; desktop placement favors scanning and parallel comparison.

## Public app

| Routes | Primary task | Placement and transition decision | Status |
| --- | --- | --- | --- |
| `/`, `/school` | Check the next class then use the timetable or syllabus | `/` resolves to the highest-frequency workspace. School contains exactly two tabs. Articles do not remain in School. | Owned by public rebuild branch |
| `/activities`, `/activities/groups/[id]` | Discover activities and open a relevant group/program/article | Activities is a persistent destination. Type switching stays local because it changes one collection, not global location. Missing destinations are shown as unavailable rather than exposing URL configuration. | In review |
| `/jobs`, `/jobs/[id]` | Find, compare, save, and apply to jobs | Jobs is promoted to persistent navigation. Filters remain on the list; apply/save remain on detail. Missing application destinations use user-facing recovery copy. | In review |
| `/contents` and content details | Read study articles, guides, interviews, and editorial stories | Contents is the fifth persistent discovery destination. Read-only material stays here even when a related signup lives in Activities. | Owned by public rebuild branch |
| `/saved` | Resume previously selected items | Saved is a Profile subflow. It must not occupy persistent navigation. | Owned by public rebuild branch |
| `/profile`, `/profile/edit`, `/register` | Establish identity and maintain personal information | Profile is persistent. Registration remains a focused step flow; edit is entered from profile and returns there. | In review |
| `/connect` | Get help or contact the operator | Global help icon is always available; FAQ and contact remain local tabs because both satisfy the same support intent. | In review |
| `/campaign`, `/campaign/[id]` | Discover and enter campaigns | Kept outside the five-item primary navigation until campaigns have a stable product grouping; reachable from contextual surfaces. Missing entry destinations use user-facing recovery copy. | In review |
| `/sponsors` | Understand partners and sponsorship options | Secondary informational route; reachable contextually rather than competing with daily tasks. | In review |

## Admin app

| Routes | Primary operator task | Placement and transition decision | Status |
| --- | --- | --- | --- |
| `/` | See what needs attention now | First destination. Counts link to actionable filtered lists. System diagnostics are collapsed below daily work. | Improved and rendered |
| `/contents`, `/contents/new`, `/contents/[id]`, `/contents/[id]/preview`, `/contents/[id]/versions` | Draft, review, preview, publish, and recover an article | List → editor → preview/history is one workflow. Slug and relation IDs are advanced fields. Required readiness blocks publication. | Improved |
| `/jobs`, `/jobs/new`, `/jobs/[id]` | Create and publish a complete job listing | List → editor/detail. Application destination is purpose-labelled; slug and sync metadata are advanced. Required readiness blocks publication. | Improved |
| `/activities`, `/activities/new`, `/activities/[id]` | Create and publish an activity with a valid participation path | List → editor/detail. Button purpose controls destination wording; slug is generated and advanced. Required readiness blocks publication. | Improved |
| `/school`, `/school/[id]` | Maintain syllabus and class data safely | School collection → detail. Human-readable schedule and class state stay primary. Source and sync details are collapsed. Per-class editing opens only on request. | Improved and rendered |
| `/inquiries`, `/inquiries/[id]` | Triage and resolve user requests | List filters support queue work. Detail owns status transition. Internal IDs are removed from the normal view. | Improved and rendered |
| `/assets` | Upload, find, retire, and completely remove media | Shared media belongs under operations. Preview and usage stay primary. Storage and purge terms are removed from operator copy. | Improved and rendered |
| `/master-data` and children | Maintain reusable choices | Owner-only secondary navigation. Labels explain where each choice appears. Database table names are removed. | Improved and rendered |
| `/admin-users` | Add, stop, and assign roles to operators | Owner-only management. Uses 運営メンバー, 管理責任者, and 編集メンバー consistently. | Improved and rendered |
| `/audit-logs`, `/audit-logs/[id]` | Investigate who changed what | Human-readable operation and resource summaries are primary. Raw snapshots are collapsed as technical detail. | Improved and rendered |
| auth denied, not-found, loading, error | Recover safely from system states | Each state must state what happened, whether work was saved, and the next safe action. | In review |

## Public rebuild ownership

- The attached Information Architecture document is the authority for public navigation and route ownership.
- Public implementation is progressing on another branch. This admin branch must not create a competing public shell or compatibility navigation.
- Deep-link decisions and any route removal belong to that rebuild. No alias or fallback route should be added here.

## Admin findings already corrected

- Translated the admin navigation from database-domain English to operator-facing Japanese.
- Added automatic slugs, purpose-based URL inputs, readiness checks, and publish blocking to the three publishing forms.
- Replaced related UUID entry with named activity and job selectors.
- Removed editable external sync identifiers from the normal job workflow.
- Replaced raw schedule JSON with weekday and period labels.
- Verified primary admin routes at desktop and 390 px mobile widths without page-level horizontal overflow.
