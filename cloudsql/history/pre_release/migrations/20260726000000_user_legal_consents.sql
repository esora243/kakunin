-- Record each legal-document version accepted during LINE account/session creation.
-- Runtime roles may append and read consent history, but never edit or delete it.

begin;

create table if not exists user_legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version text not null check (length(trim(version)) > 0),
  accepted_at timestamptz not null default now(),
  unique (user_id, version)
);

revoke all privileges on table user_legal_consents from public;
do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_app') then
    grant select, insert on table user_legal_consents to hugmeid_app;
  end if;

  if exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_staging_app') then
    grant select, insert on table user_legal_consents to hugmeid_staging_app;
  end if;
end;
$$;

commit;
