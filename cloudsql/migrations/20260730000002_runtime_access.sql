-- Exact per-database privilege policy.
--
-- Runtime principals inherit one of the NOLOGIN capability roles created by
-- cloudsql/ops/bootstrap_roles.sql. They never own schema objects and never
-- receive CREATE on public.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_public_runtime') then
    raise exception 'missing cluster role hugmeid_public_runtime; run cloudsql/ops/bootstrap_roles.sql first';
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_admin_runtime') then
    raise exception 'missing cluster role hugmeid_admin_runtime; run cloudsql/ops/bootstrap_roles.sql first';
  end if;
end;
$$;

revoke create on schema public from public;
revoke all privileges on schema public from hugmeid_public_runtime, hugmeid_admin_runtime;
grant usage on schema public to hugmeid_public_runtime, hugmeid_admin_runtime;

revoke all privileges on all tables in schema public from public, hugmeid_public_runtime, hugmeid_admin_runtime;
revoke all privileges on all sequences in schema public from public, hugmeid_public_runtime, hugmeid_admin_runtime;
revoke all privileges on all functions in schema public from public, hugmeid_public_runtime, hugmeid_admin_runtime;

alter default privileges in schema public revoke all privileges on tables from public;
alter default privileges in schema public revoke all privileges on tables from hugmeid_public_runtime, hugmeid_admin_runtime;
alter default privileges in schema public revoke all privileges on sequences from public;
alter default privileges in schema public revoke all privileges on sequences from hugmeid_public_runtime, hugmeid_admin_runtime;
alter default privileges in schema public revoke all privileges on functions from public;
alter default privileges in schema public revoke all privileges on functions from hugmeid_public_runtime, hugmeid_admin_runtime;

grant select on
  public.app_environment,
  public.universities,
  public.clubs,
  public.specialties,
  public.job_categories,
  public.employment_types,
  public.activity_kinds,
  public.content_categories,
  public.jobs,
  public.activities,
  public.contents,
  public.syllabus_pages,
  public.syllabus_class_entries,
  public.syllabus_class_resources,
  public.syllabus_class_tasks
to hugmeid_public_runtime;

grant select, insert, update, delete on public.rate_limit_buckets to hugmeid_public_runtime;
grant select, insert, update on public.users to hugmeid_public_runtime;
grant select, insert, delete on
  public.user_club_memberships,
  public.user_desired_specialties,
  public.job_bookmarks,
  public.activity_bookmarks,
  public.content_bookmarks
to hugmeid_public_runtime;
grant select, insert, update on
  public.user_timetable_entries,
  public.user_class_task_statuses,
  public.user_class_memos,
  public.user_class_tags,
  public.user_notification_settings,
  public.inquiries
to hugmeid_public_runtime;
grant insert on
  public.syllabus_class_resources,
  public.syllabus_class_tasks
to hugmeid_public_runtime;
grant select, insert on public.user_legal_consents to hugmeid_public_runtime;

grant select on public.app_environment to hugmeid_admin_runtime;
grant select, insert, update on
  public.admin_users,
  public.assets,
  public.contents,
  public.content_categories,
  public.jobs,
  public.activities
to hugmeid_admin_runtime;
grant select, insert on
  public.admin_audit_logs,
  public.content_versions
to hugmeid_admin_runtime;
grant select, update on
  public.activity_kinds,
  public.job_categories,
  public.employment_types,
  public.syllabus_pages,
  public.syllabus_class_entries,
  public.inquiries
to hugmeid_admin_runtime;
grant select on
  public.universities,
  public.clubs,
  public.specialties,
  public.syllabus_class_resources,
  public.syllabus_class_tasks
to hugmeid_admin_runtime;
