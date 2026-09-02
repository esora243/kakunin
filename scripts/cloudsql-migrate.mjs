import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  privilegeMapDifferences,
  RUNTIME_GRANTS_BY_ROLE,
} from "./cloudsql-runtime-policy.mjs";

const { Client } = pg;
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_SOURCES = [
  { kind: "baseline", relativeDirectory: "cloudsql/baseline" },
  { kind: "migration", relativeDirectory: "cloudsql/migrations" },
  { kind: "seed", relativeDirectory: "cloudsql/seeds" },
];
const ARTIFACT_NAME = /^([0-9]{14})_([a-z0-9_]+)\.sql$/;
const SAFE_ROLE_NAME = /^[a-z_][a-z0-9_]*$/;
const VALID_ENVIRONMENTS = new Set(["local", "staging", "production"]);
const ADVISORY_LOCK_NAMESPACE = 720260730;
const ADVISORY_LOCK_KEY = 1;

function checksum(contents) {
  return createHash("sha256").update(contents, "utf8").digest("hex");
}

function quoteIdentifier(identifier) {
  if (!SAFE_ROLE_NAME.test(identifier)) {
    throw new Error(`Unsafe PostgreSQL role name: ${identifier}`);
  }
  return `"${identifier}"`;
}

export function discoverArtifacts(repositoryRoot = REPOSITORY_ROOT) {
  const artifacts = [];

  for (const source of ARTIFACT_SOURCES) {
    const directory = join(repositoryRoot, source.relativeDirectory);
    if (!existsSync(directory)) continue;

    for (const filename of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
      const match = ARTIFACT_NAME.exec(filename);
      if (!match) {
        throw new Error(
          `Invalid ${source.kind} filename ${source.relativeDirectory}/${filename}; expected YYYYMMDDHHMMSS_name.sql`,
        );
      }

      const path = join(directory, filename);
      const sql = readFileSync(path, "utf8");
      artifacts.push({
        version: match[1],
        name: match[2],
        filename,
        kind: source.kind,
        path,
        sql,
        checksumSha256: checksum(sql),
      });
    }
  }

  artifacts.sort((left, right) => left.version.localeCompare(right.version));

  const duplicateVersions = artifacts
    .filter((artifact, index) => index > 0 && artifact.version === artifacts[index - 1].version)
    .map((artifact) => artifact.version);
  if (duplicateVersions.length > 0) {
    throw new Error(`Duplicate Cloud SQL artifact version(s): ${[...new Set(duplicateVersions)].join(", ")}`);
  }

  const baselines = artifacts.filter((artifact) => artifact.kind === "baseline");
  if (baselines.length !== 1) {
    throw new Error(`Expected exactly one schema baseline, found ${baselines.length}`);
  }
  if (artifacts[0] !== baselines[0]) {
    throw new Error("The schema baseline must be the earliest versioned Cloud SQL artifact");
  }

  return artifacts;
}

