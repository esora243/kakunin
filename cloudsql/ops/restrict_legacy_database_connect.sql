-- Isolate a retained legacy application database whose runtime principals do
-- not yet use the shared least-privilege capability roles.
--
-- Run as postgres while connected to the exact legacy database:
--   psql ... \
--     -v target_database=hugmeid \
--     -v database_owner_role=cloudsqlsuperuser \
--     -v public_login=hugmeid_app \
--     -v admin_login=hugmeid_admin \
--     -v operator_login=postgres \
--     -f cloudsql/ops/restrict_legacy_database_connect.sql

\set ON_ERROR_STOP on

\if :{?target_database}
\else
do $$ begin raise exception 'target_database is required'; end $$;
\endif

\if :{?database_owner_role}
\else
do $$ begin raise exception 'database_owner_role is required'; end $$;
\endif

\if :{?public_login}
\else
do $$ begin raise exception 'public_login is required'; end $$;
\endif

\if :{?admin_login}
\else
do $$ begin raise exception 'admin_login is required'; end $$;
\endif

\if :{?operator_login}
\else
do $$ begin raise exception 'operator_login is required'; end $$;
\endif

select
  current_database() = :'target_database' as target_database_matches,
  session_user = :'operator_login' as session_is_operator,
  :'operator_login' = 'postgres' as operator_login_is_approved,
  :'public_login' <> :'admin_login'
    and :'public_login' <> :'operator_login'
    and :'admin_login' <> :'operator_login' as login_roles_are_distinct,
  exists (
    select 1
    from pg_catalog.pg_database database
    join pg_catalog.pg_roles owner on owner.oid = database.datdba
    where database.datname = :'target_database'
      and owner.rolname = :'database_owner_role'
  ) as database_owner_matches,
  (
    select count(*) = 3
    from pg_catalog.pg_roles
    where rolname in (
      :'public_login',
      :'admin_login',
      :'operator_login'
    )
      and rolcanlogin
  ) as approved_logins_exist
\gset

\if :target_database_matches
\else
do $$ begin raise exception 'Connected database does not match target_database'; end $$;
\endif

\if :session_is_operator
\else
do $$ begin raise exception 'restrict_legacy_database_connect.sql must run as operator_login'; end $$;
\endif

\if :operator_login_is_approved
\else
do $$ begin raise exception 'operator_login must be the reviewed postgres principal'; end $$;
\endif

\if :login_roles_are_distinct
\else
do $$ begin raise exception 'public_login, admin_login, and operator_login must be distinct'; end $$;
\endif

\if :database_owner_matches
\else
do $$ begin raise exception 'database owner does not match database_owner_role'; end $$;
\endif

\if :approved_logins_exist
\else
do $$ begin raise exception 'approved logins must be three existing LOGIN roles'; end $$;
\endif

begin;

set local role :"database_owner_role";
revoke connect, temporary on database :"target_database" from public;
grant connect on database :"target_database"
  to :"public_login", :"admin_login", :"operator_login";
reset role;

select
  not exists (
    select 1
    from pg_catalog.pg_database database
    cross join lateral pg_catalog.aclexplode(database.datacl) acl
    where database.datname = :'target_database'
      and acl.grantee = 0
  ) as public_database_acl_is_empty,
  not exists (
    select 1
    from pg_catalog.pg_roles role
    where role.rolcanlogin
      and role.rolname <> 'cloudsqladmin'
      and has_database_privilege(role.oid, :'target_database', 'CONNECT')
      and role.rolname not in (
        :'public_login',
        :'admin_login',
        :'operator_login'
      )
      -- A legacy Cloud SQL database can be owned by the provider-managed
      -- LOGIN role cloudsqlsuperuser. Ownership gives that role CONNECT, and
      -- Cloud SQL grants it to two control-plane LOGIN roles used for agent
      -- and import/export operations. Permit only this reviewed provider set,
      -- and only for that exact database owner; every other effective LOGIN
      -- remains a commit-blocking failure.
      and not (
        :'database_owner_role' = 'cloudsqlsuperuser'
        and role.rolname in (
          'cloudsqlsuperuser',
          'cloudsqlagent',
          'cloudsqlimportexport'
        )
      )
  ) as effective_connect_set_is_exact,
  has_database_privilege(:'public_login', :'target_database', 'CONNECT')
    and has_database_privilege(:'admin_login', :'target_database', 'CONNECT')
    and has_database_privilege(:'operator_login', :'target_database', 'CONNECT')
    as approved_logins_can_connect
\gset

\if :public_database_acl_is_empty
\else
do $$ begin raise exception 'PUBLIC retains privileges on target_database'; end $$;
\endif

\if :effective_connect_set_is_exact
\else
do $$ begin raise exception 'An unexpected login retains effective CONNECT on target_database'; end $$;
\endif

\if :approved_logins_can_connect
\else
do $$ begin raise exception 'An approved login lacks CONNECT on target_database'; end $$;
\endif

commit;
