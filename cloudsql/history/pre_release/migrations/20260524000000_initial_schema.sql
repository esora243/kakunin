-- Hugmeid Cloud SQL PostgreSQL schema.
-- This is the app-owned schema for Cloud Run route handlers.

begin;

create extension if not exists pgcrypto;

do $$
begin
  create type line_friend_status as enum ('active', 'unsubscribed', 'unknown');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type syllabus_source_type as enum ('official', 'manual_user', 'manual_import');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region_code text,
  prefecture text,
  city text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  line_uid text not null unique,
  external_auth_uid uuid unique,
  line_login_provider text not null default 'line_login',
  gender text,
  university_id uuid references universities(id),
  graduation_year int4,
  is_profile_complete boolean not null default false,
  consent_marketing_at timestamptz,
  line_friend_status line_friend_status not null default 'unknown',
  push_enabled boolean not null default false,
  deactivated_at timestamptz,
  graduation_year_updated_at timestamptz,
  graduation_year_updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_club_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  club_id uuid not null references clubs(id),
  created_at timestamptz not null default now(),
  unique (user_id, club_id)
);

create table if not exists user_desired_specialties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  specialty_id uuid not null references specialties(id),
  created_at timestamptz not null default now(),
  unique (user_id, specialty_id),
  unique (user_id)
);

create table if not exists job_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employment_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  external_source text not null,
  external_id text not null,
  external_slug text,
  title text not null,
  job_category_id uuid not null references job_categories(id),
  employment_type_id uuid not null references employment_types(id),
  university_id uuid references universities(id),
  location_pref text,
  location_detail text,
  summary text,
  description_md text,
  company_name text,
  company_type text,
  salary_min int4,
  salary_display text,
  work_schedule text,
  requirements_summary text,
  requirements_list jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  published_at timestamptz,
  source_last_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  slug text,
  apply_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_source, external_id),
  check (salary_min is null or salary_min >= 0),
  constraint jobs_apply_url_https_check check (apply_url is null or apply_url ~* '^https://'),
  check (jsonb_typeof(requirements_list) = 'array'),
  check (jsonb_typeof(benefits) = 'array')
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_apply_url_https_check') then
    alter table jobs add constraint jobs_apply_url_https_check check (apply_url is null or apply_url ~* '^https://');
  end if;
end;
$$;

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid not null references jobs(id),
  content_type text not null default 'job',
  source_system text not null default 'cms',
  created_at timestamptz not null default now(),
  unique (user_id, content_type, job_id)
);

create table if not exists syllabus_pages (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  academic_year int4 not null,
  term_number int2 not null check (term_number between 1 and 4),
  source_kind text not null default 'ocr',
  source_file_url text,
  raw_text text,
  parsed_json jsonb,
  effective_start_date date,
  effective_end_date date,
  is_manual_override boolean not null default false,
  is_active boolean not null default true,
  source_last_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, academic_year, term_number, source_kind)
);

create table if not exists syllabus_class_entries (
  id uuid primary key default gen_random_uuid(),
  syllabus_page_id uuid not null references syllabus_pages(id) on delete cascade,
  class_key text not null,
  title text not null,
  instructor text,
  room text,
  location text,
  schedule jsonb not null,
  source_type syllabus_source_type not null default 'manual_user',
  created_by_user_id uuid references users(id),
  is_official boolean not null default false,
  is_active boolean not null default true,
  revision_no int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (syllabus_page_id, class_key),
  check (
    (source_type = 'official' and is_official = true)
    or (source_type <> 'official' and is_official = false)
  )
);

create table if not exists syllabus_class_revisions (
  id uuid primary key default gen_random_uuid(),
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  revision_no int not null,
  snapshot jsonb not null,
  changed_by_user_id uuid references users(id),
  change_note text,
  created_at timestamptz not null default now(),
  is_archived boolean not null default false,
  unique (syllabus_class_entry_id, revision_no)
);

create table if not exists syllabus_revision_prune_events (
  id uuid primary key default gen_random_uuid(),
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  removed_revision_ids jsonb,
  removed_count int not null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists user_timetable_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  color_label text,
  display_order int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, syllabus_class_entry_id)
);

