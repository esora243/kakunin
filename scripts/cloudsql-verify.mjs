import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import pg from "pg";
import { migrate } from "./cloudsql-migrate.mjs";
import {
  captureSchemaState,
  loadExpectedSchemaState,
  schemaStateChecksum,
} from "./cloudsql-schema-state.mjs";
import {
  ADMIN_RUNTIME_GRANTS,
  privilegeMapDifferences,
  PUBLIC_RUNTIME_GRANTS,
} from "./cloudsql-runtime-policy.mjs";

const { Client } = pg;
const REQUIRED_CAPABILITY_ROLES = ["hugmeid_schema_owner", "hugmeid_public_runtime", "hugmeid_admin_runtime"];
const VALID_ENVIRONMENTS = new Set(["local", "staging", "production"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function comparePrivilegeMaps(actualRows, roleName, expected) {
  const differences = privilegeMapDifferences(actualRows, roleName, expected);
  assert(differences.length === 0, `${roleName} has incorrect table grants: ${differences.join("; ")}`);
}

async function verifyRoleSafety(client, roleName, expectedMembership, expectedDatabase) {
  const { rows } = await client.query(
    `select
       r.rolname,
       r.rolcanlogin,
       r.rolsuper,
       r.rolcreatedb,
       r.rolcreaterole,
       r.rolreplication,
       r.rolbypassrls,
       r.rolinherit,
       exists (
         select 1
         from pg_catalog.pg_auth_members m
         join pg_catalog.pg_roles parent on parent.oid = m.roleid
         where m.member = r.oid
           and parent.rolname = 'cloudsqlsuperuser'
       ) as cloudsqlsuperuser_member
     from pg_catalog.pg_roles r
     where r.rolname = $1`,
    [roleName],
  );
  const role = rows[0];
  assert(role, `Missing database role ${roleName}`);
  assert(
    !role.rolsuper &&
      !role.rolcreatedb &&
      !role.rolcreaterole &&
      !role.rolreplication &&
      !role.rolbypassrls &&
      role.rolinherit &&
      !role.cloudsqlsuperuser_member,
    `Role ${roleName} has unsafe PostgreSQL capabilities, NOINHERIT, or cloudsqlsuperuser membership`,
  );

  if (expectedMembership) {
    assert(role.rolcanlogin, `Runtime principal ${roleName} must be a login/IAM principal`);
    const membershipResult = await client.query(
      `with recursive target as (
         select oid from pg_catalog.pg_roles where rolname = $1
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
       )
       select
         coalesce(
           (
             select array_agg(distinct parent.rolname::text order by parent.rolname::text)
             from inherited_roles
             join pg_catalog.pg_roles parent on parent.oid = inherited_roles.roleid
           ),
           array[]::text[]
         ) as memberships,
         exists (
           select 1
           from pg_catalog.pg_auth_members membership
           join pg_catalog.pg_roles parent on parent.oid = membership.roleid
           where membership.member = (select oid from target)
             and parent.rolname = $2
         ) as intended_direct_membership,
         not exists (
           select 1
           from pg_catalog.pg_auth_members membership
           where membership.member = (select oid from target)
             and (
               membership.admin_option
               or not membership.inherit_option
               or not membership.set_option
             )
         ) as membership_options_safe`,
      [roleName, expectedMembership],
    );
    const memberships = membershipResult.rows[0]?.memberships ?? [];
    assert(
      memberships.length === 1 && memberships[0] === expectedMembership,
      `Runtime principal ${roleName} has unexpected direct/transitive memberships: ${memberships.join(", ")}`,
    );
    assert(
      membershipResult.rows[0]?.intended_direct_membership === true &&
        membershipResult.rows[0]?.membership_options_safe === true,
      `Runtime principal ${roleName} needs a safe direct membership edge to ${expectedMembership} ` +
        "(ADMIN FALSE, INHERIT TRUE, SET TRUE required)",
    );

    const directAclResult = await client.query(
      `with target as (
         select oid from pg_catalog.pg_roles where rolname = $1
       ),
       direct_acl as (
         select 'database' as kind, d.datname as object_name, acl.privilege_type
         from pg_catalog.pg_database d
         cross join lateral pg_catalog.aclexplode(d.datacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'schema', n.nspname, acl.privilege_type
         from pg_catalog.pg_namespace n
         cross join lateral pg_catalog.aclexplode(n.nspacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'relation', n.nspname || '.' || c.relname, acl.privilege_type
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         cross join lateral pg_catalog.aclexplode(c.relacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'column', n.nspname || '.' || c.relname || '.' || a.attname, acl.privilege_type
         from pg_catalog.pg_attribute a
         join pg_catalog.pg_class c on c.oid = a.attrelid
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         cross join lateral pg_catalog.aclexplode(a.attacl) acl
         where acl.grantee = (select oid from target)
           and a.attnum > 0
           and not a.attisdropped
         union all
         select 'routine', n.nspname || '.' || p.proname, acl.privilege_type
         from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         cross join lateral pg_catalog.aclexplode(p.proacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'type', n.nspname || '.' || t.typname, acl.privilege_type
         from pg_catalog.pg_type t
         join pg_catalog.pg_namespace n on n.oid = t.typnamespace
         cross join lateral pg_catalog.aclexplode(t.typacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'language', l.lanname, acl.privilege_type
         from pg_catalog.pg_language l
         cross join lateral pg_catalog.aclexplode(l.lanacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'foreign_data_wrapper', w.fdwname, acl.privilege_type
         from pg_catalog.pg_foreign_data_wrapper w
         cross join lateral pg_catalog.aclexplode(w.fdwacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'foreign_server', s.srvname, acl.privilege_type
         from pg_catalog.pg_foreign_server s
         cross join lateral pg_catalog.aclexplode(s.srvacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'large_object', l.oid::text, acl.privilege_type
         from pg_catalog.pg_largeobject_metadata l
         cross join lateral pg_catalog.aclexplode(l.lomacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'tablespace', t.spcname, acl.privilege_type
         from pg_catalog.pg_tablespace t
         cross join lateral pg_catalog.aclexplode(t.spcacl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'parameter', p.parname, acl.privilege_type
         from pg_catalog.pg_parameter_acl p
         cross join lateral pg_catalog.aclexplode(p.paracl) acl
         where acl.grantee = (select oid from target)
         union all
         select 'default_acl', coalesce(n.nspname, '') || ':' || d.defaclobjtype::text, acl.privilege_type
         from pg_catalog.pg_default_acl d
         left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
         cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
         where acl.grantee = (select oid from target)
       )
       select kind, object_name, privilege_type
       from direct_acl
       order by kind, object_name, privilege_type`,
      [roleName],
    );
    const currentDatabaseResult = await client.query("select current_database() as name");
    const currentDatabase = currentDatabaseResult.rows[0]?.name;
    const expectedDirectAcls = expectedDatabase
      ? [
          {
            kind: "database",
            object_name: expectedDatabase,
            privilege_type: "CONNECT",
          },
        ]
      : [];
    const localDirectAclsAreSafe =
      !expectedDatabase &&
      (directAclResult.rows.length === 0 ||
        isDeepStrictEqual(directAclResult.rows, [
          {
            kind: "database",
            object_name: currentDatabase,
            privilege_type: "CONNECT",
          },
        ]));
    assert(
      localDirectAclsAreSafe || isDeepStrictEqual(directAclResult.rows, expectedDirectAcls),
      `Runtime principal ${roleName} has incorrect direct ACLs: ` +
        `expected ${JSON.stringify(expectedDirectAcls)}, got ${JSON.stringify(directAclResult.rows)}`,
    );
  } else {
    assert(!role.rolcanlogin, `Capability role ${roleName} must be NOLOGIN`);
    const membershipResult = await client.query(
      `with recursive inherited_roles(roleid, path) as (
         select m.roleid, array[m.roleid]
         from pg_catalog.pg_auth_members m
         join pg_catalog.pg_roles target on target.oid = m.member
         where target.rolname = $1
         union all
         select m.roleid, inherited_roles.path || m.roleid
         from inherited_roles
         join pg_catalog.pg_auth_members m on m.member = inherited_roles.roleid
         where not m.roleid = any(inherited_roles.path)
       )
       select coalesce(
         array_agg(distinct parent.rolname::text order by parent.rolname::text),
         array[]::text[]
       ) as memberships
       from inherited_roles
       join pg_catalog.pg_roles parent on parent.oid = inherited_roles.roleid`,
      [roleName],
    );
    const memberships = membershipResult.rows[0]?.memberships ?? [];
    assert(
      memberships.length === 0,
      `Capability role ${roleName} inherits unexpected roles: ${memberships.join(", ")}`,
    );
  }
}

export async function verifyDatabaseConnectIsolation(
  client,
  { expectedDatabase, publicLoginRole, adminLoginRole, operatorLoginRole },
) {
  assert(
    [expectedDatabase, publicLoginRole, adminLoginRole, operatorLoginRole].every(
      (value) => typeof value === "string" && value.length > 0,
    ),
    "Database isolation verification requires exact database, public, admin, and operator role names",
  );
  assert(
    new Set([publicLoginRole, adminLoginRole, operatorLoginRole]).size === 3,
    "Public, admin, and operator login roles must be distinct",
  );
  assert(
    operatorLoginRole === "postgres",
    "Operator login role must be the reviewed postgres principal",
  );
  const databaseAclResult = await client.query(
    `select
       case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
       grantor.rolname as grantor,
       acl.privilege_type,
       acl.is_grantable
     from pg_catalog.pg_database database
     cross join lateral pg_catalog.aclexplode(database.datacl) acl
     left join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
     join pg_catalog.pg_roles grantor on grantor.oid = acl.grantor
     where database.datname = $1
     order by grantee, privilege_type`,
    [expectedDatabase],
  );
  const aclRows = databaseAclResult.rows;
  const publicRows = aclRows.filter((row) => row.grantee === "PUBLIC");
  assert(
    publicRows.length === 0,
    `PUBLIC retains database privileges on ${expectedDatabase}: ${JSON.stringify(publicRows)}`,
  );

  for (const loginRole of [publicLoginRole, adminLoginRole]) {
    const directConnectRows = aclRows.filter((row) => row.grantee === loginRole);
    assert(
      isDeepStrictEqual(directConnectRows, [
        {
          grantee: loginRole,
          grantor: "hugmeid_schema_owner",
          privilege_type: "CONNECT",
          is_grantable: false,
        },
      ]),
      `Runtime principal ${loginRole} has incorrect database ACLs: ${JSON.stringify(directConnectRows)}`,
    );
  }

  const operatorRows = aclRows.filter((row) => row.grantee === operatorLoginRole);
  assert(
    isDeepStrictEqual(operatorRows, [
      {
        grantee: operatorLoginRole,
        grantor: "hugmeid_schema_owner",
        privilege_type: "CONNECT",
        is_grantable: false,
      },
    ]),
    `Operator principal ${operatorLoginRole} has incorrect database ACLs: ${JSON.stringify(operatorRows)}`,
  );
  const allowedGrantees = new Set([
    publicLoginRole,
    adminLoginRole,
    operatorLoginRole,
    "hugmeid_schema_owner",
  ]);
  const unexpectedAclRows = aclRows.filter((row) => {
    if (!allowedGrantees.has(row.grantee)) return true;
    if (row.grantee !== "hugmeid_schema_owner") return false;
    return (
      row.grantor !== "hugmeid_schema_owner" ||
      !["CONNECT", "CREATE", "TEMPORARY"].includes(row.privilege_type) ||
      row.is_grantable
    );
  });
  assert(
    unexpectedAclRows.length === 0,
    `Database ${expectedDatabase} has unexpected ACLs: ${JSON.stringify(unexpectedAclRows)}`,
  );

  const operatorConnectResult = await client.query(
    `select
       exists (
         select 1
         from pg_catalog.pg_roles
         where rolname = $1 and rolcanlogin
       ) as operator_exists,
       pg_catalog.has_database_privilege($1, $2, 'CONNECT') as operator_can_connect`,
    [operatorLoginRole, expectedDatabase],
  );
  assert(
    operatorConnectResult.rows[0]?.operator_exists === true &&
      operatorConnectResult.rows[0]?.operator_can_connect === true,
    `Operator principal ${operatorLoginRole} cannot CONNECT to ${expectedDatabase}`,
  );

  for (const [capabilityRole, expectedLoginRole] of [
    ["hugmeid_public_runtime", publicLoginRole],
    ["hugmeid_admin_runtime", adminLoginRole],
  ]) {
    const connectResult = await client.query(
      `with recursive capability as (
         select oid from pg_catalog.pg_roles where rolname = $1
       ),
       members(member_oid, path) as (
         select membership.member, array[membership.member]
         from pg_catalog.pg_auth_members membership
         where membership.roleid = (select oid from capability)
         union all
         select membership.member, members.path || membership.member
         from members
         join pg_catalog.pg_auth_members membership
           on membership.roleid = members.member_oid
         where not membership.member = any(members.path)
       )
       select
         login.rolname,
         pg_catalog.has_database_privilege(login.oid, $2, 'CONNECT') as can_connect
       from members
       join pg_catalog.pg_roles login on login.oid = members.member_oid
       where login.rolcanlogin
       order by login.rolname`,
      [capabilityRole, expectedDatabase],
    );
    const permittedMembers = connectResult.rows
      .filter((row) => row.can_connect)
      .map((row) => row.rolname);
    assert(
      isDeepStrictEqual(permittedMembers, [expectedLoginRole]),
      `${capabilityRole} has cross-database login access: ${JSON.stringify(connectResult.rows)}`,
    );
  }

  const effectiveConnectResult = await client.query(
    `select role.rolname
     from pg_catalog.pg_roles role
     where role.rolcanlogin
       and pg_catalog.has_database_privilege(role.oid, $1, 'CONNECT')
     order by role.rolname`,
    [expectedDatabase],
  );
  // Cloud SQL's provider-managed cloudsqladmin login is a control-plane
  // exception. It is not an application principal and cannot be governed by
  // customer database ACLs. Every other LOGIN role is compared exactly.
  const effectiveConnectLogins = effectiveConnectResult.rows
    .map((row) => row.rolname)
    .filter((roleName) => roleName !== "cloudsqladmin");
  const expectedConnectLogins = [publicLoginRole, adminLoginRole, operatorLoginRole].sort();
  assert(
    isDeepStrictEqual(effectiveConnectLogins, expectedConnectLogins),
    `Database ${expectedDatabase} has unexpected effective CONNECT logins: ` +
      `expected ${JSON.stringify(expectedConnectLogins)}, got ${JSON.stringify(effectiveConnectLogins)}`,
  );
}

async function verifyEffectiveTablePrivileges(client, roleName, expected) {
  const { rows } = await client.query(
    `select
       c.relname as table_name,
       p.privilege,
       pg_catalog.has_table_privilege($1, c.oid, p.privilege) as allowed
     from pg_catalog.pg_class c
     join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     cross join (
       values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')
     ) as p(privilege)
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
     order by c.relname, p.privilege`,
    [roleName],
  );

  for (const row of rows) {
    const shouldBeAllowed = expected[row.table_name]?.has(row.privilege) ?? false;
    assert(
      row.allowed === shouldBeAllowed,
      `Runtime principal ${roleName} effective ${row.privilege} on ${row.table_name} is ${row.allowed}, expected ${shouldBeAllowed}`,
    );
  }
}

export async function verifyDatabase({
  client,
  expectedEnvironment,
  schemaOwnerRole = "hugmeid_schema_owner",
  publicLoginRole,
  adminLoginRole,
  operatorLoginRole,
  expectedDatabase,
}) {
  await migrate({
    client,
    expectedEnvironment,
    schemaOwnerRole,
    expectedDatabase,
    verifyOnly: true,
  });

  for (const roleName of REQUIRED_CAPABILITY_ROLES) {
    await verifyRoleSafety(client, roleName);
  }
  const isolationEnabled =
    expectedEnvironment !== "local" || Boolean(expectedDatabase && operatorLoginRole);
  const isolatedDatabase = isolationEnabled ? expectedDatabase : undefined;
  if (publicLoginRole) {
    await verifyRoleSafety(client, publicLoginRole, "hugmeid_public_runtime", isolatedDatabase);
  }
  if (adminLoginRole) {
    await verifyRoleSafety(client, adminLoginRole, "hugmeid_admin_runtime", isolatedDatabase);
  }
  if (isolationEnabled) {
    await verifyDatabaseConnectIsolation(client, {
      expectedDatabase,
      publicLoginRole,
      adminLoginRole,
      operatorLoginRole,
    });
  }
  if (publicLoginRole) await verifyEffectiveTablePrivileges(client, publicLoginRole, PUBLIC_RUNTIME_GRANTS);
  if (adminLoginRole) await verifyEffectiveTablePrivileges(client, adminLoginRole, ADMIN_RUNTIME_GRANTS);

  const ownerResult = await client.query(
    `select tablename, tableowner
     from pg_catalog.pg_tables
     where schemaname = 'public'
       and tableowner <> $1
     order by tablename`,
    [schemaOwnerRole],
  );
  assert(ownerResult.rowCount === 0, `Unexpected table owners: ${JSON.stringify(ownerResult.rows)}`);

  const functionOwnerResult = await client.query(
    `select p.proname, owner.rolname as owner
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     join pg_catalog.pg_roles owner on owner.oid = p.proowner
     where n.nspname = 'public'
       and not exists (
         select 1
         from pg_catalog.pg_depend d
         where d.classid = 'pg_proc'::regclass
           and d.objid = p.oid
           and d.deptype = 'e'
       )
       and owner.rolname <> $1
     order by p.proname`,
    [schemaOwnerRole],
  );
  assert(
    functionOwnerResult.rowCount === 0,
    `Unexpected application-function owners: ${JSON.stringify(functionOwnerResult.rows)}`,
  );

  const structureResult = await client.query(`
    select
      to_regclass('public.bookmarks') is null as legacy_bookmarks_absent,
      to_regclass('public.user_legal_consents') is not null as legal_consents_present,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'admin_users' and column_name = 'deleted_at'
      ) as admin_deleted_at_present,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'assets' and column_name = 'purged_at'
      ) as asset_purged_at_present,
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'contents' and column_name = 'first_published_at'
      ) as first_published_at_present,
      not exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'contents'
          and column_name in ('author_or_source', 'source_name', 'source_url', 'source_last_modified_at', 'synced_at')
      ) as legacy_content_columns_absent
  `);
  const structure = structureResult.rows[0];
  assert(
    Object.values(structure).every((value) => value === true),
    `Schema does not match the release baseline: ${JSON.stringify(structure)}`,
  );

  const grantsResult = await client.query(
    `select grantee, table_name, privilege_type
     from information_schema.table_privileges
     where table_schema = 'public'
       and grantee in ('hugmeid_public_runtime', 'hugmeid_admin_runtime', 'PUBLIC')
     order by grantee, table_name, privilege_type`,
  );
  comparePrivilegeMaps(grantsResult.rows, "hugmeid_public_runtime", PUBLIC_RUNTIME_GRANTS);
  comparePrivilegeMaps(grantsResult.rows, "hugmeid_admin_runtime", ADMIN_RUNTIME_GRANTS);
  assert(
    grantsResult.rows.every((row) => row.grantee !== "PUBLIC"),
    "PUBLIC retains table privileges in the application schema",
  );

  for (const runtimeRole of ["hugmeid_public_runtime", "hugmeid_admin_runtime"]) {
    const schemaPrivilegeResult = await client.query(
      `select
         has_schema_privilege($1, 'public', 'USAGE') as can_use,
         has_schema_privilege($1, 'public', 'CREATE') as can_create`,
      [runtimeRole],
    );
    assert(schemaPrivilegeResult.rows[0]?.can_use === true, `${runtimeRole} lacks schema USAGE`);
    assert(schemaPrivilegeResult.rows[0]?.can_create === false, `${runtimeRole} can CREATE in public`);
  }

  for (const loginRole of [publicLoginRole, adminLoginRole].filter(Boolean)) {
    const ownershipResult = await client.query(
      `with target as (
         select oid from pg_catalog.pg_roles where rolname = $1
       ),
       owned as (
         select 'database' as kind, d.datname as object_name
         from pg_catalog.pg_database d where d.datdba = (select oid from target)
         union all
         select 'schema', n.nspname
         from pg_catalog.pg_namespace n where n.nspowner = (select oid from target)
         union all
         select 'relation', n.nspname || '.' || c.relname
         from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where c.relowner = (select oid from target)
         union all
         select 'routine', n.nspname || '.' || p.proname
         from pg_catalog.pg_proc p
         join pg_catalog.pg_namespace n on n.oid = p.pronamespace
         where p.proowner = (select oid from target)
         union all
         select 'type', n.nspname || '.' || t.typname
         from pg_catalog.pg_type t
         join pg_catalog.pg_namespace n on n.oid = t.typnamespace
         where t.typowner = (select oid from target)
         union all
         select 'extension', e.extname
         from pg_catalog.pg_extension e
         where e.extowner = (select oid from target)
         union all
         select 'collation', n.nspname || '.' || c.collname
         from pg_catalog.pg_collation c
         join pg_catalog.pg_namespace n on n.oid = c.collnamespace
         where c.collowner = (select oid from target)
         union all
         select 'conversion', n.nspname || '.' || c.conname
         from pg_catalog.pg_conversion c
         join pg_catalog.pg_namespace n on n.oid = c.connamespace
         where c.conowner = (select oid from target)
         union all
         select 'operator', n.nspname || '.' || o.oprname
         from pg_catalog.pg_operator o
         join pg_catalog.pg_namespace n on n.oid = o.oprnamespace
         where o.oprowner = (select oid from target)
         union all
         select 'operator_class', n.nspname || '.' || o.opcname
         from pg_catalog.pg_opclass o
         join pg_catalog.pg_namespace n on n.oid = o.opcnamespace
         where o.opcowner = (select oid from target)
         union all
         select 'operator_family', n.nspname || '.' || o.opfname
         from pg_catalog.pg_opfamily o
         join pg_catalog.pg_namespace n on n.oid = o.opfnamespace
         where o.opfowner = (select oid from target)
         union all
         select 'event_trigger', e.evtname
         from pg_catalog.pg_event_trigger e
         where e.evtowner = (select oid from target)
         union all
         select 'foreign_data_wrapper', w.fdwname
         from pg_catalog.pg_foreign_data_wrapper w
         where w.fdwowner = (select oid from target)
         union all
         select 'foreign_server', s.srvname
         from pg_catalog.pg_foreign_server s
         where s.srvowner = (select oid from target)
         union all
         select 'language', l.lanname
         from pg_catalog.pg_language l
         where l.lanowner = (select oid from target)
         union all
         select 'text_search_configuration', n.nspname || '.' || c.cfgname
         from pg_catalog.pg_ts_config c
         join pg_catalog.pg_namespace n on n.oid = c.cfgnamespace
         where c.cfgowner = (select oid from target)
         union all
         select 'text_search_dictionary', n.nspname || '.' || d.dictname
         from pg_catalog.pg_ts_dict d
         join pg_catalog.pg_namespace n on n.oid = d.dictnamespace
         where d.dictowner = (select oid from target)
         union all
         select 'publication', p.pubname
         from pg_catalog.pg_publication p
         where p.pubowner = (select oid from target)
         union all
         select 'subscription', s.subname
         from pg_catalog.pg_subscription s
         where s.subowner = (select oid from target)
         union all
         select 'statistics', n.nspname || '.' || s.stxname
         from pg_catalog.pg_statistic_ext s
         join pg_catalog.pg_namespace n on n.oid = s.stxnamespace
         where s.stxowner = (select oid from target)
         union all
         select 'large_object', l.oid::text
         from pg_catalog.pg_largeobject_metadata l
         where l.lomowner = (select oid from target)
         union all
         select 'tablespace', t.spcname
         from pg_catalog.pg_tablespace t
         where t.spcowner = (select oid from target)
         union all
         select 'default_acl', coalesce(n.nspname, '') || ':' || d.defaclobjtype::text
         from pg_catalog.pg_default_acl d
         left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
         where d.defaclrole = (select oid from target)
       )
       select kind, object_name from owned order by kind, object_name`,
      [loginRole],
    );
    assert(
      ownershipResult.rowCount === 0,
      `Runtime principal ${loginRole} owns database objects: ${JSON.stringify(ownershipResult.rows)}`,
    );
    const schemaPrivilegeResult = await client.query(
      `select
         has_schema_privilege($1, 'public', 'USAGE') as can_use,
         has_schema_privilege($1, 'public', 'CREATE') as can_create`,
      [loginRole],
    );
    assert(schemaPrivilegeResult.rows[0]?.can_use === true, `Runtime principal ${loginRole} lacks schema USAGE`);
    assert(schemaPrivilegeResult.rows[0]?.can_create === false, `Runtime principal ${loginRole} can CREATE in public`);

    const routineResult = await client.query(
      `select p.proname
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_proc'::regclass
             and d.objid = p.oid
             and d.deptype = 'e'
         )
         and pg_catalog.has_function_privilege($1, p.oid, 'EXECUTE')
       order by p.proname`,
      [loginRole],
    );
    assert(
      routineResult.rowCount === 0,
      `Runtime principal ${loginRole} can execute application routines: ${JSON.stringify(routineResult.rows)}`,
    );
  }

  const routinePrivilegeResult = await client.query(
    `select count(*)::int as count
     from pg_catalog.pg_proc p
     join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
         select 1
         from pg_catalog.pg_depend d
         where d.classid = 'pg_proc'::regclass
           and d.objid = p.oid
           and d.deptype = 'e'
       )
       and (
         has_function_privilege('hugmeid_public_runtime', p.oid, 'EXECUTE')
         or has_function_privilege('hugmeid_admin_runtime', p.oid, 'EXECUTE')
       )`,
  );
  assert(routinePrivilegeResult.rows[0]?.count === 0, "A runtime role can execute public-schema routines");

  const expectedSchema = loadExpectedSchemaState();
  const expectedChecksum = schemaStateChecksum(expectedSchema.state);
  assert(
    expectedChecksum === expectedSchema.checksumSha256,
    "Checked-in expected schema-state checksum is internally inconsistent",
  );
  const actualSchemaState = await captureSchemaState(client);
  const actualChecksum = schemaStateChecksum(actualSchemaState);
  assert(
    actualChecksum === expectedSchema.checksumSha256 && isDeepStrictEqual(actualSchemaState, expectedSchema.state),
    `Full schema-state mismatch: expected ${expectedSchema.checksumSha256}, got ${actualChecksum}`,
  );

  return {
    environment: expectedEnvironment,
    publicLoginRole: publicLoginRole ?? null,
    adminLoginRole: adminLoginRole ?? null,
    tablesOwnedBy: schemaOwnerRole,
    grantsVerified: true,
    schemaStateChecksumSha256: actualChecksum,
  };
}

function parseCliArguments(argv) {
  const options = {
    expectedEnvironment: process.env.HUGMEID_DATABASE_ENV,
    publicLoginRole: process.env.HUGMEID_PUBLIC_LOGIN_ROLE,
    adminLoginRole: process.env.HUGMEID_ADMIN_LOGIN_ROLE,
    operatorLoginRole: process.env.HUGMEID_OPERATOR_LOGIN_ROLE,
    schemaOwnerRole: process.env.HUGMEID_SCHEMA_OWNER_ROLE ?? "hugmeid_schema_owner",
    expectedDatabase: process.env.HUGMEID_EXPECTED_DATABASE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--environment") {
      options.expectedEnvironment = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--environment=")) {
      options.expectedEnvironment = argument.slice("--environment=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  assert(VALID_ENVIRONMENTS.has(options.expectedEnvironment), "Set --environment to local, staging, or production");
  if (options.expectedEnvironment !== "local") {
    assert(options.expectedDatabase, "HUGMEID_EXPECTED_DATABASE is required outside local");
    assert(options.publicLoginRole, "HUGMEID_PUBLIC_LOGIN_ROLE is required outside local");
    assert(options.adminLoginRole, "HUGMEID_ADMIN_LOGIN_ROLE is required outside local");
    assert(options.operatorLoginRole, "HUGMEID_OPERATOR_LOGIN_ROLE is required outside local");
  }
  return options;
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const client = new Client({ application_name: "hugmeid-cloudsql-verify" });
  await client.connect();
  try {
    const result = await verifyDatabase({ client, ...options });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Cloud SQL verification failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
