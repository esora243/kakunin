-- Add explicit purge state to assets so purge becomes idempotent and visible.

begin;

alter table assets
  add column if not exists purged_at timestamptz;

create index if not exists assets_purged_idx on assets(purged_at);

commit;
