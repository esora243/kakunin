-- Retire the pre-IA bookmark table after preserving every supported job bookmark.
-- The migration intentionally fails instead of discarding an unexpected legacy
-- content type so operators can inspect and migrate it explicitly.
do $$
declare
  unexpected_count bigint;
begin
  if to_regclass('public.bookmarks') is null then
    return;
  end if;

  execute $query$
    select count(*)
    from public.bookmarks
    where content_type is distinct from 'job'
  $query$ into unexpected_count;

  if unexpected_count > 0 then
    raise exception 'Cannot drop public.bookmarks: % unsupported legacy row(s) remain', unexpected_count;
  end if;

  execute $query$
    insert into public.job_bookmarks (user_id, job_id, created_at)
    select user_id, job_id, created_at
    from public.bookmarks
    where content_type = 'job'
    on conflict (user_id, job_id) do nothing
  $query$;

  if exists (select 1 from pg_roles where rolname = 'hugmeid_app') then
    execute 'revoke all privileges on table public.bookmarks from hugmeid_app';
  end if;
  if exists (select 1 from pg_roles where rolname = 'hugmeid_staging_app') then
    execute 'revoke all privileges on table public.bookmarks from hugmeid_staging_app';
  end if;

  execute 'drop table public.bookmarks';
end;
$$;
