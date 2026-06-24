# Make SCMDB Fallback Refresh Explicit

GitHub: #130

## Problem

SCMDB is now a bridge/fallback source, but default `cache` and `pipeline` source refresh still includes SCMDB through
the `all` source target.

## Acceptance Criteria

- Default `cache` and `pipeline` behavior matches documented DataCore-first ownership.
- SCMDB refresh remains available through an explicit command, flag, or source target.
- Provider matrix distinguishes primary, optional fallback, diagnostic, historical, and retired source roles.
- Tests cover default source selection and explicit SCMDB fallback selection.

## Related Docs

- `docs/adrs/008-scmdb-as-explicit-fallback-source.md`
- `docs/prds/003-scmdb-fallback-retirement.md`
- `docs/generated-data-ownership.md`