create table if not exists syllabus_class_resources (
  id uuid primary key default gen_random_uuid(),
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  resource_type text not null check (resource_type in ('zoom_url', 'material_url', 'other_url')),
  title text,
  url text not null,
  is_active boolean not null default true,
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint syllabus_class_resources_url_https_check check (url ~* '^https://')
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'syllabus_class_resources_url_https_check') then
    alter table syllabus_class_resources add constraint syllabus_class_resources_url_https_check check (url ~* '^https://');
  end if;
end;
$$;

create table if not exists syllabus_class_tasks (
  id uuid primary key default gen_random_uuid(),
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  is_active boolean not null default true,
  created_by_user_id uuid references users(id),
  updated_by_user_id uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_class_task_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  syllabus_class_task_id uuid not null references syllabus_class_tasks(id) on delete cascade,
  status text not null default 'todo' check (status in ('todo', 'submitted', 'skipped')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, syllabus_class_task_id)
);

create table if not exists user_class_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, syllabus_class_entry_id)
);

create table if not exists user_class_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  syllabus_class_entry_id uuid not null references syllabus_class_entries(id) on delete cascade,
  label text not null,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, syllabus_class_entry_id, label)
);

create table if not exists user_notification_settings (
  user_id uuid primary key references users(id) on delete cascade,
  class_reminder_enabled boolean not null default true,
  class_reminder_minutes_before int not null default 30,
  task_due_reminder_enabled boolean not null default true,
  task_due_reminder_days_before int not null default 2,
  class_change_notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_line_uid_idx on users(line_uid);
create index if not exists rate_limit_buckets_reset_idx on rate_limit_buckets(reset_at);
create index if not exists users_university_idx on users(university_id);
create index if not exists users_graduation_year_idx on users(graduation_year);
create index if not exists jobs_category_idx on jobs(job_category_id);
create index if not exists jobs_emp_type_idx on jobs(employment_type_id);
create index if not exists jobs_univ_idx on jobs(university_id);
create index if not exists jobs_active_idx on jobs(is_active);
create unique index if not exists jobs_slug_unique_idx on jobs(slug) where slug is not null;
create index if not exists jobs_salary_min_idx on jobs(salary_min) where salary_min is not null;
create index if not exists jobs_location_pref_idx on jobs(location_pref) where location_pref is not null;
create index if not exists bookmarks_user_idx on bookmarks(user_id);
create index if not exists bookmarks_job_idx on bookmarks(job_id);
create index if not exists syllabus_pages_univ_term_idx on syllabus_pages(university_id, academic_year, term_number);
create index if not exists syllabus_class_entries_page_idx on syllabus_class_entries(syllabus_page_id);
create index if not exists syllabus_class_entries_user_idx on syllabus_class_entries(created_by_user_id);
create index if not exists syllabus_class_entries_active_idx on syllabus_class_entries(is_active);
create index if not exists syllabus_class_revisions_entry_created_idx on syllabus_class_revisions(syllabus_class_entry_id, created_at desc);
create index if not exists user_timetable_entries_user_idx on user_timetable_entries(user_id);
create index if not exists user_timetable_entries_class_idx on user_timetable_entries(syllabus_class_entry_id);
create index if not exists syllabus_class_resources_class_idx on syllabus_class_resources(syllabus_class_entry_id);
create index if not exists syllabus_class_tasks_class_idx on syllabus_class_tasks(syllabus_class_entry_id);
create index if not exists syllabus_class_tasks_due_idx on syllabus_class_tasks(due_at);
create index if not exists user_class_task_statuses_user_idx on user_class_task_statuses(user_id);
create index if not exists user_class_task_statuses_task_idx on user_class_task_statuses(syllabus_class_task_id);
create index if not exists user_class_memos_user_idx on user_class_memos(user_id);
create index if not exists user_class_tags_user_idx on user_class_tags(user_id);

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

create or replace function enforce_revision_no()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.revision_no is null then
      new.revision_no := 1;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.revision_no <= old.revision_no then
      raise exception 'revision_no must be greater than current version';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function create_trigger_if_missing(trigger_name text, table_name regclass, trigger_sql text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = trigger_name
      and tgrelid = table_name
  ) then
    execute trigger_sql;
  end if;
end;
$$;

select create_trigger_if_missing('app_environment_updated_at', 'app_environment'::regclass, 'create trigger app_environment_updated_at before update on app_environment for each row execute function preserve_updated_at()');
select create_trigger_if_missing('users_updated_at', 'users'::regclass, 'create trigger users_updated_at before update on users for each row execute function preserve_updated_at()');
select create_trigger_if_missing('universities_updated_at', 'universities'::regclass, 'create trigger universities_updated_at before update on universities for each row execute function preserve_updated_at()');
select create_trigger_if_missing('clubs_updated_at', 'clubs'::regclass, 'create trigger clubs_updated_at before update on clubs for each row execute function preserve_updated_at()');
select create_trigger_if_missing('specialties_updated_at', 'specialties'::regclass, 'create trigger specialties_updated_at before update on specialties for each row execute function preserve_updated_at()');
select create_trigger_if_missing('jobs_updated_at', 'jobs'::regclass, 'create trigger jobs_updated_at before update on jobs for each row execute function preserve_updated_at()');
select create_trigger_if_missing('job_categories_updated_at', 'job_categories'::regclass, 'create trigger job_categories_updated_at before update on job_categories for each row execute function preserve_updated_at()');
select create_trigger_if_missing('employment_types_updated_at', 'employment_types'::regclass, 'create trigger employment_types_updated_at before update on employment_types for each row execute function preserve_updated_at()');
select create_trigger_if_missing('syllabus_pages_updated_at', 'syllabus_pages'::regclass, 'create trigger syllabus_pages_updated_at before update on syllabus_pages for each row execute function preserve_updated_at()');
select create_trigger_if_missing('syllabus_entries_updated_at', 'syllabus_class_entries'::regclass, 'create trigger syllabus_entries_updated_at before update on syllabus_class_entries for each row execute function preserve_updated_at()');
select create_trigger_if_missing('user_timetable_entries_updated_at', 'user_timetable_entries'::regclass, 'create trigger user_timetable_entries_updated_at before update on user_timetable_entries for each row execute function preserve_updated_at()');
select create_trigger_if_missing('syllabus_class_resources_updated_at', 'syllabus_class_resources'::regclass, 'create trigger syllabus_class_resources_updated_at before update on syllabus_class_resources for each row execute function preserve_updated_at()');
select create_trigger_if_missing('syllabus_class_tasks_updated_at', 'syllabus_class_tasks'::regclass, 'create trigger syllabus_class_tasks_updated_at before update on syllabus_class_tasks for each row execute function preserve_updated_at()');
select create_trigger_if_missing('user_class_task_statuses_updated_at', 'user_class_task_statuses'::regclass, 'create trigger user_class_task_statuses_updated_at before update on user_class_task_statuses for each row execute function preserve_updated_at()');
select create_trigger_if_missing('user_class_memos_updated_at', 'user_class_memos'::regclass, 'create trigger user_class_memos_updated_at before update on user_class_memos for each row execute function preserve_updated_at()');
select create_trigger_if_missing('user_class_tags_updated_at', 'user_class_tags'::regclass, 'create trigger user_class_tags_updated_at before update on user_class_tags for each row execute function preserve_updated_at()');
select create_trigger_if_missing('user_notification_settings_updated_at', 'user_notification_settings'::regclass, 'create trigger user_notification_settings_updated_at before update on user_notification_settings for each row execute function preserve_updated_at()');
select create_trigger_if_missing('syllabus_class_entries_enforce_revision_no', 'syllabus_class_entries'::regclass, 'create trigger syllabus_class_entries_enforce_revision_no before insert or update on syllabus_class_entries for each row execute function enforce_revision_no()');

drop function create_trigger_if_missing(text, regclass, text);

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
