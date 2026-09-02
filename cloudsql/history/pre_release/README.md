# Pre-release SQL history

These files are the immutable SQL artifacts used before the 2026-07-30
rebaseline. They remain here for audit, recovery analysis, and comparison with
the two databases that existed before release.

They are **not** an executable bootstrap path. The old chain had no registry,
and staging and production had different subsets and ownership. New databases
must use `scripts/cloudsql-migrate.mjs`, which starts from
`cloudsql/baseline/20260730000000_schema.sql`.

Do not edit, delete, or run these files as a directory. Verify their contents
with:

```sh
shasum -a 256 -c cloudsql/history/pre_release/checksums.sha256
```
