import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const repositoryRoot = resolve(new URL("..", import.meta.url).pathname);
export const EXPECTED_SCHEMA_STATE_PATH = resolve(repositoryRoot, "cloudsql/expected-schema-state.json");

async function rows(client, query, values = []) {
  const result = await client.query(query, values);
  return result.rows;
}

async function executeSequentially(tasks) {
  const results = [];
  for (const task of tasks) results.push(await task());
  return results;
}

async function captureSchemaStateWithCanonicalSearchPath(client) {
  const [
    extensions,
    schemas,
    relations,
    enums,
    domains,
    columns,
    constraints,
    indexes,
    triggers,
    functions,
    views,
    sequences,
    rowSecurityPolicies,
    eventTriggers,
    foreignServers,
    publications,
    subscriptions,
    objectPrivileges,
    defaultPrivileges,
    capabilityRoles,
    capabilityRoleMemberships,
    capabilityRoleSettings,
  ] = await executeSequentially([
    () => rows(
      client,
      `select e.extname as name, e.extversion as version, n.nspname as schema
       from pg_catalog.pg_extension e
       join pg_catalog.pg_namespace n on n.oid = e.extnamespace
       order by e.extname`,
    ),
    () => rows(
      client,
      `select
         n.nspname as name,
         owner.rolname as owner
       from pg_catalog.pg_namespace n
       join pg_catalog.pg_roles owner on owner.oid = n.nspowner
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
       order by n.nspname`,
    ),
    () => rows(
      client,
      `select
         n.nspname as schema,
         c.relname as name,
         c.relkind as kind,
         c.relpersistence as persistence,
         owner.rolname as owner,
         c.relrowsecurity as row_security,
         c.relforcerowsecurity as force_row_security,
         c.relreplident as replica_identity,
         c.relispartition as is_partition,
         tablespace.spcname as tablespace,
         access_method.amname as access_method
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       join pg_catalog.pg_roles owner on owner.oid = c.relowner
       left join pg_catalog.pg_tablespace tablespace on tablespace.oid = c.reltablespace
       left join pg_catalog.pg_am access_method on access_method.oid = c.relam
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_class'::regclass
             and d.objid = c.oid
             and d.deptype = 'e'
         )
       order by n.nspname, c.relname`,
    ),
    () => rows(
      client,
      `select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as values
       from pg_catalog.pg_type t
       join pg_catalog.pg_namespace n on n.oid = t.typnamespace
       join pg_catalog.pg_enum e on e.enumtypid = t.oid
       where n.nspname = 'public'
       group by t.typname
       order by t.typname`,
    ),
    () => rows(
      client,
      `select
         n.nspname as schema,
         t.typname as name,
         pg_catalog.format_type(t.typbasetype, t.typtypmod) as base_type,
         t.typnotnull as not_null,
         pg_catalog.pg_get_expr(t.typdefaultbin, 0, true) as default_expression,
         coalesce(
           array_agg(
             pg_catalog.pg_get_constraintdef(c.oid, true)
             order by c.conname
           ) filter (where c.oid is not null),
           array[]::text[]
         ) as constraints
       from pg_catalog.pg_type t
       join pg_catalog.pg_namespace n on n.oid = t.typnamespace
       left join pg_catalog.pg_constraint c on c.contypid = t.oid
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
         and t.typtype = 'd'
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_type'::regclass
             and d.objid = t.oid
             and d.deptype = 'e'
         )
       group by n.nspname, t.oid, t.typname, t.typbasetype, t.typtypmod, t.typnotnull, t.typdefaultbin
       order by n.nspname, t.typname`,
    ),
    () => rows(
      client,
      `select
         table_name,
         ordinal_position,
         column_name,
         data_type,
         udt_name,
         is_nullable,
         column_default,
         is_identity,
         identity_generation,
         is_generated,
         generation_expression,
         collation_name,
         character_maximum_length,
         numeric_precision,
         numeric_scale,
         datetime_precision
       from information_schema.columns
       where table_schema = 'public'
       order by table_name, ordinal_position`,
    ),
    () => rows(
      client,
      `select
         c.relname as table_name,
         con.conname as name,
         con.contype as type,
         con.condeferrable as deferrable,
         con.condeferred as initially_deferred,
         con.convalidated as validated,
         con.connoinherit as no_inherit,
         pg_catalog.pg_get_constraintdef(con.oid, true) as definition
       from pg_catalog.pg_constraint con
       join pg_catalog.pg_class c on c.oid = con.conrelid
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
       order by c.relname, con.conname`,
    ),
    () => rows(
      client,
      `select
         table_relation.relname as table_name,
         index_relation.relname as name,
         index_state.indisunique as is_unique,
         index_state.indisprimary as is_primary,
         index_state.indisexclusion as is_exclusion,
         index_state.indimmediate as is_immediate,
         index_state.indisclustered as is_clustered,
         index_state.indisvalid as is_valid,
         index_state.indisready as is_ready,
         index_state.indislive as is_live,
         index_state.indisreplident as is_replica_identity,
         pg_catalog.pg_get_indexdef(index_relation.oid) as definition
       from pg_catalog.pg_index index_state
       join pg_catalog.pg_class index_relation on index_relation.oid = index_state.indexrelid
       join pg_catalog.pg_class table_relation on table_relation.oid = index_state.indrelid
       join pg_catalog.pg_namespace n on n.oid = table_relation.relnamespace
       where n.nspname = 'public'
       order by table_relation.relname, index_relation.relname`,
    ),
    () => rows(
      client,
      `select
         c.relname as table_name,
         t.tgname as name,
         t.tgenabled as enabled,
         pg_catalog.pg_get_triggerdef(t.oid, true) as definition
       from pg_catalog.pg_trigger t
       join pg_catalog.pg_class c on c.oid = t.tgrelid
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and not t.tgisinternal
       order by c.relname, t.tgname`,
    ),
    () => rows(
      client,
      `select
         p.proname as name,
         pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
         pg_catalog.pg_get_function_result(p.oid) as result,
         l.lanname as language,
         p.prokind as kind,
         p.provolatile as volatility,
         p.prosecdef as security_definer,
         p.proleakproof as leakproof,
         p.proisstrict as strict,
         p.proretset as returns_set,
         p.proparallel as parallel,
         p.procost::text as cost,
         p.prorows::text as rows,
         p.proconfig as config,
         pg_catalog.pg_get_functiondef(p.oid) as definition,
         owner.rolname as owner
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       join pg_catalog.pg_language l on l.oid = p.prolang
       join pg_catalog.pg_roles owner on owner.oid = p.proowner
       where n.nspname = 'public'
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_proc'::regclass
             and d.objid = p.oid
             and d.deptype = 'e'
         )
       order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)`,
    ),
    () => rows(
      client,
      `select
         n.nspname as schema,
         c.relname as name,
         c.relkind as kind,
         owner.rolname as owner,
         pg_catalog.pg_get_viewdef(c.oid, true) as definition
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       join pg_catalog.pg_roles owner on owner.oid = c.relowner
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
         and c.relkind in ('v', 'm')
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_class'::regclass
             and d.objid = c.oid
             and d.deptype = 'e'
         )
       order by n.nspname, c.relname`,
    ),
    () => rows(
      client,
      `select
         n.nspname as schema,
         c.relname as name,
         owner.rolname as owner,
         s.seqstart::text as start_value,
         s.seqincrement::text as increment_by,
         s.seqmin::text as min_value,
         s.seqmax::text as max_value,
         s.seqcache::text as cache_size,
         s.seqcycle as cycle,
         owned_namespace.nspname as owned_by_schema,
         owned_table.relname as owned_by_table,
         owned_column.attname as owned_by_column
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       join pg_catalog.pg_roles owner on owner.oid = c.relowner
       join pg_catalog.pg_sequence s on s.seqrelid = c.oid
       left join pg_catalog.pg_depend dependency
         on dependency.classid = 'pg_class'::regclass
        and dependency.objid = c.oid
        and dependency.deptype in ('a', 'i')
       left join pg_catalog.pg_class owned_table on owned_table.oid = dependency.refobjid
       left join pg_catalog.pg_namespace owned_namespace on owned_namespace.oid = owned_table.relnamespace
       left join pg_catalog.pg_attribute owned_column
         on owned_column.attrelid = dependency.refobjid
        and owned_column.attnum = dependency.refobjsubid
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
         and c.relkind = 'S'
         and not exists (
           select 1
           from pg_catalog.pg_depend extension_dependency
           where extension_dependency.classid = 'pg_class'::regclass
             and extension_dependency.objid = c.oid
             and extension_dependency.deptype = 'e'
         )
       order by n.nspname, c.relname`,
    ),
    () => rows(
      client,
      `select
         n.nspname as schema,
         c.relname as table_name,
         p.polname as name,
         p.polpermissive as permissive,
         p.polcmd as command,
         coalesce(
           (
             select array_agg(role.rolname::text order by role.rolname::text)
             from unnest(p.polroles) role_oid
             join pg_catalog.pg_roles role on role.oid = role_oid
           ),
           array[]::text[]
         ) as roles,
         pg_catalog.pg_get_expr(p.polqual, p.polrelid, true) as using_expression,
         pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, true) as check_expression
       from pg_catalog.pg_policy p
       join pg_catalog.pg_class c on c.oid = p.polrelid
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname <> 'information_schema'
         and n.nspname !~ '^pg_'
       order by n.nspname, c.relname, p.polname`,
    ),
    () => rows(
      client,
      `select
         e.evtname as name,
         e.evtevent as event,
         e.evtenabled as enabled,
         e.evttags as tags,
         p.proname as function_name,
         n.nspname as function_schema
       from pg_catalog.pg_event_trigger e
       join pg_catalog.pg_proc p on p.oid = e.evtfoid
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       order by e.evtname`,
    ),
    () => rows(
      client,
      `select
         s.srvname as name,
         owner.rolname as owner,
         w.fdwname as wrapper,
         coalesce(s.srvoptions, array[]::text[]) as options
       from pg_catalog.pg_foreign_server s
       join pg_catalog.pg_roles owner on owner.oid = s.srvowner
       join pg_catalog.pg_foreign_data_wrapper w on w.oid = s.srvfdw
       order by s.srvname`,
    ),
    () => rows(
      client,
      `select
         p.pubname as name,
         owner.rolname as owner,
         p.puballtables as all_tables,
         p.pubinsert as publish_insert,
         p.pubupdate as publish_update,
         p.pubdelete as publish_delete,
         p.pubtruncate as publish_truncate,
         p.pubviaroot as publish_via_partition_root
       from pg_catalog.pg_publication p
       join pg_catalog.pg_roles owner on owner.oid = p.pubowner
       order by p.pubname`,
    ),
    () => rows(
      client,
      `select
         s.subname as name,
         owner.rolname as owner,
         s.subenabled as enabled,
         s.subpublications as publications
       from pg_catalog.pg_subscription s
       join pg_catalog.pg_roles owner on owner.oid = s.subowner
       order by s.subname`,
    ),
    () => rows(
      client,
      `with object_acl as (
         select
           'schema' as object_kind,
           n.nspname as schema,
           n.nspname as object_name,
           null::text as subobject_name,
           acl.grantee as grantee,
           acl.grantor as grantor,
           acl.privilege_type as privilege_type,
           acl.is_grantable as is_grantable
         from pg_catalog.pg_namespace n
         cross join lateral pg_catalog.aclexplode(n.nspacl) acl
         where n.nspname <> 'information_schema'
           and n.nspname !~ '^pg_'

         union all

         select
           case when c.relkind = 'S' then 'sequence' else 'relation' end,
           n.nspname,
           c.relname,
           null::text,
           acl.grantee,
           acl.grantor,
           acl.privilege_type,
           acl.is_grantable
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         cross join lateral pg_catalog.aclexplode(c.relacl) acl
         where n.nspname <> 'information_schema'
           and n.nspname !~ '^pg_'
           and not exists (
             select 1
             from pg_catalog.pg_depend d
             where d.classid = 'pg_class'::regclass
               and d.objid = c.oid
               and d.deptype = 'e'
           )

         union all

         select
           'column',
           n.nspname,
           c.relname,
           a.attname,
           acl.grantee,
           acl.grantor,
           acl.privilege_type,
           acl.is_grantable
         from pg_catalog.pg_attribute a
         join pg_catalog.pg_class c on c.oid = a.attrelid
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         cross join lateral pg_catalog.aclexplode(a.attacl) acl
         where n.nspname <> 'information_schema'
           and n.nspname !~ '^pg_'
           and a.attnum > 0
           and not a.attisdropped

         union all

         select
           'routine',
           n.nspname,
           p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')',
           null::text,
           acl.grantee,
           acl.grantor,
           acl.privilege_type,
           acl.is_grantable
         from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         cross join lateral pg_catalog.aclexplode(p.proacl) acl
         where n.nspname <> 'information_schema'
           and n.nspname !~ '^pg_'
           and not exists (
             select 1
             from pg_catalog.pg_depend d
             where d.classid = 'pg_proc'::regclass
               and d.objid = p.oid
               and d.deptype = 'e'
           )

         union all

         select
           'type',
           n.nspname,
           t.typname,
           null::text,
           acl.grantee,
           acl.grantor,
           acl.privilege_type,
           acl.is_grantable
         from pg_catalog.pg_type t
         join pg_catalog.pg_namespace n on n.oid = t.typnamespace
         cross join lateral pg_catalog.aclexplode(t.typacl) acl
         where n.nspname <> 'information_schema'
           and n.nspname !~ '^pg_'
           and not exists (
             select 1
             from pg_catalog.pg_depend d
             where d.classid = 'pg_type'::regclass
               and d.objid = t.oid
               and d.deptype = 'e'
           )
       )
       select
         object_kind,
         schema,
         object_name,
         subobject_name,
         case when object_acl.grantee = 0 then 'PUBLIC' else grantee_role.rolname end as grantee,
         grantor_role.rolname as grantor,
         privilege_type,
         is_grantable
       from object_acl
       left join pg_catalog.pg_roles grantee_role on grantee_role.oid = object_acl.grantee
       join pg_catalog.pg_roles grantor_role on grantor_role.oid = object_acl.grantor
       where not (
         object_acl.grantee <> 0
         and grantee_role.rolname = 'cloudsqlsuperuser'
         and grantor_role.rolname = 'pg_database_owner'
         and object_acl.object_kind = 'schema'
         and object_acl.schema = 'public'
         and object_acl.object_name = 'public'
         and object_acl.privilege_type in ('USAGE', 'CREATE')
         and not object_acl.is_grantable
       )
       order by object_kind, schema, object_name, subobject_name, grantee, privilege_type`,
    ),
    () => rows(
      client,
      `select
         owner.rolname as owner,
         coalesce(n.nspname, '') as schema,
         d.defaclobjtype as object_type,
         d.defaclacl::text as acl
       from pg_catalog.pg_default_acl d
       join pg_catalog.pg_roles owner on owner.oid = d.defaclrole
       left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
       order by owner.rolname, schema, object_type`,
    ),
    () => rows(
      client,
      `select
         r.rolname as name,
         r.rolcanlogin as can_login,
         r.rolsuper as is_superuser,
         r.rolcreatedb as can_create_db,
         r.rolcreaterole as can_create_role,
         r.rolreplication as can_replicate,
         r.rolbypassrls as can_bypass_rls,
         r.rolinherit as inherits_privileges,
         r.rolconnlimit as connection_limit,
         r.rolvaliduntil::text as valid_until
       from pg_catalog.pg_roles r
       where r.rolname in ('hugmeid_schema_owner', 'hugmeid_public_runtime', 'hugmeid_admin_runtime')
       order by r.rolname`,
    ),
    () => rows(
      client,
      `select
         member.rolname as member,
         parent.rolname as granted_role,
         grantor.rolname as grantor,
         membership.admin_option,
         membership.inherit_option,
         membership.set_option
       from pg_catalog.pg_auth_members membership
       join pg_catalog.pg_roles member on member.oid = membership.member
       join pg_catalog.pg_roles parent on parent.oid = membership.roleid
       join pg_catalog.pg_roles grantor on grantor.oid = membership.grantor
       where member.rolname in (
         'hugmeid_schema_owner',
         'hugmeid_public_runtime',
         'hugmeid_admin_runtime'
       )
       order by member.rolname, parent.rolname`,
    ),
    () => rows(
      client,
      `select
         role.rolname as role,
         coalesce(database.datname, '') as database,
         setting.setconfig as settings
       from pg_catalog.pg_db_role_setting setting
       join pg_catalog.pg_roles role on role.oid = setting.setrole
       left join pg_catalog.pg_database database on database.oid = setting.setdatabase
       where role.rolname in (
         'hugmeid_schema_owner',
         'hugmeid_public_runtime',
         'hugmeid_admin_runtime'
       )
       order by role.rolname, database.datname`,
    ),
  ]);

  return {
    extensions,
    schemas,
    relations,
    enums,
    domains,
    columns,
    constraints,
    indexes,
    triggers,
    functions,
    views,
    sequences,
    rowSecurityPolicies,
    eventTriggers,
    foreignServers,
    publications,
    subscriptions,
    objectPrivileges,
    defaultPrivileges,
    capabilityRoles,
    capabilityRoleMemberships,
    capabilityRoleSettings,
  };
}

