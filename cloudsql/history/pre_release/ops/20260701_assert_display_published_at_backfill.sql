-- Verification for the unified display publish model backfill.

do $$
declare
  database_environment text;
  active_unpublished_jobs int;
  active_unpublished_activities int;
  active_unpublished_contents int;
begin
  select value into database_environment
  from app_environment
  where key = 'database_environment';

  if database_environment not in ('staging', 'production') then
    raise exception 'Refusing display published_at verification for database_environment=%', database_environment;
  end if;

  select count(*) into active_unpublished_jobs
  from jobs
  where is_active = true
    and published_at is null;

  if active_unpublished_jobs <> 0 then
    raise exception 'Expected zero active jobs with null published_at, found %', active_unpublished_jobs;
  end if;

  select count(*) into active_unpublished_activities
  from activities
  where is_active = true
    and published_at is null;

  if active_unpublished_activities <> 0 then
    raise exception 'Expected zero active activities with null published_at, found %', active_unpublished_activities;
  end if;

  select count(*) into active_unpublished_contents
  from contents
  where is_active = true
    and published_at is null;

  if active_unpublished_contents <> 0 then
    raise exception 'Expected zero active contents with null published_at, found %', active_unpublished_contents;
  end if;
end;
$$;
