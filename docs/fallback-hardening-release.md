# Fallback hardening release operations

The migrations in this stack stop new invalid writes with `NOT VALID`
constraints. They intentionally do not repair existing production data and do
not validate those constraints. Complete the inventories below before merge or
deployment planning; validate each constraint in a later, separately approved
migration only after the inventory is empty.

## Job application readiness

Read-only inventory:

```sql
select id, slug, title, is_active, published_at, apply_url
from public.jobs
where is_active
  and published_at is not null
  and not (
    apply_url is not null
    and apply_url ~* '^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?))*(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?([/?#][^[:space:]]*)?$'
    and apply_url !~* '^https://[0-9]+([.][0-9]+)*([/:?#]|$)'
  )
order by published_at, id;
```

For each row, obtain and verify the job-specific HTTPS application URL, or
unpublish the job. Do not assign a shared fallback URL. Inventory repository-
external job sync writers as well; they must provide `apply_url` before setting
an active row's `published_at`.

After production repair is complete, create a new forward migration containing:

```sql
alter table public.jobs
  validate constraint jobs_active_published_apply_url_required;
```

## Timetable schedule integrity

Read-only inventory:

```sql
select id, class_key, title, schedule
from public.syllabus_class_entries
where is_active
and not (
  jsonb_typeof(schedule) = 'object'
  and schedule ? 'day'
  and jsonb_typeof(schedule -> 'day') = 'string'
  and schedule ->> 'day' in ('月', '火', '水', '木', '金')
  and schedule ? 'period'
  and jsonb_typeof(schedule -> 'period') = 'number'
  and schedule ->> 'period' ~ '^[1-6]$'
  and (not (schedule ? 'starts_at') or jsonb_typeof(schedule -> 'starts_at') in ('string', 'null'))
  and (not (schedule ? 'ends_at') or jsonb_typeof(schedule -> 'ends_at') in ('string', 'null'))
)
order by id;
```

Repair each row from its authoritative syllabus source or deactivate it. Do not
silently discard malformed rows in application responses. After the inventory
is empty, validate `syllabus_class_entries_schedule_shape_check` in a separate
forward migration.

## Public cache invalidation outbox

Every public-impacting Admin mutation creates a pending
`public_cache_invalidation_jobs` row in the same transaction. The request then
attempts invalidation immediately. Failed jobs remain pending without an expiry
and are retried individually by an owner from the Admin dashboard; retry input
contains only the job ID, while resource and tag data are read from the row.

There is intentionally no generic worker, lease, or backoff loop in this
release. A scheduled publication may therefore remain in the public cache for
the existing maximum five-minute TTL before becoming visible.
