-- psql-only, one-time environment attestation for a new staging/production DB.
--
-- Example:
--   psql ... -v target_environment=staging \
--     -f cloudsql/ops/attest_database_environment.sql
--
-- The migration runner checks this database-owned comment before its first
-- mutation. Re-attestation is an explicit administrative action.

\set ON_ERROR_STOP on

\if :{?target_environment}
\else
do $$ begin raise exception 'target_environment is required'; end $$;
\endif

select :'target_environment' in ('staging', 'production') as environment_is_valid
\gset

\if :environment_is_valid
\else
do $$ begin raise exception 'target_environment must be staging or production'; end $$;
\endif

select
  current_database() as target_database,
  format('hugmeid-environment:%s', :'target_environment') as target_attestation
\gset

comment on database :"target_database" is :'target_attestation';