async function inspectCapabilityRoleObjects(
  client,
  roleName,
  schemaOwnerRole,
  hasRegistry,
  enforceRuntimeGrantPolicy = true,
) {
  const { rows: ownedObjects } = await client.query(
    `with target as (
       select oid from pg_catalog.pg_roles where rolname = $1
     )
     select kind, schema, object_name
     from (
       select 'database' as kind, null::text as schema, d.datname as object_name
       from pg_catalog.pg_database d
       where d.datdba = (select oid from target)
         and d.datname = current_database()
       union all
       select 'schema', n.nspname, n.nspname
       from pg_catalog.pg_namespace n
       where n.nspowner = (select oid from target)
       union all
       select 'relation', n.nspname, c.relname
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relowner = (select oid from target)
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_class'::regclass
             and d.objid = c.oid
             and d.deptype = 'e'
         )
       union all
       select 'routine', n.nspname, p.proname
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where p.proowner = (select oid from target)
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_proc'::regclass
             and d.objid = p.oid
             and d.deptype = 'e'
         )
       union all
       select 'type', n.nspname, t.typname
       from pg_catalog.pg_type t
       join pg_catalog.pg_namespace n on n.oid = t.typnamespace
       where t.typowner = (select oid from target)
         and not exists (
           select 1
           from pg_catalog.pg_depend d
           where d.classid = 'pg_type'::regclass
             and d.objid = t.oid
             and d.deptype = 'e'
         )
       union all
       select 'extension', null::text, e.extname
       from pg_catalog.pg_extension e
       where e.extowner = (select oid from target)
       union all
       select 'collation', n.nspname, c.collname
       from pg_catalog.pg_collation c
       join pg_catalog.pg_namespace n on n.oid = c.collnamespace
       where c.collowner = (select oid from target)
       union all
       select 'conversion', n.nspname, c.conname
       from pg_catalog.pg_conversion c
       join pg_catalog.pg_namespace n on n.oid = c.connamespace
       where c.conowner = (select oid from target)
       union all
       select 'operator', n.nspname, o.oprname
       from pg_catalog.pg_operator o
       join pg_catalog.pg_namespace n on n.oid = o.oprnamespace
       where o.oprowner = (select oid from target)
       union all
       select 'operator_class', n.nspname, o.opcname
       from pg_catalog.pg_opclass o
       join pg_catalog.pg_namespace n on n.oid = o.opcnamespace
       where o.opcowner = (select oid from target)
       union all
       select 'operator_family', n.nspname, o.opfname
       from pg_catalog.pg_opfamily o
       join pg_catalog.pg_namespace n on n.oid = o.opfnamespace
       where o.opfowner = (select oid from target)
       union all
       select 'event_trigger', null::text, e.evtname
       from pg_catalog.pg_event_trigger e
       where e.evtowner = (select oid from target)
       union all
       select 'foreign_data_wrapper', null::text, w.fdwname
       from pg_catalog.pg_foreign_data_wrapper w
       where w.fdwowner = (select oid from target)
       union all
       select 'foreign_server', null::text, s.srvname
       from pg_catalog.pg_foreign_server s
       where s.srvowner = (select oid from target)
       union all
       select 'language', null::text, l.lanname
       from pg_catalog.pg_language l
       where l.lanowner = (select oid from target)
       union all
       select 'text_search_configuration', n.nspname, c.cfgname
       from pg_catalog.pg_ts_config c
       join pg_catalog.pg_namespace n on n.oid = c.cfgnamespace
       where c.cfgowner = (select oid from target)
       union all
       select 'text_search_dictionary', n.nspname, d.dictname
       from pg_catalog.pg_ts_dict d
       join pg_catalog.pg_namespace n on n.oid = d.dictnamespace
       where d.dictowner = (select oid from target)
       union all
       select 'publication', null::text, p.pubname
       from pg_catalog.pg_publication p
       where p.pubowner = (select oid from target)
       union all
       select 'subscription', null::text, s.subname
       from pg_catalog.pg_subscription s
       where s.subowner = (select oid from target)
       union all
       select 'statistics', n.nspname, s.stxname
       from pg_catalog.pg_statistic_ext s
       join pg_catalog.pg_namespace n on n.oid = s.stxnamespace
       where s.stxowner = (select oid from target)
       union all
       select 'large_object', null::text, l.oid::text
       from pg_catalog.pg_largeobject_metadata l
       where l.lomowner = (select oid from target)
       union all
       select 'tablespace', null::text, t.spcname
       from pg_catalog.pg_tablespace t
       where t.spcowner = (select oid from target)
       union all
       select 'default_acl', coalesce(n.nspname, ''), d.defaclobjtype::text
       from pg_catalog.pg_default_acl d
       left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
       where d.defaclrole = (select oid from target)
     ) owned
     order by kind, schema, object_name`,
    [roleName],
  );
  const invalidOwnership = ownedObjects.filter(
    (object) =>
      roleName !== schemaOwnerRole ||
      !(
        object.kind === "database" ||
        (object.kind === "extension" && object.object_name === "pgcrypto") ||
        (hasRegistry &&
          ["relation", "routine", "type"].includes(object.kind) &&
          (object.schema === "public" ||
            (object.kind === "relation" && object.schema?.startsWith("pg_toast"))))
      ),
  );
  if (invalidOwnership.length > 0) {
    throw new Error(
      `Capability role ${roleName} owns unexpected database objects: ${JSON.stringify(
        invalidOwnership.slice(0, 20),
      )}`,
    );
  }

  const { rows: directAcl } = await client.query(
    `with target as (
       select oid from pg_catalog.pg_roles where rolname = $1
     )
     select kind, schema, object_name, privilege_type, is_owner
     from (
       select
         'database' as kind,
         null::text as schema,
         d.datname as object_name,
         acl.privilege_type,
         d.datdba = (select oid from target) as is_owner
       from pg_catalog.pg_database d
       cross join lateral pg_catalog.aclexplode(d.datacl) acl
       where acl.grantee = (select oid from target)
       union all
       select
         'schema',
         n.nspname,
         n.nspname,
         acl.privilege_type,
         n.nspowner = (select oid from target)
       from pg_catalog.pg_namespace n
       cross join lateral pg_catalog.aclexplode(n.nspacl) acl
       where acl.grantee = (select oid from target)
       union all
       select
         'relation',
         n.nspname,
         c.relname,
         acl.privilege_type,
         c.relowner = (select oid from target)
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join lateral pg_catalog.aclexplode(c.relacl) acl
       where acl.grantee = (select oid from target)
       union all
       select
         'column',
         n.nspname,
         c.relname || '.' || a.attname,
         acl.privilege_type,
         c.relowner = (select oid from target)
       from pg_catalog.pg_attribute a
       join pg_catalog.pg_class c on c.oid = a.attrelid
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       cross join lateral pg_catalog.aclexplode(a.attacl) acl
       where acl.grantee = (select oid from target)
         and a.attnum > 0
         and not a.attisdropped
       union all
       select
         'routine',
         n.nspname,
         p.proname,
         acl.privilege_type,
         p.proowner = (select oid from target)
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       cross join lateral pg_catalog.aclexplode(p.proacl) acl
       where acl.grantee = (select oid from target)
       union all
       select
         'type',
         n.nspname,
         t.typname,
         acl.privilege_type,
         t.typowner = (select oid from target)
       from pg_catalog.pg_type t
       join pg_catalog.pg_namespace n on n.oid = t.typnamespace
       cross join lateral pg_catalog.aclexplode(t.typacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'language', null::text, l.lanname, acl.privilege_type, l.lanowner = (select oid from target)
       from pg_catalog.pg_language l
       cross join lateral pg_catalog.aclexplode(l.lanacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'foreign_data_wrapper', null::text, w.fdwname, acl.privilege_type,
              w.fdwowner = (select oid from target)
       from pg_catalog.pg_foreign_data_wrapper w
       cross join lateral pg_catalog.aclexplode(w.fdwacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'foreign_server', null::text, s.srvname, acl.privilege_type,
              s.srvowner = (select oid from target)
       from pg_catalog.pg_foreign_server s
       cross join lateral pg_catalog.aclexplode(s.srvacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'large_object', null::text, l.oid::text, acl.privilege_type,
              l.lomowner = (select oid from target)
       from pg_catalog.pg_largeobject_metadata l
       cross join lateral pg_catalog.aclexplode(l.lomacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'tablespace', null::text, t.spcname, acl.privilege_type,
              t.spcowner = (select oid from target)
       from pg_catalog.pg_tablespace t
       cross join lateral pg_catalog.aclexplode(t.spcacl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'parameter', null::text, p.parname, acl.privilege_type, false
       from pg_catalog.pg_parameter_acl p
       cross join lateral pg_catalog.aclexplode(p.paracl) acl
       where acl.grantee = (select oid from target)
       union all
       select 'default_acl', coalesce(n.nspname, ''), d.defaclobjtype::text, acl.privilege_type,
              d.defaclrole = (select oid from target)
       from pg_catalog.pg_default_acl d
       left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
       cross join lateral pg_catalog.aclexplode(d.defaclacl) acl
       where acl.grantee = (select oid from target)
     ) acl
     order by kind, schema, object_name, privilege_type`,
    [roleName],
  );

  let invalidAcl;
  if (roleName === schemaOwnerRole) {
    invalidAcl = directAcl.filter((entry) => {
      if (
        entry.kind === "database" &&
        entry.is_owner &&
        ["CONNECT", "CREATE", "TEMPORARY"].includes(entry.privilege_type)
      ) {
        return false;
      }
      if (
        entry.kind === "schema" &&
        entry.schema === "public" &&
        ["USAGE", "CREATE"].includes(entry.privilege_type)
      ) {
        return false;
      }
      return !(
        hasRegistry &&
        ["relation", "routine", "type"].includes(entry.kind) &&
        entry.schema === "public" &&
        entry.is_owner
      );
    });
  } else {
    const expectedGrants = RUNTIME_GRANTS_BY_ROLE[roleName];
    invalidAcl = directAcl.filter((entry) => {
      if (
        hasRegistry &&
        entry.kind === "schema" &&
        entry.schema === "public" &&
        entry.privilege_type === "USAGE"
      ) {
        return false;
      }
      return !(
        hasRegistry &&
        entry.kind === "relation" &&
        entry.schema === "public" &&
        expectedGrants?.[entry.object_name]?.has(entry.privilege_type)
      );
    });
  }
  if (invalidAcl.length > 0) {
    throw new Error(
      `Capability role ${roleName} has unexpected direct ACLs: ${JSON.stringify(invalidAcl.slice(0, 20))}`,
    );
  }

  const { rows: defaultAcl } = await client.query(
    `select coalesce(n.nspname, '') as schema, d.defaclobjtype as object_type, d.defaclacl::text as acl
     from pg_catalog.pg_default_acl d
     left join pg_catalog.pg_namespace n on n.oid = d.defaclnamespace
     join pg_catalog.pg_roles owner on owner.oid = d.defaclrole
     where owner.rolname = $1
     order by schema, object_type`,
    [roleName],
  );
  if (defaultAcl.length > 0) {
    throw new Error(
      `Capability role ${roleName} has unexpected default ACLs: ${JSON.stringify(defaultAcl)}`,
    );
  }

  if (roleName !== schemaOwnerRole && hasRegistry && enforceRuntimeGrantPolicy) {
    const { rows: actualGrants } = await client.query(
      `select grantee, table_name, privilege_type
       from information_schema.table_privileges
       where table_schema = 'public'
         and grantee = $1
       order by table_name, privilege_type`,
      [roleName],
    );
    const differences = privilegeMapDifferences(actualGrants, roleName, RUNTIME_GRANTS_BY_ROLE[roleName]);
    if (differences.length > 0) {
      throw new Error(`Capability role ${roleName} grant policy drift: ${differences.join("; ")}`);
    }
  }
}

