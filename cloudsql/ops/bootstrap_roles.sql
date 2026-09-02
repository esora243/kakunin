-- Cluster-level role bootstrap.
--
-- Run once as a Cloud SQL administrative principal before applying the schema
-- baseline. This file deliberately creates NOLOGIN capability roles only.
-- Login/IAM principals and credentials are provisioned out of band, then bound
-- with cloudsql/ops/bind_runtime_roles.sql.

do $$
declare
  unsafe_role text;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_schema_owner') then
    create role hugmeid_schema_owner;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_public_runtime') then
    create role hugmeid_public_runtime;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'hugmeid_admin_runtime') then
    create role hugmeid_admin_runtime;
  end if;

  -- Cloud SQL's cloudsqlsuperuser is intentionally not a PostgreSQL
  -- SUPERUSER and cannot execute ALTER ROLE ... NOSUPERUSER (or the other
  -- superuser-only attribute clauses), even as a no-op. CREATE ROLE defaults
  -- are safe; pre-existing roles must already be safe or bootstrap fails.
  select rolname
  into unsafe_role
  from pg_catalog.pg_roles
  where rolname in (
      'hugmeid_schema_owner',
      'hugmeid_public_runtime',
      'hugmeid_admin_runtime'
    )
    and (
      rolcanlogin
      or rolsuper
      or rolcreatedb
      or rolcreaterole
      or rolreplication
      or rolbypassrls
      or not rolinherit
    )
  order by rolname
  limit 1;

  if unsafe_role is not null then
    raise exception
      'Capability role % has unsafe attributes; refusing to repair privileged flags automatically',
      unsafe_role;
  end if;

  select member.rolname
  into unsafe_role
  from pg_catalog.pg_auth_members membership
  join pg_catalog.pg_roles member on member.oid = membership.member
  where member.rolname in (
      'hugmeid_schema_owner',
      'hugmeid_public_runtime',
      'hugmeid_admin_runtime'
    )
  order by member.rolname
  limit 1;

  if unsafe_role is not null then
    raise exception
      'Capability role % inherits another role; refusing bootstrap',
      unsafe_role;
  end if;

  with direct_acl(grantee) as (
    select acl.grantee from pg_catalog.pg_database d
    cross join lateral pg_catalog.aclexplode(d.datacl) acl
    union all
    select acl.grantee from pg_catalog.pg_namespace n
    cross join lateral pg_catalog.aclexplode(n.nspacl) acl
    union all
    select acl.grantee from pg_catalog.pg_class c
    cross join lateral pg_catalog.aclexplode(c.relacl) acl
    union all
    select acl.grantee from pg_catalog.pg_attribute a
    cross join lateral pg_catalog.aclexplode(a.attacl) acl
    where a.attnum > 0 and not a.attisdropped
    union all
    select acl.grantee from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(p.proacl) acl
    union all
    select acl.grantee from pg_catalog.pg_type t
    cross join lateral pg_catalog.aclexplode(t.typacl) acl
    union all
    select acl.grantee from pg_catalog.pg_language l
    cross join lateral pg_catalog.aclexplode(l.lanacl) acl
    union all
    select acl.grantee from pg_catalog.pg_foreign_data_wrapper w
    cross join lateral pg_catalog.aclexplode(w.fdwacl) acl
    union all
    select acl.grantee from pg_catalog.pg_foreign_server s
    cross join lateral pg_catalog.aclexplode(s.srvacl) acl
    union all
    select acl.grantee from pg_catalog.pg_largeobject_metadata l
    cross join lateral pg_catalog.aclexplode(l.lomacl) acl
    union all
    select acl.grantee from pg_catalog.pg_tablespace t
    cross join lateral pg_catalog.aclexplode(t.spcacl) acl
    union all
    select acl.grantee from pg_catalog.pg_parameter_acl p
    cross join lateral pg_catalog.aclexplode(p.paracl) acl
    union all
    select acl.grantee from pg_catalog.pg_default_acl d
    cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
  )
  select role.rolname
  into unsafe_role
  from pg_catalog.pg_roles role
  join direct_acl acl on acl.grantee = role.oid
  where role.rolname in (
      'hugmeid_schema_owner',
      'hugmeid_public_runtime',
      'hugmeid_admin_runtime'
    )
  order by role.rolname
  limit 1;

  if unsafe_role is not null then
    raise exception
      'Capability role % already has a direct ACL; refusing bootstrap',
      unsafe_role;
  end if;

  with owned_objects(owner) as (
    select d.datdba from pg_catalog.pg_database d
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
  select role.rolname
  into unsafe_role
  from pg_catalog.pg_roles role
  join owned_objects object on object.owner = role.oid
  where role.rolname in (
      'hugmeid_schema_owner',
      'hugmeid_public_runtime',
      'hugmeid_admin_runtime'
    )
  order by role.rolname
  limit 1;

  if unsafe_role is not null then
    raise exception
      'Capability role % already owns an object; refusing bootstrap',
      unsafe_role;
  end if;
end;
$$;

alter role hugmeid_schema_owner set search_path = pg_catalog, public;
alter role hugmeid_public_runtime set search_path = pg_catalog, public;
alter role hugmeid_admin_runtime set search_path = pg_catalog, public;
