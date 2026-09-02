-- Per-database bootstrap for the migration principal.
--
-- Run as the administrative migration principal after bootstrap_roles.sql and
-- before scripts/cloudsql-migrate.mjs. The application runtime principals must
-- never run this file.

begin;

revoke create on schema public from public;
grant usage, create on schema public to hugmeid_schema_owner;

-- PostgreSQL 16 stores INHERIT and SET on each membership edge. State every
-- option explicitly so this principal has a direct edge that can inherit and
-- SET ROLE before migration starts.
-- The explicit ADMIN FALSE applies to the edge created by this bootstrap. A
-- CREATEROLE principal may also have a creator edge from another grantor; that
-- elevated edge disappears when the disposable principal is dropped.
grant hugmeid_schema_owner to session_user with inherit true;
grant hugmeid_schema_owner to session_user with set true;
grant hugmeid_schema_owner to session_user with admin false;

-- The durable NOLOGIN owner, not the disposable administrative login, owns the
-- target database and pgcrypto. Database ownership gives the role the CREATE
-- privilege needed after SET ROLE without leaving a temporary principal or a
-- non-default database ACL behind.
do $$
begin
  execute format(
    'alter database %I owner to hugmeid_schema_owner',
    current_database()
  );
end;
$$;

set local role hugmeid_schema_owner;
create extension if not exists pgcrypto with schema public;
reset role;

do $$
declare
  actual_database_owner text;
  actual_extension_owner text;
begin
  select owner.rolname
  into actual_database_owner
  from pg_catalog.pg_database database
  join pg_catalog.pg_roles owner on owner.oid = database.datdba
  where database.datname = current_database();

  select owner.rolname
  into actual_extension_owner
  from pg_catalog.pg_extension extension
  join pg_catalog.pg_roles owner on owner.oid = extension.extowner
  where extension.extname = 'pgcrypto';

  if actual_database_owner is distinct from 'hugmeid_schema_owner' then
    raise exception
      'Target database must be owned by hugmeid_schema_owner, found %',
      coalesce(actual_database_owner, '<missing>');
  end if;

  if actual_extension_owner is distinct from 'hugmeid_schema_owner' then
    raise exception
      'pgcrypto must be owned by hugmeid_schema_owner, found %',
      coalesce(actual_extension_owner, '<missing>');
  end if;
end;
$$;

commit;