async function inspectSchemaOwner(client, schemaOwnerRole, hasRegistry, enforceRuntimeGrantPolicy = true) {
  const { rows: databaseOwners } = await client.query(
    `select owner.rolname as owner
     from pg_catalog.pg_database database
     join pg_catalog.pg_roles owner on owner.oid = database.datdba
     where database.datname = current_database()`,
  );
  if (databaseOwners[0]?.owner !== schemaOwnerRole) {
    throw new Error(
      `Target database must be owned by ${schemaOwnerRole}; rerun cloudsql/ops/bootstrap_database.sql on an empty target`,
    );
  }

  const { rows: extensionOwners } = await client.query(
    `select owner.rolname as owner
     from pg_catalog.pg_extension extension
     join pg_catalog.pg_roles owner on owner.oid = extension.extowner
     where extension.extname = 'pgcrypto'`,
  );
  if (extensionOwners[0]?.owner !== schemaOwnerRole) {
    throw new Error(
      `pgcrypto must be owned by ${schemaOwnerRole}; rerun cloudsql/ops/bootstrap_database.sql on an empty target`,
    );
  }

  for (const roleName of [schemaOwnerRole, "hugmeid_public_runtime", "hugmeid_admin_runtime"]) {
    const { rows } = await client.query(
      `with recursive target as (
         select * from pg_catalog.pg_roles where rolname = $1
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
         r.rolname,
         r.rolcanlogin,
         r.rolsuper,
         r.rolcreatedb,
         r.rolcreaterole,
         r.rolreplication,
         r.rolbypassrls,
         exists (
           select 1
           from pg_catalog.pg_auth_members membership
           join pg_catalog.pg_roles member on member.oid = membership.member
           where membership.roleid = r.oid
             and member.rolname = current_user
         ) as migrator_membership_exists,
         coalesce((
           select pg_catalog.bool_or(
             membership.inherit_option and membership.set_option
           )
           from pg_catalog.pg_auth_members membership
           join pg_catalog.pg_roles member on member.oid = membership.member
           where membership.roleid = r.oid
             and member.rolname = current_user
         ), false) as migrator_membership_options_safe,
         coalesce(
           (
             select array_agg(parent.rolname::text order by parent.rolname::text)
             from inherited_roles
             join pg_catalog.pg_roles parent on parent.oid = inherited_roles.roleid
           ),
           array[]::text[]
         ) as memberships
       from target r`,
      [roleName],
    );
    const role = rows[0];
    if (!role) {
      throw new Error(`Missing capability role ${roleName}; run cloudsql/ops/bootstrap_roles.sql first`);
    }
    if (
      role.rolcanlogin ||
      role.rolsuper ||
      role.rolcreatedb ||
      role.rolcreaterole ||
      role.rolreplication ||
      role.rolbypassrls ||
      role.memberships.length > 0
    ) {
      throw new Error(
        `Capability role ${roleName} is unsafe or inherits unexpected roles: ${role.memberships.join(", ")}`,
      );
    }
    if (
      roleName === schemaOwnerRole &&
      (!role.migrator_membership_exists || !role.migrator_membership_options_safe)
    ) {
      throw new Error(
        `Current migration principal needs a safe direct membership edge to ${schemaOwnerRole} ` +
          "(INHERIT TRUE and SET TRUE required)",
      );
    }
    await inspectCapabilityRoleObjects(
      client,
      roleName,
      schemaOwnerRole,
      hasRegistry,
      enforceRuntimeGrantPolicy,
    );
  }
}

