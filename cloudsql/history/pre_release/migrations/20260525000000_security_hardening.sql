begin;

create table if not exists app_environment (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  check (key = 'database_environment'),
  check (value in ('local', 'staging', 'production'))
);

insert into app_environment (key, value)
values ('database_environment', 'local')
on conflict (key) do nothing;

create table if not exists rate_limit_buckets (
  namespace text not null,
  identity text not null,
  client_key text not null,
  count int4 not null default 0,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (namespace, identity, client_key),
  check (count >= 0)
);

create index if not exists rate_limit_buckets_reset_idx on rate_limit_buckets(reset_at);

create or replace function preserve_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'app_environment_updated_at'
      and tgrelid = 'app_environment'::regclass
  ) then
    create trigger app_environment_updated_at
    before update on app_environment
    for each row
    execute function preserve_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'jobs_apply_url_https_check'
      and conrelid = 'jobs'::regclass
  ) then
    alter table jobs
    add constraint jobs_apply_url_https_check
    check (apply_url is null or apply_url ~* '^https://');
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'syllabus_class_resources_url_https_check'
      and conrelid = 'syllabus_class_resources'::regclass
  ) then
    alter table syllabus_class_resources
    add constraint syllabus_class_resources_url_https_check
    check (url ~* '^https://');
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hugmeid_app') then
    execute 'create role hugmeid_app login';
  end if;
end;
$$;

grant usage on schema public to hugmeid_app;
revoke all privileges on all tables in schema public from hugmeid_app;
revoke all privileges on all sequences in schema public from hugmeid_app;
alter default privileges in schema public revoke all privileges on tables from hugmeid_app;

grant select on app_environment to hugmeid_app;
grant select, insert, update, delete on rate_limit_buckets to hugmeid_app;
grant select on universities, clubs, specialties, job_categories, employment_types to hugmeid_app;
grant select on jobs, syllabus_pages, syllabus_class_entries, syllabus_class_resources, syllabus_class_tasks to hugmeid_app;

grant select, insert, update on users to hugmeid_app;
grant select, insert, delete on user_club_memberships, user_desired_specialties, bookmarks to hugmeid_app;
grant select, insert, update on user_timetable_entries to hugmeid_app;
grant select, insert on syllabus_class_resources, syllabus_class_tasks to hugmeid_app;
grant select, insert, update on user_class_task_statuses, user_class_memos, user_class_tags, user_notification_settings to hugmeid_app;

grant usage, select on all sequences in schema public to hugmeid_app;
alter default privileges in schema public grant usage, select on sequences to hugmeid_app;

commit;