export async function captureSchemaState(client) {
  const searchPathResult = await client.query("select current_setting('search_path') as value");
  const previousSearchPath = searchPathResult.rows[0]?.value ?? '"$user", public';
  await client.query("select pg_catalog.set_config('search_path', 'pg_catalog', false)");
  try {
    return await captureSchemaStateWithCanonicalSearchPath(client);
  } finally {
    await client.query("select pg_catalog.set_config('search_path', $1, false)", [previousSearchPath]);
  }
}

export function schemaStateChecksum(state) {
  return createHash("sha256").update(JSON.stringify(state), "utf8").digest("hex");
}

export function loadExpectedSchemaState(path = EXPECTED_SCHEMA_STATE_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const writeIndex = process.argv.indexOf("--write");
  const client = new Client({ application_name: "hugmeid-cloudsql-schema-state" });
  await client.connect();
  try {
    const state = await captureSchemaState(client);
    const document = {
      formatVersion: 1,
      checksumSha256: schemaStateChecksum(state),
      state,
    };
    const output = `${JSON.stringify(document, null, 2)}\n`;
    if (writeIndex >= 0) {
      const databaseResult = await client.query("select current_database() as name");
      const databaseName = databaseResult.rows[0]?.name ?? "";
      if (process.env.HUGMEID_SCHEMA_MANIFEST_WRITE !== "1" || !/(?:_test|_ci)$/.test(databaseName)) {
        throw new Error("Manifest writes require HUGMEID_SCHEMA_MANIFEST_WRITE=1 and a *_test or *_ci database");
      }
      const outputPath = resolve(process.argv[writeIndex + 1] ?? EXPECTED_SCHEMA_STATE_PATH);
      writeFileSync(outputPath, output);
      process.stdout.write(`Wrote ${outputPath}\n`);
    } else {
      process.stdout.write(output);
    }
  } finally {
    await client.end();
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Cloud SQL schema-state capture failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