async function unmanagedDatabaseObjects(client) {
  const { rows } = await client.query(`
    select kind, object_name
    from (
      select 'schema' as kind, n.nspname as object_name
      from pg_catalog.pg_namespace n
      where n.nspname <> 'public'
        and n.nspname <> 'information_schema'
        and n.nspname !~ '^pg_'

      union all

      select 'relation', n.nspname || '.' || c.relname
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not exists (
          select 1
          from pg_catalog.pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
        )

      union all

      select 'routine', n.nspname || '.' || p.proname
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

      union all

      select 'type', n.nspname || '.' || t.typname
      from pg_catalog.pg_type t
      join pg_catalog.pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typtype in ('c', 'd', 'e', 'm', 'r')
        and not exists (
          select 1
          from pg_catalog.pg_depend d
          where d.classid = 'pg_type'::regclass
            and d.objid = t.oid
            and d.deptype in ('e', 'i')
        )

      union all

      select 'extension', e.extname
      from pg_catalog.pg_extension e
      where e.extname not in ('pgcrypto', 'plpgsql')

      union all

      select 'collation', n.nspname || '.' || c.collname
      from pg_catalog.pg_collation c
      join pg_catalog.pg_namespace n on n.oid = c.collnamespace
      where n.nspname = 'public'

      union all

      select 'conversion', n.nspname || '.' || c.conname
      from pg_catalog.pg_conversion c
      join pg_catalog.pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public'

      union all

      select 'operator', n.nspname || '.' || o.oprname
      from pg_catalog.pg_operator o
      join pg_catalog.pg_namespace n on n.oid = o.oprnamespace
      where n.nspname = 'public'

      union all

      select 'operator_class', n.nspname || '.' || o.opcname
      from pg_catalog.pg_opclass o
      join pg_catalog.pg_namespace n on n.oid = o.opcnamespace
      where n.nspname = 'public'

      union all

      select 'operator_family', n.nspname || '.' || o.opfname
      from pg_catalog.pg_opfamily o
      join pg_catalog.pg_namespace n on n.oid = o.opfnamespace
      where n.nspname = 'public'

      union all

      select 'event_trigger', e.evtname
      from pg_catalog.pg_event_trigger e

      union all

      select 'foreign_server', s.srvname
      from pg_catalog.pg_foreign_server s

      union all

      select 'publication', p.pubname
      from pg_catalog.pg_publication p

      union all

      select 'subscription', s.subname
      from pg_catalog.pg_subscription s

      union all

      select 'large_object', l.oid::text
      from pg_catalog.pg_largeobject_metadata l
    ) unmanaged
    order by kind, object_name
  `);
  return rows;
}

