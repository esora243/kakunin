-- Backfill pre-launch mock/seed display records to the unified publish model.
--
-- Public rows must have:
--   is_active = true
--   published_at is not null
--   published_at <= now()
--
-- This is intentionally a one-way cleanup. `published_at is null` means draft
-- or unpublished across admin-managed display domains.

begin;

do $$
declare
  database_environment text;
begin
  select value into database_environment
  from app_environment
  where key = 'database_environment';

  if database_environment not in ('staging', 'production') then
    raise exception 'Refusing display published_at backfill for database_environment=%', database_environment;
  end if;
end;
$$;

update jobs
set published_at = coalesce(published_at, synced_at, created_at, now()),
    updated_at = now()
where is_active = true
  and published_at is null;

update activities
set published_at = coalesce(published_at, synced_at, created_at, now()),
    updated_at = now()
where is_active = true
  and published_at is null;

update contents
set published_at = coalesce(published_at, created_at, now()),
    updated_at = now()
where is_active = true
  and published_at is null;

commit;
