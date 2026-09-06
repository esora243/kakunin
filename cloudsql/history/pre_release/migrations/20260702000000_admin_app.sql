-- Admin management app schema: admin identities, audit log, uploaded assets,
-- and the scoped hugmeid_admin database role.
-- See docs/admin-management-app-spec.md.

begin;

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('owner', 'editor')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_admin_id uuid references admin_users(id)
);

create table if not exists admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_admin_id uuid references admin_users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  object_path text not null,
  public_url text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size int8 not null check (byte_size > 0 and byte_size <= 5242880),
  checksum text not null,
  uploaded_by_admin_id uuid references admin_users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket, object_path)
);

alter table contents add column if not exists created_by_admin_id uuid references admin_users(id);
alter table contents add column if not exists updated_by_admin_id uuid references admin_users(id);
alter table contents add column if not exists approval_status text not null default 'draft'
  check (approval_status in ('draft', 'in_review', 'approved', 'changes_requested'));
alter table contents add column if not exists approval_requested_by_admin_id uuid references admin_users(id);
alter table contents add column if not exists approval_requested_at timestamptz;
alter table contents add column if not exists approved_by_admin_id uuid references admin_users(id);
alter table contents add column if not exists approved_at timestamptz;
alter table content_categories add column if not exists is_active boolean not null default true;

create table if not exists content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references contents(id) on delete cascade,
  version_no int not null,
  snapshot jsonb not null,
  created_by_admin_id uuid references admin_users(id),
  created_at timestamptz not null default now(),
  unique (content_id, version_no)
);

create index if not exists admin_users_role_idx on admin_users(role);
create index if not exists admin_audit_logs_actor_idx on admin_audit_logs(actor_admin_id);
create index if not exists admin_audit_logs_resource_idx on admin_audit_logs(resource_type, resource_id);
create index if not exists admin_audit_logs_created_idx on admin_audit_logs(created_at desc);
create index if not exists content_versions_content_idx on content_versions(content_id, version_no desc);
create index if not exists assets_uploaded_by_idx on assets(uploaded_by_admin_id);
create index if not exists assets_deleted_idx on assets(deleted_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_users_updated_at') then
    create trigger admin_users_updated_at before update on admin_users for each row execute function preserve_updated_at();
  end if;
end;
$$;

-- Enforce "at least one active owner" at the database level as a backstop
-- behind the application-level guardrail.
create or replace function admin_users_require_active_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from admin_users where role = 'owner' and is_active = true) then
    return null;
  end if;
  raise exception 'at least one active owner admin_users row is required';
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'admin_users_require_active_owner') then
    create constraint trigger admin_users_require_active_owner
    after insert or update or delete on admin_users
    deferrable initially deferred
    for each row execute function admin_users_require_active_owner();
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'hugmeid_admin') then
    execute 'create role hugmeid_admin login';
  end if;
end;
$$;

grant usage on schema public to hugmeid_admin;
revoke all privileges on all tables in schema public from hugmeid_admin;
revoke all privileges on all sequences in schema public from hugmeid_admin;
alter default privileges in schema public revoke all privileges on tables from hugmeid_admin;

-- admin_users: no delete; deactivation uses is_active.
grant select, insert, update on admin_users to hugmeid_admin;

-- admin_audit_logs: append-only.
grant select, insert on admin_audit_logs to hugmeid_admin;

-- assets: logical delete only (update deleted_at); physical delete is an
-- ops-only maintenance operation outside this role's grants.
grant select, insert, update on assets to hugmeid_admin;

-- Contents remains fully editable through the admin app.
grant select, insert, update on contents to hugmeid_admin;
grant select, insert on content_versions to hugmeid_admin;

-- Master data: owner-editable low-risk labels/ordering (app enforces which
-- role may call these mutations; the DB role only bounds the blast radius).
grant select, insert, update on content_categories to hugmeid_admin;
grant select, update on activity_kinds to hugmeid_admin;
grant select, update on job_categories, employment_types to hugmeid_admin;

-- View-only master data.
grant select on universities, clubs, specialties to hugmeid_admin;

-- Launch domain-specific editing: owners mutate through app-layer RBAC and
-- audit logging; editors remain read-only at the application boundary.
grant select, insert, update on jobs, activities to hugmeid_admin;
grant select, update on syllabus_pages, syllabus_class_entries to hugmeid_admin;
grant select on syllabus_class_resources, syllabus_class_tasks to hugmeid_admin;

-- Inquiries: status update only, app layer enforces owner-only and allowed
-- transitions; message body/contact fields are read but redacted in audit
-- snapshots by application code.
grant select, update on inquiries to hugmeid_admin;

-- Environment sentinel used by the same safety check the public app relies on.
grant select on app_environment to hugmeid_admin;

grant usage, select on all sequences in schema public to hugmeid_admin;
alter default privileges in schema public grant usage, select on sequences to hugmeid_admin;

commit;