async function loadAppliedArtifacts(client) {
  const { rows } = await client.query(
    `select version, name, kind, checksum_sha256, applied_at::text, applied_by
     from public.schema_migrations
     order by version`,
  );
  return new Map(rows.map((row) => [row.version, row]));
}

async function assertTargetAttestation(client, expectedEnvironment, expectedDatabase) {
  const { rows } = await client.query(
    `select
       d.datname as database_name,
       pg_catalog.shobj_description(d.oid, 'pg_database') as attestation
     from pg_catalog.pg_database d
     where d.datname = current_database()`,
  );
  const target = rows[0];
  if (!target) throw new Error("Could not identify the connected PostgreSQL database");

  if (expectedDatabase && target.database_name !== expectedDatabase) {
    throw new Error(
      `Connected database ${target.database_name} does not match HUGMEID_EXPECTED_DATABASE=${expectedDatabase}`,
    );
  }

  if (expectedEnvironment !== "local") {
    if (!expectedDatabase) {
      throw new Error("HUGMEID_EXPECTED_DATABASE is required for staging and production migrations");
    }
    const expectedAttestation = `hugmeid-environment:${expectedEnvironment}`;
    if (target.attestation !== expectedAttestation) {
      throw new Error(
        `Database environment attestation is ${target.attestation ?? "missing"}, expected ${expectedAttestation}`,
      );
    }
  }
}

