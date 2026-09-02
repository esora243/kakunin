-- Close a new application database before migrations grant shared capability
-- roles access to application objects.
--
-- Run after bootstrap_database.sql, as the disposable bootstrap login:
--   psql ... \
--     -v target_database=hugmeid_production_v2 \
--     -v bootstrap_login=hugmeid_production_bootstrap_20260731 \
--     -v operator_login=postgres \
--     -f cloudsql/ops/prelock_database_connect.sql
--
-- The bootstrap login remains temporarily connectable so it can migrate the
-- empty database. Revoke its direct CONNECT and schema-owner membership after
-- migration, then run bind_runtime_roles.sql as postgres for the final exact
-- public/admin/operator state.

\set ON_ERROR_STOP on

\if :{?target_database}
\else
do $$ begin raise exception 'target_database is required'; end $$;
\endif

\if :{?bootstrap_login}
\else
do $$ begin raise exception 'bootstrap_login is required'; end $$;
\endif

\if :{?operator_login}
\else
do $$ begin raise exception 'operator_login is required'; end $$;
\endif

select
  current_database() = :'target_database' as target_database_matches,
  session_user = :'bootstrap_login' as session_is_bootstrap,
  :'operator_login' = 'postgres' as operator_login_is_approved,
  :'bootstrap_login' <> :'operator_login' as logins_are_distinct,
  exists (
    select 1
    from pg_catalog.pg_database database
    join pg_catalog.pg_roles owner on owner.oid = database.datdba
    where database.datname = :'target_database'
      and owner.rolname = 'hugmeid_schema_owner'
  ) as database_owner_is_safe,
  exists (
    select 1 from pg_catalog.pg_roles
    where rolname = :'bootstrap_login' and rolcanlogin
  ) as bootstrap_login_exists,
  exists (
    select 1 from pg_catalog.pg_roles
    where rolname = :'operator_login' and rolcanlogin
  ) as operator_login_exists
\gset

\if :target_database_matches
\else
do $$ begin raise exception 'Connected database does not match target_database'; end $$;
\endif

\if :session_is_bootstrap
\else
do $$ begin raise exception 'prelock_database_connect.sql must run as bootstrap_login'; end $$;
\endif

\if :operator_login_is_approved
\else
do $$ begin raise exception 'operator_login must be the reviewed postgres principal'; end $$;
\endif

\if :logins_are_distinct
\else
do $$ begin raise exception 'bootstrap_login and operator_login must be distinct'; end $$;
\endif

\if :database_owner_is_safe
\else
do $$ begin raise exception 'target_database must be owned by hugmeid_schema_owner'; end $$;
\endif

\if :bootstrap_login_exists
\else
do $$ begin raise exception 'bootstrap_login must be an existing login role'; end $$;
\endif

\if :operator_login_exists
\else
do $$ begin raise exception 'operator_login must be an existing login role'; end $$;
\endif

begin;

set local role hugmeid_schema_owner;
revoke connect, temporary on database :"target_database" from public;
revoke connect, temporary on database :"target_database"
  from hugmeid_public_runtime, hugmeid_admin_runtime;
grant connect on database :"target_database"
  to :"bootstrap_login", :"operator_login";
reset role;

select
  not exists (
    select 1
    from pg_catalog.pg_database database
    cross join lateral pg_catalog.aclexplode(database.datacl) acl
    where database.datname = :'target_database'
      and acl.grantee = 0
  ) as public_database_acl_is_empty,
  has_database_privilege(:'bootstrap_login', :'target_database', 'CONNECT')
    and has_database_privilege(:'operator_login', :'target_database', 'CONNECT')
    as approved_logins_can_connect,
  not exists (
    select 1
    from pg_catalog.pg_roles role
    where role.rolcanlogin
      and role.rolname <> 'cloudsqladmin'
      and has_database_privilege(role.oid, :'target_database', 'CONNECT')
      and role.rolname not in (
        :'bootstrap_login',
        :'operator_login'
      )
  ) as effective_connect_set_is_exact
\gset

\if :public_database_acl_is_empty
\else
do $$ begin raise exception 'PUBLIC retains privileges on target_database'; end $$;
\endif

\if :approved_logins_can_connect
\else
do $$ begin raise exception 'An approved login lacks CONNECT on target_database'; end $$;
\endif

\if :effective_connect_set_is_exact
\else
do $$ begin raise exception 'An unexpected login retains effective CONNECT on target_database'; end $$;
\endif

commit;
