-- psql-only template for binding newly provisioned login/IAM principals.
--
-- Example:
--   psql ... \
--     -v target_database=hugmeid_staging_v2 \
--     -v public_login=hugmeid_staging_public_v2 \
--     -v admin_login=hugmeid_staging_admin_v2 \
--     -v operator_login=postgres \
--     -f cloudsql/ops/bind_runtime_roles.sql
--
-- This script fails closed if either principal already owns an object, has a
-- direct ACL, can CREATE in public, has unsafe role attributes, or inherits any
-- role other than its one intended NOLOGIN capability role.

\set ON_ERROR_STOP on

\if :{?target_database}
\else
do $$ begin raise exception 'target_database is required'; end $$;
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

create or replace function pg_temp.runtime_binding_preflight(
  target_role_name text,
  allowed_membership text,
  allowed_database_name text
)
returns table (
  role_exists boolean,
  attributes_safe boolean,
  memberships_safe boolean,
  direct_acl_safe boolean,
  ownership_safe boolean,
  schema_create_safe boolean
)
language sql
as $$
  with recursive target as (
    select *
    from pg_catalog.pg_roles
    where rolname = target_role_name
  ),
  inherited_roles(roleid, path) as (
    select m.roleid, array[m.roleid]
    from pg_catalog.pg_auth_members m
    where m.member = (select oid from target)
    union all
    select m.roleid, inherited_roles.path || m.roleid
    from inherited_roles
    join pg_catalog.pg_auth_members m on m.member = inherited_roles.roleid
    where not m.roleid = any(inherited_roles.path)
  ),
  direct_acl as (
    select
      'database' as kind,
      d.datname as object_name,
      acl.privilege_type,
      acl.is_grantable
    from pg_catalog.pg_database d
    cross join lateral pg_catalog.aclexplode(d.datacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'schema', n.nspname, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_namespace n
    cross join lateral pg_catalog.aclexplode(n.nspacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'relation', c.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'column', a.attrelid::text || ':' || a.attnum::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_attribute a
    cross join lateral pg_catalog.aclexplode(a.attacl) acl
    where acl.grantee = (select oid from target)
      and a.attnum > 0
      and not a.attisdropped
    union all
    select 'routine', p.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(p.proacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'type', t.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_type t
    cross join lateral pg_catalog.aclexplode(t.typacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'language', l.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_language l
    cross join lateral pg_catalog.aclexplode(l.lanacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'foreign_data_wrapper', w.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_foreign_data_wrapper w
    cross join lateral pg_catalog.aclexplode(w.fdwacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'foreign_server', s.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_foreign_server s
    cross join lateral pg_catalog.aclexplode(s.srvacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'large_object', l.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_largeobject_metadata l
    cross join lateral pg_catalog.aclexplode(l.lomacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'tablespace', t.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_tablespace t
    cross join lateral pg_catalog.aclexplode(t.spcacl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'parameter', p.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_parameter_acl p
    cross join lateral pg_catalog.aclexplode(p.paracl) acl
    where acl.grantee = (select oid from target)
    union all
    select 'default_acl', d.oid::text, acl.privilege_type, acl.is_grantable
    from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
    where acl.grantee = (select oid from target)
  ),
  owned_objects as (
    select d.datdba as owner from pg_catalog.pg_database d
    union all select n.nspowner from pg_catalog.pg_namespace n
    union all select c.relowner from pg_catalog.pg_class c
    union all select p.proowner from pg_catalog.pg_proc p
    union all select t.typowner from pg_catalog.pg_type t
    union all select e.extowner from pg_catalog.pg_extension e
    union all select c.collowner from pg_catalog.pg_collation c
    union all select c.conowner from pg_catalog.pg_conversion c
    union all select o.oprowner from pg_catalog.pg_operator o
    union all select o.opcowner from pg_catalog.pg_opclass o
    union all select o.opfowner from pg_catalog.pg_opfamily o
    union all select e.evtowner from pg_catalog.pg_event_trigger e
    union all select w.fdwowner from pg_catalog.pg_foreign_data_wrapper w
    union all select s.srvowner from pg_catalog.pg_foreign_server s
    union all select l.lanowner from pg_catalog.pg_language l
    union all select c.cfgowner from pg_catalog.pg_ts_config c
    union all select d.dictowner from pg_catalog.pg_ts_dict d
    union all select p.pubowner from pg_catalog.pg_publication p
    union all select s.subowner from pg_catalog.pg_subscription s
    union all select s.stxowner from pg_catalog.pg_statistic_ext s
    union all select l.lomowner from pg_catalog.pg_largeobject_metadata l
    union all select t.spcowner from pg_catalog.pg_tablespace t
    union all select d.defaclrole from pg_catalog.pg_default_acl d
  )
  select
    exists(select 1 from target),
    coalesce((
      select
        rolcanlogin
        and rolinherit
        and not rolsuper
        and not rolcreatedb
        and not rolcreaterole
        and not rolreplication
        and not rolbypassrls
      from target
    ), false),
    not exists (
      select 1
      from inherited_roles
      join pg_catalog.pg_roles inherited on inherited.oid = inherited_roles.roleid
      where inherited.rolname <> allowed_membership
    )
    and not exists (
      select 1
      from pg_catalog.pg_auth_members membership
      join pg_catalog.pg_roles inherited on inherited.oid = membership.roleid
      where membership.member = (select oid from target)
        and inherited.rolname = allowed_membership
        and (
          membership.admin_option
          or not membership.inherit_option
          or not membership.set_option
        )
    ),
    not exists (
      select 1
      from direct_acl
      where not (
        kind = 'database'
        and object_name = allowed_database_name
        and privilege_type = 'CONNECT'
        and not is_grantable
      )
    ),
    not exists (
      select 1 from owned_objects where owner = (select oid from target)
    ),
    coalesce(
      not pg_catalog.has_schema_privilege((select oid from target), 'public', 'CREATE'),
      false
    );
$$;

create or replace function pg_temp.assert_runtime_binding(
  target_role_name text,
  allowed_membership text,
  allowed_database_name text
)
returns void
language plpgsql
as $$
declare
  result record;
begin
  select *
  into result
  from pg_temp.runtime_binding_preflight(
    target_role_name,
    allowed_membership,
    allowed_database_name
  );

  if not result.role_exists then
    raise exception 'Runtime principal % does not exist', target_role_name;
  end if;
  if not result.attributes_safe then
    raise exception 'Runtime principal % has unsafe attributes', target_role_name;
  end if;
  if not result.memberships_safe then
    raise exception 'Runtime principal % has an unexpected membership', target_role_name;
  end if;
  if not result.direct_acl_safe then
    raise exception 'Runtime principal % has a direct ACL', target_role_name;
  end if;
  if not result.ownership_safe then
    raise exception 'Runtime principal % owns an object', target_role_name;
  end if;
  if not result.schema_create_safe then
    raise exception 'Runtime principal % can CREATE in public', target_role_name;
  end if;
end;
$$;

begin;

select
  current_database() = :'target_database' as target_database_matches,
  :'public_login' <> :'admin_login'
    and :'public_login' <> :'operator_login'
    and :'admin_login' <> :'operator_login' as login_roles_are_distinct,
  :'operator_login' = 'postgres' as operator_login_is_approved,
  session_user = :'operator_login' as session_is_operator,
  exists (
    select 1 from pg_catalog.pg_roles
    where rolname = :'operator_login' and rolcanlogin
  ) as operator_login_exists
\gset

\if :target_database_matches
\else
do $$ begin raise exception 'Connected database does not match target_database'; end $$;
\endif

\if :login_roles_are_distinct
\else
do $$ begin raise exception 'public_login, admin_login, and operator_login must be distinct'; end $$;
\endif

\if :operator_login_exists
\else
do $$ begin raise exception 'operator_login must be an existing login role'; end $$;
\endif

\if :operator_login_is_approved
\else
do $$ begin raise exception 'operator_login must be the reviewed postgres principal'; end $$;
\endif

\if :session_is_operator
\else
do $$ begin raise exception 'bind_runtime_roles.sql must run as operator_login'; end $$;
\endif

select pg_temp.assert_runtime_binding(
  :'public_login',
  'hugmeid_public_runtime',
  :'target_database'
);
select pg_temp.assert_runtime_binding(
  :'admin_login',
  'hugmeid_admin_runtime',
  :'target_database'
);

set local role hugmeid_schema_owner;
revoke connect, temporary on database :"target_database" from public;
revoke connect, temporary on database :"target_database"
  from hugmeid_public_runtime, hugmeid_admin_runtime;
grant connect on database :"target_database"
  to :"public_login", :"admin_login", :"operator_login";
reset role;

-- The preflight above proves that both principals already have safe
-- attributes. Do not attempt ALTER ROLE ... NOSUPERUSER here: Cloud SQL's
-- cloudsqlsuperuser is not a PostgreSQL SUPERUSER and cannot toggle that
-- attribute even when the target role is already NOSUPERUSER.
grant hugmeid_public_runtime to :"public_login" with inherit true;
grant hugmeid_public_runtime to :"public_login" with set true;
grant hugmeid_public_runtime to :"public_login" with admin false;
grant hugmeid_admin_runtime to :"admin_login" with inherit true;
grant hugmeid_admin_runtime to :"admin_login" with set true;
grant hugmeid_admin_runtime to :"admin_login" with admin false;

select pg_temp.assert_runtime_binding(
  :'public_login',
  'hugmeid_public_runtime',
  :'target_database'
);
select pg_temp.assert_runtime_binding(
  :'admin_login',
  'hugmeid_admin_runtime',
  :'target_database'
);

select
  not exists (
    select 1
    from pg_catalog.pg_database database
    cross join lateral pg_catalog.aclexplode(database.datacl) acl
    where database.datname = :'target_database'
      and acl.grantee = 0
  ) as public_database_acl_is_safe,
  has_database_privilege(:'public_login', :'target_database', 'CONNECT')
    and has_database_privilege(:'admin_login', :'target_database', 'CONNECT')
    and has_database_privilege(:'operator_login', :'target_database', 'CONNECT')
    as approved_logins_can_connect,
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
  ) as effective_connect_set_is_exact
\gset

\if :public_database_acl_is_safe
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