function assertAppliedArtifactsMatchSource(applied, artifacts) {
  const sourceByVersion = new Map(artifacts.map((artifact) => [artifact.version, artifact]));
  for (const [version, record] of applied) {
    const artifact = sourceByVersion.get(version);
    if (!artifact) {
      throw new Error(`Database has migration ${version}, but this checkout does not; refusing a stale-checkout apply`);
    }
    if (
      record.name !== artifact.name ||
      record.kind !== artifact.kind ||
      record.checksum_sha256 !== artifact.checksumSha256
    ) {
      throw new Error(`Checksum or identity mismatch for applied ${artifact.kind} ${artifact.filename}`);
    }
  }
}

async function applyArtifact(client, artifact, schemaOwnerRole) {
  await client.query("begin");
  try {
    await client.query("set local lock_timeout = '5s'");
    await client.query("set local statement_timeout = '5min'");
    await client.query(`set local role ${quoteIdentifier(schemaOwnerRole)}`);
    await client.query("set local search_path = pg_catalog, public");
    await client.query(artifact.sql);
    await client.query(
      `insert into public.schema_migrations
         (version, name, kind, checksum_sha256)
       values ($1, $2, $3, $4)`,
      [artifact.version, artifact.name, artifact.kind, artifact.checksumSha256],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function ensureEnvironmentSentinel(client, expectedEnvironment, schemaOwnerRole) {
  await client.query("begin");
  try {
    await client.query(`set local role ${quoteIdentifier(schemaOwnerRole)}`);
    await client.query("set local search_path = pg_catalog, public");
    const { rows } = await client.query(
      `select value
       from public.app_environment
       where key = 'database_environment'
       for update`,
    );
    const currentValue = rows[0]?.value;
    if (currentValue && currentValue !== expectedEnvironment) {
      throw new Error(
        `Database environment sentinel is ${currentValue}, not ${expectedEnvironment}; refusing cross-environment mutation`,
      );
    }
    if (!currentValue) {
      await client.query(
        `insert into public.app_environment (key, value)
         values ('database_environment', $1)`,
        [expectedEnvironment],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function migrate({
  client,
  expectedEnvironment,
  schemaOwnerRole = "hugmeid_schema_owner",
  repositoryRoot = REPOSITORY_ROOT,
  verifyOnly = false,
  expectedDatabase,
  confirmedEnvironment,
}) {
  if (!VALID_ENVIRONMENTS.has(expectedEnvironment)) {
    throw new Error(`Invalid expected environment: ${expectedEnvironment}`);
  }

  const artifacts = discoverArtifacts(repositoryRoot);
  const result = { applied: [], pending: [], alreadyApplied: [] };

  if (!verifyOnly && expectedEnvironment !== "local" && confirmedEnvironment !== expectedEnvironment) {
    throw new Error(`Mutation requires --confirm-environment=${expectedEnvironment}`);
  }

  await client.query("select pg_advisory_lock($1, $2)", [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  try {
    await assertTargetAttestation(client, expectedEnvironment, expectedDatabase);
    const extensionResult = await client.query(
      "select exists(select 1 from pg_catalog.pg_extension where extname = 'pgcrypto') as exists",
    );
    if (extensionResult.rows[0]?.exists !== true) {
      throw new Error("Missing pgcrypto extension; run cloudsql/ops/bootstrap_database.sql first");
    }

    const registryResult = await client.query(
      "select to_regclass('public.schema_migrations') is not null as exists",
    );
    const hasRegistry = registryResult.rows[0]?.exists === true;
    const unmanagedObjects = hasRegistry ? [] : await unmanagedDatabaseObjects(client);
    if (!hasRegistry && unmanagedObjects.length > 0) {
      throw new Error(
        `Refusing to apply the baseline to a non-empty unmanaged database; found ${JSON.stringify(
          unmanagedObjects.slice(0, 20),
        )}. Use the reviewed clone-and-cutover path`,
      );
    }
    const applied = hasRegistry ? await loadAppliedArtifacts(client) : new Map();
    assertAppliedArtifactsMatchSource(applied, artifacts);
    const hasPendingArtifacts = artifacts.some((artifact) => !applied.has(artifact.version));
    // A forward migration may intentionally change the exact runtime grant
    // policy. Preserve every structural/ownership check before applying it,
    // then enforce the new checked-in policy after all pending artifacts land.
    await inspectSchemaOwner(
      client,
      schemaOwnerRole,
      hasRegistry,
      verifyOnly || !hasPendingArtifacts,
    );

    for (const artifact of artifacts) {
      if (applied.has(artifact.version)) {
        result.alreadyApplied.push(artifact.filename);
      } else {
        result.pending.push(artifact.filename);
      }
    }

    if (verifyOnly) {
      if (result.pending.length > 0) {
        throw new Error(`Database has pending Cloud SQL artifacts: ${result.pending.join(", ")}`);
      }
    } else {
      for (const artifact of artifacts.filter((candidate) => !applied.has(candidate.version))) {
        await applyArtifact(client, artifact, schemaOwnerRole);
        result.applied.push(artifact.filename);
      }
      result.pending = result.pending.filter((filename) => !result.applied.includes(filename));
      await ensureEnvironmentSentinel(client, expectedEnvironment, schemaOwnerRole);
      if (result.applied.length > 0) {
        await inspectSchemaOwner(client, schemaOwnerRole, true, true);
      }
    }

    if (verifyOnly) {
      const { rows } = await client.query(
        "select value from public.app_environment where key = 'database_environment'",
      );
      if (rows[0]?.value !== expectedEnvironment) {
        throw new Error(`Database environment sentinel does not match ${expectedEnvironment}`);
      }
    }

    return result;
  } finally {
    await client.query("select pg_advisory_unlock($1, $2)", [ADVISORY_LOCK_NAMESPACE, ADVISORY_LOCK_KEY]);
  }
}

function parseCliArguments(argv) {
  const options = {
    expectedEnvironment: process.env.HUGMEID_DATABASE_ENV,
    schemaOwnerRole: process.env.HUGMEID_SCHEMA_OWNER_ROLE ?? "hugmeid_schema_owner",
    expectedDatabase: process.env.HUGMEID_EXPECTED_DATABASE,
    verifyOnly: false,
    confirmedEnvironment: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--verify-only") {
      options.verifyOnly = true;
    } else if (argument === "--confirm-environment") {
      options.confirmedEnvironment = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--confirm-environment=")) {
      options.confirmedEnvironment = argument.slice("--confirm-environment=".length);
    } else if (argument === "--environment") {
      options.expectedEnvironment = argv[index + 1];
      index += 1;
    } else if (argument.startsWith("--environment=")) {
      options.expectedEnvironment = argument.slice("--environment=".length);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!VALID_ENVIRONMENTS.has(options.expectedEnvironment)) {
    throw new Error("Set --environment to local, staging, or production");
  }
  if (
    options.expectedEnvironment !== "local" &&
    !options.verifyOnly &&
    options.confirmedEnvironment !== options.expectedEnvironment
  ) {
    throw new Error(`Mutation requires --confirm-environment=${options.expectedEnvironment}`);
  }
  return options;
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const client = new Client({
    application_name: "hugmeid-cloudsql-migrate",
  });
  await client.connect();
  try {
    const result = await migrate({ client, ...options });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Cloud SQL migration failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
